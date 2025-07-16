"use client";

import { createGroq } from "@ai-sdk/groq";
import { filterSuggestionItems } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
  DefaultReactSuggestionItem,
} from "@blocknote/react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBulb,
  IconCheck,
  IconCopy,
  IconEdit,
  IconList,
  IconPalette,
  IconPencil,
  IconQuestionMark,
  IconRobot,
  IconSparkles,
  IconSettings
} from "@tabler/icons-react";
import { generateText } from "ai";
import React from "react";

// Definisi interface yang proper
interface BlockNoteEditorProps {
  onContentChange?: (content: any[]) => void;
  style?: React.CSSProperties;
}

// Default export untuk komponen
export default function BlockNoteEditorComponent({
  onContentChange,
  style,
}: BlockNoteEditorProps) {
  const computedColorScheme = useComputedColorScheme("light");
  const [isAILoading, setIsAILoading] = React.useState(false);
  const [aiModalOpened, { open: openAIModal, close: closeAIModal }] = useDisclosure(false);
  const [prompt, setPrompt] = React.useState("");
  const [generatedContent, setGeneratedContent] = React.useState("");

  // Setup AI model
  const aiModel = React.useMemo(() => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      
      if (!apiKey) {
        console.warn("NEXT_PUBLIC_GROQ_API_KEY not found. AI features will be disabled.");
        return null;
      }

      return createGroq({
        apiKey: apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      })("llama-3.3-70b-versatile");
    } catch (error) {
      console.error("Failed to setup AI model:", error);
      return null;
    }
  }, []);

  // Create BlockNote editor
  const editor = useCreateBlockNote();

  // AI templates - simplified ke dua mode: Struktur dan Konten
  const aiTemplates = [
    {
      title: "Struktur",
      description: "Generate outline/bab dan sub bab",
      type: "structure",
      color: "blue",
      icon: IconList,
      defaultPrompt: "Panduan lengkap memulai karir di bidang teknologi"
    },
    {
      title: "Konten", 
      description: "Generate konten detail untuk bab yang sudah ada",
      type: "content",
      color: "green", 
      icon: IconEdit,
      defaultPrompt: "Jelaskan secara detail tentang persiapan CV dan portfolio"
    }
  ];

  // Function to filter slash menu items dengan memoization untuk stabilitas
  const getFilteredSlashMenuItems = React.useMemo(() => {
    return (editor: any): DefaultReactSuggestionItem[] => {
      try {
        const defaultItems = getDefaultReactSlashMenuItems(editor);
        
        // Filter untuk menyimpan heading, paragraph, dan list items tapi exclude toggle items
        const allowedItems = defaultItems.filter((item) => {
          const title = item.title.toLowerCase();
          
          // Keep heading 1, 2, 3, paragraph, numbered list, dan bullet list
          // Exclude semua toggle items termasuk subheading toggle
          return (
            title.includes("heading 1") ||
            title.includes("heading 2") ||
            title.includes("heading 3") ||
            title.includes("paragraph") ||
            title.includes("numbered list") ||
            title.includes("bullet list") ||
            title.includes("bulleted list") // Alternative name untuk bullet list
          ) && !title.includes("toggle"); // Exclude toggle items
        });

        return allowedItems;
      } catch (error) {
        console.error("Error in getFilteredSlashMenuItems:", error);
        // Fallback: return all default items jika ada error
        return getDefaultReactSlashMenuItems(editor);
      }
    };
  }, []);

  // Custom AI Slash Menu Items - mencoba dengan property icon yang benar
  const getCustomAISlashMenuItems = React.useMemo(() => {
    if (!aiModel) return [];
    
    return [
      {
        title: "AI Assistant",
        onItemClick: () => {
          openAIModal();
        },
        aliases: ["ai", "assistant", "generate", "write", "tulis"],
        group: "Headings",
        subtext: "Buat dengan bantuan AI",
        // Mencoba beberapa kemungkinan property untuk ikon
        icon: <IconSparkles size={18} />,
        // Alternatif lain yang mungkin
        render: () => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconSparkles size={18} color="#6366f1" />
            <span>AI Assistant</span>
          </div>
        ),
      }
    ];
  }, [aiModel, openAIModal]);

  // Parse inline formatting dari teks markdown
  const parseInlineFormatting = (text: string): any[] => {
    if (!text || typeof text !== 'string') return [{ type: "text", text: text || "" }];
    
    const result: any[] = [];
    let currentIndex = 0;
    
    // Regex patterns untuk berbagai formatting
    const patterns = [
      { 
        regex: /\*\*\*(.*?)\*\*\*/g, 
        styles: { bold: true, italic: true } 
      }, // Bold + Italic
      { 
        regex: /\*\*(.*?)\*\*/g, 
        styles: { bold: true } 
      }, // Bold
      { 
        regex: /\*(.*?)\*/g, 
        styles: { italic: true } 
      }, // Italic
      { 
        regex: /`(.*?)`/g, 
        styles: { code: true } 
      }, // Code
      { 
        regex: /~~(.*?)~~/g, 
        styles: { strike: true } 
      }, // Strikethrough
    ];
    
    // Find all matches
    const matches: Array<{
      start: number;
      end: number;
      text: string;
      styles: any;
      fullMatch: string;
    }> = [];
    
    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.regex.source, 'g');
      
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[1],
          styles: pattern.styles,
          fullMatch: match[0]
        });
      }
    });
    
    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);
    
    // Remove overlapping matches (keep the first one)
    const filteredMatches = [];
    let lastEnd = 0;
    
    for (const match of matches) {
      if (match.start >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.end;
      }
    }
    
    // Build result array
    let textIndex = 0;
    
    for (const match of filteredMatches) {
      // Add text before match
      if (match.start > textIndex) {
        const beforeText = text.substring(textIndex, match.start);
        if (beforeText) {
          result.push({
            type: "text",
            text: beforeText
          });
        }
      }
      
      // Add formatted text
      result.push({
        type: "text",
        text: match.text,
        styles: match.styles
      });
      
      textIndex = match.end;
    }
    
    // Add remaining text
    if (textIndex < text.length) {
      const remainingText = text.substring(textIndex);
      if (remainingText) {
        result.push({
          type: "text",
          text: remainingText
        });
      }
    }
    
    // If no formatting found, return plain text
    if (result.length === 0) {
      result.push({
        type: "text",
        text: text
      });
    }
    
    return result;
  };

  // Enhanced AI generation dengan dua mode: Struktur dan Konten
  const generateAIContent = async (prompt: string, type: string = "structure") => {
    if (!aiModel) return null;
    
    setIsAILoading(true);
    try {
      let systemPrompt = "";
      
      if (type === "structure") {
        systemPrompt = `Buat STRUKTUR/OUTLINE lengkap dengan bab dan sub bab untuk topik: ${prompt}

Format yang WAJIB digunakan:
# Judul Utama: [Topik]

## Bab 1: [Nama Bab]
### Sub Bab 1.1: [Nama Sub Bab]
### Sub Bab 1.2: [Nama Sub Bab]
### Sub Bab 1.3: [Nama Sub Bab]

## Bab 2: [Nama Bab]
### Sub Bab 2.1: [Nama Sub Bab]
### Sub Bab 2.2: [Nama Sub Bab]
### Sub Bab 2.3: [Nama Sub Bab]

## Bab 3: [Nama Bab]
### Sub Bab 3.1: [Nama Sub Bab]
### Sub Bab 3.2: [Nama Sub Bab]

## Kesimpulan

PENTING: 
- Hanya buat outline/struktur saja, TIDAK mengisi konten detail
- Gunakan format markdown heading (# ## ###) 
- Buat minimal 3-4 bab dengan 2-3 sub bab per bab
- Nama bab dan sub bab harus spesifik dan deskriptif`;

      } else if (type === "content") {
        systemPrompt = `Generate KONTEN DETAIL untuk mengisi struktur yang sudah ada. Topik: ${prompt}

Format yang diharapkan:
- Tulis konten detail dalam bentuk paragraf yang lengkap
- Berikan penjelasan mendalam, contoh, dan insight praktis
- Gunakan bahasa yang engaging dan mudah dipahami
- Sertakan tips, langkah-langkah, atau panduan konkret
- Buat konten yang actionable dan bermanfaat

PENTING:
- Fokus pada KONTEN DETAIL, bukan struktur
- Berikan informasi yang comprehensive dan valuable
- Gunakan paragraf yang well-structured
- Sertakan contoh atau case study jika relevan`;

      } else {
        // Fallback ke struktur
        systemPrompt = `Buat outline lengkap untuk topik: ${prompt}. Gunakan format markdown heading dengan struktur yang jelas.`;
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: systemPrompt,
        maxTokens: type === "structure" ? 1500 : 3000, // Struktur lebih pendek, konten lebih panjang
        temperature: 0.7,
        presencePenalty: 0.1,
        frequencyPenalty: 0.1,
      });
      
      setGeneratedContent(text);
      return text;
    } catch (error) {
      console.error("AI generation failed:", error);
      return null;
    } finally {
      setIsAILoading(false);
    }
  };

  // Enhanced AI generation dengan validasi input dan clear editor
  const handleAIGeneration = async (inputPrompt: string, type: string = "structure") => {
    if (!inputPrompt.trim()) {
      alert("⚠️ Silakan masukkan topik atau kata kunci sebelum generate konten!");
      return;
    }
    
    // Clear editor content sebelum generate konten baru
    try {
      // Get semua blocks di editor
      const currentBlocks = editor.document;
      
      // Jika ada content, kosongkan editor
      if (currentBlocks.length > 0) {
        // Hapus semua blocks kecuali block pertama
        if (currentBlocks.length > 1) {
          const blocksToRemove = currentBlocks.slice(1);
          editor.removeBlocks(blocksToRemove);
        }
        
        // Reset block pertama menjadi paragraph kosong
        const firstBlock = editor.document[0];
        if (firstBlock) {
          editor.updateBlock(firstBlock, {
            type: "paragraph",
            content: "",
          });
        }
      }
    } catch (error) {
      console.log("Editor clearing adjustment:", error);
    }
    
    // Generate AI content dengan type yang sesuai
    await generateAIContent(inputPrompt, type);
  };

  // Enhanced insert function dengan parsing markdown formatting yang lengkap
  const insertContentToEditor = () => {
    if (!generatedContent) return;

    try {
      // Clear editor content first
      const currentBlocks = editor.document;
      if (currentBlocks.length > 0) {
        // Remove all blocks
        editor.removeBlocks(currentBlocks);
      }

      const lines = generatedContent.split('\n').filter(line => line.trim());
      const blocksToInsert = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let blockType = "paragraph";
        let content: any = line;
        let props = {};
        
        // Parse heading markdown
        if (line.match(/^# .+/)) {
          blockType = "heading";
          props = { level: 1 };
          content = parseInlineFormatting(line.replace(/^# /, '').trim());
        } else if (line.match(/^## .+/)) {
          blockType = "heading";
          props = { level: 2 };
          content = parseInlineFormatting(line.replace(/^## /, '').trim());
        } else if (line.match(/^### .+/)) {
          blockType = "heading";
          props = { level: 3 };
          content = parseInlineFormatting(line.replace(/^### /, '').trim());
        } else if (line.match(/^#### .+/)) {
          blockType = "heading";
          props = { level: 4 };
          content = parseInlineFormatting(line.replace(/^#### /, '').trim());
        } else if (line.match(/^##### .+/)) {
          blockType = "heading";
          props = { level: 5 };
          content = parseInlineFormatting(line.replace(/^##### /, '').trim());
        } else if (line.match(/^###### .+/)) {
          blockType = "heading";
          props = { level: 6 };
          content = parseInlineFormatting(line.replace(/^###### /, '').trim());
        } else if (line.match(/^\* .+/) || line.match(/^- .+/)) {
          // Parse list items
          blockType = "bulletListItem";
          content = parseInlineFormatting(line.replace(/^[\*-] /, '').trim());
        } else if (line.match(/^\d+\. .+/)) {
          // Parse numbered list items
          blockType = "numberedListItem";
          content = parseInlineFormatting(line.replace(/^\d+\. /, '').trim());
        } else {
          // Parse regular paragraphs
          content = parseInlineFormatting(line);
        }
        
        const blockData: any = {
          type: blockType,
          content: content,
          props: props,
        };
        
        blocksToInsert.push(blockData);
      }
      
      // Insert all blocks at once from the beginning
      if (blocksToInsert.length > 0) {
        editor.replaceBlocks(editor.document, blocksToInsert);
        
        // Move cursor to the beginning
        setTimeout(() => {
          try {
            const firstBlock = editor.document[0];
            if (firstBlock) {
              editor.setTextCursorPosition(firstBlock, "start");
            }
          } catch (e) {
            console.log("Cursor positioning adjustment");
          }
        }, 100);
      }
      
      closeModalAndReset();
      
    } catch (error) {
      console.error("Error inserting content:", error);
    }
  };

  // Reset modal state
  const closeModalAndReset = () => {
    closeAIModal();
    setPrompt("");
    setGeneratedContent("");
    setIsAILoading(false);
  };

  // Handle content changes untuk heading extraction
  React.useEffect(() => {
    if (!editor || !onContentChange) return;

    let timeoutId: NodeJS.Timeout;

    const handleContentChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          const content = editor.document;
          onContentChange(content);
        } catch (error) {
          console.error("Error getting editor content:", error);
        }
      }, 1500);
    };

    const interval = setInterval(handleContentChange, 3000);
    setTimeout(handleContentChange, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [editor, onContentChange]);

  return (
    <>
      <div style={{ ...style, height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Scrollable Editor Container */}
        <ScrollArea 
          style={{ flex: 1 }}
          scrollbarSize={8}
          scrollHideDelay={1000}
        >
          <BlockNoteView
            editor={editor}
            theme={computedColorScheme === "dark" ? "dark" : "light"}
            style={{ 
              minHeight: "100%",
              padding: "20px",
            }}
            slashMenu={false}
          >
            {/* Custom Slash Menu dengan AI di posisi teratas dan item yang sudah difilter */}
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={React.useCallback(async (query: string) => {
                const aiItems = getCustomAISlashMenuItems;
                const defaultItems = getFilteredSlashMenuItems(editor);
                const allItems = [...aiItems, ...defaultItems];
                
                return filterSuggestionItems(allItems, query);
              }, [editor, getCustomAISlashMenuItems, getFilteredSlashMenuItems])}
            />
          </BlockNoteView>
        </ScrollArea>
        
        {/* Enhanced Status Bar */}
        <Paper 
          p="md" 
          style={{ 
            borderTop: "1px solid #e9ecef",
            background: computedColorScheme === "dark" ? "#1a1a1a" : "#f8f9fa",
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {aiModel 
                  ? "🤖 AI Assistant Ready"
                  : "✍️ BlockNote Editor"
                }
              </Text>
              
              {aiModel && (
                <Badge size="xs" color="blue" variant="light">
                  AI Enabled
                </Badge>
              )}
            </Group>
            
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Ketik "/" untuk commands
              </Text>
              
              {aiModel && (
                <Tooltip label="Buka AI Assistant" position="top">
                  <ActionIcon
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan' }}
                    size="lg"
                    loading={isAILoading}
                    onClick={openAIModal}
                    style={{ 
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isAILoading ? <Loader size={18} /> : <IconRobot size={18} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Paper>
      </div>

      {/* Enhanced AI Assistant Modal */}
      <Modal
        opened={aiModalOpened}
        onClose={closeModalAndReset}
        title={
          <Group gap="xs">
            <IconSparkles size={24} style={{ color: '#007BFF' }} />
            <Text fw={600} size="lg">AI Assistant</Text>
          </Group>
        }
        size="xl"
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          header: {
            background: computedColorScheme === "dark" 
              ? "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)"
              : "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
            borderBottom: `2px solid ${computedColorScheme === "dark" ? "#404040" : "#dee2e6"}`,
          },
        }}
      >
        <Stack gap="lg">
          {!generatedContent ? (
            /* Template Selection */
            <>
              {/* Custom Prompt Input - Diperbesar */}
              <Paper p="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="xs">
                    <IconEdit size={20} />
                    <Text fw={500} size="lg">
                      Topik atau Kata Kunci
                    </Text>
                  </Group>
                  
                  <Textarea
                    placeholder="Masukkan topik yang ingin Anda buat strukturnya atau kontennya..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    minRows={5}
                    maxRows={8}
                    autosize
                    style={{
                      fontSize: '16px',
                    }}
                  />
                  <Text size="sm" c="dimmed">
                    💡 Tip: Untuk mode "Struktur" - masukkan topik umum. Untuk mode "Konten" - masukkan bab/sub bab spesifik yang ingin diisi.
                  </Text>
                </Stack>
              </Paper>

              {/* AI Templates Grid - Hanya 2 template */}
              <Stack gap="md">
                <Text fw={500} size="lg" c="dimmed">
                  Pilih mode generate:
                </Text>
                
                <SimpleGrid cols={2} spacing="lg">
                  {aiTemplates.map((template) => (
                    <Card
                      key={template.type}
                      p="xl"
                      withBorder
                      radius="lg"
                      style={{
                        cursor: "pointer",
                        transition: 'all 0.2s ease',
                        height: '140px',
                      }}
                      className="hover:transform hover:scale-105 hover:shadow-lg"
                      onClick={() => {
                        const finalPrompt = prompt.trim() || template.defaultPrompt;
                        handleAIGeneration(finalPrompt, template.type);
                      }}
                    >
                      <Stack gap="md" align="center" justify="center" h="100%">
                        <ThemeIcon 
                          size="xl" 
                          color={template.color} 
                          variant="light"
                          radius="lg"
                        >
                          <template.icon size={24} />
                        </ThemeIcon>
                        <Text size="lg" fw={600} ta="center" lh={1.2}>
                          {template.title}
                        </Text>
                        <Text size="sm" c="dimmed" ta="center">
                          {template.description}
                        </Text>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </Stack>

              {/* Loading State */}
              {isAILoading && (
                <Paper p="lg" radius="md" bg="blue.0">
                  <Group gap="md" justify="center">
                    <Loader size="md" color="blue" />
                    <Stack gap="xs" align="center">
                      <Text size="md" c="blue" fw={500}>
                        AI sedang membuat konten...
                      </Text>
                      <Text size="sm" c="blue">
                        Mohon tunggu sebentar
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )}
            </>
          ) : (
            /* Generated Content Display */
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={600} size="lg" c="blue">
                  ✨ Konten Yang Dihasilkan
                </Text>
                <CopyButton value={generatedContent} timeout={2000}>
                  {({ copied, copy }) => (
                    <Button
                      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      variant="light"
                      color={copied ? "green" : "blue"}
                      size="sm"
                      onClick={copy}
                    >
                      {copied ? "Tersalin!" : "Copy"}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              
              <Paper 
                p="xl" 
                radius="lg" 
                withBorder 
                style={{ 
                  maxHeight: "500px", 
                  overflow: "auto",
                  background: computedColorScheme === "dark" ? "#1a1a1a" : "#f8f9fa",
                }}
              >
                <Text size="md" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: '15px' }}>
                  {generatedContent}
                </Text>
              </Paper>
              
              <Group justify="space-between">
                <Button
                  variant="light"
                  onClick={closeModalAndReset}
                  color="gray"
                >
                  Buat Lagi
                </Button>
                
                <Button
                  leftSection={<IconEdit size={16} />}
                  onClick={insertContentToEditor}
                  size="md"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                >
                  Masukkan ke Editor
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
}