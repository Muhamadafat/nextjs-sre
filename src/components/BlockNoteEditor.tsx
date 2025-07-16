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
  Checkbox,
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
  const [aiMode, setAIMode] = React.useState<"new" | "continue">("new"); // Track AI mode
  const [selectedHeadings, setSelectedHeadings] = React.useState<string[]>([]); // Track selected headings

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

  // Custom AI Slash Menu Items dengan opsi append dan replace
  const getCustomAISlashMenuItems = React.useMemo(() => {
    if (!aiModel) return [];
    
    return [
      {
        title: "AI Assistant",
        onItemClick: () => {
          openAIModal();
        },
        aliases: ["ai", "assistant", "generate", "write", "tulis"],
        group: "AI Tools",
        subtext: "Buat konten baru dengan AI",
        icon: <IconSparkles size={18} />,
      },
      {
        title: "AI Continue",
        onItemClick: () => {
          // Set mode continue untuk tidak clear editor
          setAIMode("continue");
          openAIModal();
        },
        aliases: ["continue", "lanjut", "append", "tambah"],
        group: "AI Tools", 
        subtext: "Lanjutkan konten yang ada",
        icon: <IconEdit size={18} />,
      }
    ];
  }, [aiModel, openAIModal]);

  // Interface untuk heading structure
  interface HeadingStructure {
    level: number;
    text: string;
    position: number;
  }

  interface ContentAnalysis {
    hasStructure: boolean;
    mainTitle?: string;
    chapters?: string[];
    subChapters?: string[];
    totalHeadings?: number;
    structure?: HeadingStructure[];
  }

  // Function untuk membaca dan menganalisis struktur editor yang sudah ada
  const analyzeExistingContent = (): ContentAnalysis => {
    try {
      const currentBlocks = editor.document;
      const currentHeadings: HeadingStructure[] = [];
      
      currentBlocks.forEach((block, index) => {
        if (block.type === "heading") {
          const level = block.props?.level || 1;
          // Safely extract text from content array
          let text = "";
          if (block.content && Array.isArray(block.content)) {
            text = block.content
              .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'text' in item) return item.text;
                return '';
              })
              .join('');
          }
          
          currentHeadings.push({
            level: level,
            text: text || `Heading ${level}`,
            position: index
          });
        }
      });
      
      // Analisis struktur untuk prompt AI
      if (currentHeadings.length > 0) {
        const mainTitle = currentHeadings.find(h => h.level === 1)?.text || "";
        const chapters = currentHeadings.filter(h => h.level === 2);
        const subChapters = currentHeadings.filter(h => h.level === 3);
        
        return {
          hasStructure: true,
          mainTitle,
          chapters: chapters.map(c => c.text),
          subChapters: subChapters.map(s => s.text),
          totalHeadings: currentHeadings.length,
          structure: currentHeadings
        };
      }
      
      return { hasStructure: false };
    } catch (error) {
      console.error("Error analyzing content:", error);
      return { hasStructure: false };
    }
  };
  const parseInlineFormatting = (text: string): any[] => {
    if (!text || typeof text !== 'string') return [{ type: "text", text: text || "" }];
    
    const result: any[] = [];
    
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

  // Enhanced AI generation dengan context awareness untuk Continue mode
  const generateAIContent = async (prompt: string, type: string = "structure") => {
    if (!aiModel) return null;
    
    setIsAILoading(true);
    try {
      let systemPrompt = "";
      
      // Analisis konten yang sudah ada untuk Continue mode
      const existingContent = aiMode === "continue" ? analyzeExistingContent() : { hasStructure: false };
      
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
- Nama bab dan sub bab harus spesifik dan deskriptif
- Pastikan urutan bab berurutan (Bab 1, Bab 2, Bab 3, dst)
- Sub bab harus berurutan dalam setiap bab (1.1, 1.2, 1.3, dst)`;

      } else if (type === "content") {
        // Untuk mode continue dengan struktur yang sudah ada
        if (aiMode === "continue" && existingContent.hasStructure) {
          // Filter heading yang dipilih jika ada
          const targetHeadings = selectedHeadings.length > 0 
            ? selectedHeadings 
            : existingContent.chapters || [];

          systemPrompt = `Saya memiliki struktur dokumen berikut yang sudah ada:

JUDUL UTAMA: ${existingContent.mainTitle}

STRUKTUR LENGKAP:
${existingContent.structure?.map(h => `${'#'.repeat(h.level)} ${h.text}`).join('\n') || ''}

BAGIAN YANG INGIN DIISI:
${selectedHeadings.length > 0 
  ? selectedHeadings.map((heading, i) => `${i + 1}. ${heading}`).join('\n')
  : 'Semua bab dan sub bab yang ada'
}

TUGAS: Buatkan KONTEN DETAIL untuk setiap bagian yang disebutkan di atas. ${prompt ? `Fokus pada: ${prompt}` : ''}

FORMAT YANG DIHARAPKAN:
- Buat konten untuk setiap bagian yang dipilih dengan format khusus
- Gunakan penanda "===[NAMA_BAGIAN]===" untuk memisahkan konten setiap bagian
- Setelah penanda, buat 2-4 paragraf konten yang substantial
- JANGAN sertakan heading markdown (##, ###) - heading sudah ada di editor
- Berikan penjelasan mendalam, contoh praktis, dan panduan konkret
- Gunakan bahasa yang engaging dan mudah dipahami
- Sertakan tips, langkah-langkah, atau insight yang actionable

CONTOH FORMAT:
===[Bab 1: Pengenalan]===
Konten paragraf pertama untuk Bab 1...

Konten paragraf kedua untuk Bab 1...

===[Sub Bab 1.1: Konsep Dasar]===
Konten paragraf pertama untuk Sub Bab 1.1...

Konten paragraf kedua untuk Sub Bab 1.1...

PENTING:
- Gunakan HANYA penanda "===[NAMA_BAGIAN]===" untuk memisahkan konten
- JANGAN tulis ulang heading markdown - heading sudah ada di editor
- Fokus pada konten isi/paragraf yang substantial
- Berikan informasi yang comprehensive dan valuable`;

        } else {
          // Mode content biasa tanpa struktur yang sudah ada
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
        }

      } else {
        // Fallback ke struktur
        systemPrompt = `Buat outline lengkap untuk topik: ${prompt}. Gunakan format markdown heading dengan struktur yang jelas dan berurutan.`;
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: systemPrompt,
        maxTokens: type === "structure" ? 1500 : 4000, // Lebih banyak token untuk content yang detail
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

  // Enhanced AI generation dengan validasi input dan opsi clear editor
  const handleAIGeneration = async (inputPrompt: string, type: string = "structure", shouldClearEditor: boolean = true) => {
    if (!inputPrompt.trim()) {
      alert("⚠️ Silakan masukkan topik atau kata kunci sebelum generate konten!");
      return;
    }
    
    // Clear editor content hanya jika diminta (untuk modal) 
    if (shouldClearEditor) {
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
    }
    
    // Generate AI content dengan type yang sesuai
    await generateAIContent(inputPrompt, type);
  };

  // FIXED: Enhanced insert function dengan smart positioning untuk Continue mode
  const insertContentToEditor = (shouldAppend: boolean = false) => {
    if (!generatedContent) return;

    try {
      let blocksToInsert = [];
      
      // Parse generated content menjadi blocks
      const lines = generatedContent.split('\n').filter(line => line.trim());
      
      // Process setiap line menjadi blocks
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let blockType = "paragraph";
        let content: any = line;
        let props = {};
        
        // Parse markdown heading dengan urutan yang benar
        if (line.match(/^# .+/)) {
          blockType = "heading" as const;
          props = { level: 1 };
          content = parseInlineFormatting(line.replace(/^# /, '').trim());
        } else if (line.match(/^## .+/)) {
          blockType = "heading" as const;
          props = { level: 2 };
          content = parseInlineFormatting(line.replace(/^## /, '').trim());
        } else if (line.match(/^### .+/)) {
          blockType = "heading" as const;
          props = { level: 3 };
          content = parseInlineFormatting(line.replace(/^### /, '').trim());
        } else if (line.match(/^#### .+/)) {
          blockType = "heading" as const;
          props = { level: 4 };
          content = parseInlineFormatting(line.replace(/^#### /, '').trim());
        } else if (line.match(/^##### .+/)) {
          blockType = "heading" as const;
          props = { level: 5 };
          content = parseInlineFormatting(line.replace(/^##### /, '').trim());
        } else if (line.match(/^###### .+/)) {
          blockType = "heading" as const;
          props = { level: 6 };
          content = parseInlineFormatting(line.replace(/^###### /, '').trim());
        } else if (line.match(/^\* .+/) || line.match(/^- .+/)) {
          // Parse list items
          blockType = "bulletListItem" as const;
          content = parseInlineFormatting(line.replace(/^[\*-] /, '').trim());
        } else if (line.match(/^\d+\. .+/)) {
          // Parse numbered list items
          blockType = "numberedListItem" as const;
          content = parseInlineFormatting(line.replace(/^\d+\. /, '').trim());
        } else {
          // Parse regular paragraphs
          blockType = "paragraph" as const;
          content = parseInlineFormatting(line);
        }
        
        // Buat block data yang proper untuk BlockNote
        const blockData = {
          type: blockType,
          content: content,
          props: props,
        };
        
        blocksToInsert.push(blockData);
      }
      
      // Smart insertion berdasarkan mode dan selection
      if (blocksToInsert.length > 0) {
        if (!shouldAppend) {
          // Mode replace: ganti semua content
          editor.replaceBlocks(editor.document, blocksToInsert as any);
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
        } else {
          // Mode append dengan smart positioning untuk Continue
          if (aiMode === "continue" && selectedHeadings.length > 0) {
            // Find position untuk insertion berdasarkan selected headings
            insertContentAtSelectedPositions(blocksToInsert as any);
          } else {
            // Default append di akhir dokumen
            editor.insertBlocks(blocksToInsert as any, editor.document[editor.document.length - 1], "after");
            setTimeout(() => {
              try {
                const lastBlock = editor.document[editor.document.length - 1];
                if (lastBlock) {
                  editor.setTextCursorPosition(lastBlock, "end");
                }
              } catch (e) {
                console.log("Cursor positioning adjustment");
              }
            }, 100);
          }
        }
      }
      
      // Close modal dan reset state
      closeModalAndReset();
      
    } catch (error) {
      console.error("Error inserting content:", error);
      alert("❌ Terjadi kesalahan saat memasukkan konten ke editor. Silakan coba lagi.");
    }
  };

  // Function untuk insert content di posisi yang tepat berdasarkan selected headings
  const insertContentAtSelectedPositions = (blocksToInsert: any[]) => {
    try {
      const currentBlocks = editor.document;
      const existingContent = analyzeExistingContent();
      
      if (!existingContent.hasStructure || !existingContent.structure) return;

      // Parse generated content berdasarkan penanda "===[NAMA_BAGIAN]==="
      const contentSections = parseContentSections(generatedContent);
      
      if (contentSections.length === 0) {
        // Fallback: jika tidak ada penanda, insert semua content setelah heading pertama
        if (selectedHeadings.length > 0) {
          const firstSelectedHeading = existingContent.structure?.find(h => h.text === selectedHeadings[0]);
          if (firstSelectedHeading) {
            const targetBlock = currentBlocks[firstSelectedHeading.position];
            if (targetBlock) {
              try {
                editor.insertBlocks(blocksToInsert as any, targetBlock, "after");
              } catch (error) {
                console.log("Error inserting at specific position:", error);
                editor.insertBlocks(blocksToInsert as any, currentBlocks[currentBlocks.length - 1], "after");
              }
            }
          }
        }
        return;
      }

      // Insert content untuk setiap heading yang dipilih
      selectedHeadings.forEach(headingText => {
        const headingStructure = existingContent.structure?.find(h => h.text === headingText);
        if (!headingStructure) return;

        // Find content untuk heading ini
        const matchingContent = contentSections.find(section => 
          section.headingName === headingText || 
          section.headingName.includes(headingText.replace(/^(Bab|Sub Bab)\s*\d+(\.\d+)?:\s*/, ''))
        );

        if (!matchingContent) return;

        // Convert content menjadi blocks
        const contentBlocks = matchingContent.content.split('\n')
          .filter(line => line.trim())
          .map(line => ({
            type: "paragraph" as const,
            content: parseInlineFormatting(line.trim()),
            props: {},
          }));

        if (contentBlocks.length === 0) return;

        // Find target block di editor
        const targetBlock = currentBlocks[headingStructure.position];
        if (!targetBlock) return;

        // Insert content setelah heading ini
        try {
          editor.insertBlocks(contentBlocks as any, targetBlock, "after");
          
          // Update currentBlocks reference untuk insertions selanjutnya
          // Karena positions berubah setelah insertion
          setTimeout(() => {
            // Refresh blocks after insertion
          }, 50);
          
        } catch (error) {
          console.log("Error inserting at specific position:", error);
          // Fallback: insert at end
          editor.insertBlocks(contentBlocks as any, currentBlocks[currentBlocks.length - 1], "after");
        }
      });

      // Move cursor ke heading pertama yang dipilih
      setTimeout(() => {
        try {
          if (selectedHeadings.length > 0) {
            const firstSelectedHeading = existingContent.structure?.find(h => h.text === selectedHeadings[0]);
            if (firstSelectedHeading) {
              // Move cursor ke posisi setelah heading + content yang baru diinsert
              const targetBlock = editor.document[firstSelectedHeading.position + 1];
              if (targetBlock) {
                editor.setTextCursorPosition(targetBlock, "start");
              }
            }
          }
        } catch (e) {
          console.log("Cursor positioning adjustment");
        }
      }, 200);

    } catch (error) {
      console.error("Error in smart positioning:", error);
      // Fallback: insert at end
      editor.insertBlocks(blocksToInsert, editor.document[editor.document.length - 1], "after");
    }
  };

  // Function untuk parsing content sections berdasarkan penanda
  const parseContentSections = (content: string): Array<{headingName: string, content: string}> => {
    const sections: Array<{headingName: string, content: string}> = [];
    const lines = content.split('\n');
    
    let currentSection: {headingName: string, content: string} | null = null;
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Check apakah ini penanda section
      const sectionMatch = trimmedLine.match(/^===\[(.*?)\]===$/);
      if (sectionMatch) {
        // Save section sebelumnya jika ada
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start section baru
        currentSection = {
          headingName: sectionMatch[1],
          content: ""
        };
      } else if (currentSection && trimmedLine) {
        // Tambahkan content ke section saat ini
        currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
      }
    });
    
    // Save section terakhir
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  // Reset modal state
  const closeModalAndReset = () => {
    closeAIModal();
    setPrompt("");
    setGeneratedContent("");
    setIsAILoading(false);
    setAIMode("new"); // Reset AI mode
    setSelectedHeadings([]); // Reset selected headings
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
      <div style={{ 
        ...style, 
        height: "100%", 
        display: "flex", 
        flexDirection: "column"
      }}>
        {/* Scrollable Editor Container */}
        <ScrollArea 
          style={{ 
            flex: 1
          }}
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
            {/* Custom Slash Menu dengan styling yang lebih baik */}
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={React.useCallback(async (query: string) => {
                const aiItems = getCustomAISlashMenuItems;
                const defaultItems = getFilteredSlashMenuItems(editor);
                const allItems = [...aiItems, ...defaultItems];
                
                return filterSuggestionItems(allItems, query);
              }, [editor, getCustomAISlashMenuItems, getFilteredSlashMenuItems])}
              suggestionMenuComponent={React.useMemo(() => {
                return (props: any) => (
                  <div
                    style={{
                      backgroundColor: computedColorScheme === "dark" ? "#2c2e33" : "#ffffff",
                      border: `2px solid ${computedColorScheme === "dark" ? "#495057" : "#e9ecef"}`,
                      borderRadius: "12px",
                      boxShadow: computedColorScheme === "dark" 
                        ? "0 10px 25px rgba(0, 0, 0, 0.3)" 
                        : "0 10px 25px rgba(0, 0, 0, 0.1)",
                      padding: "8px",
                      minWidth: "280px",
                      maxWidth: "350px",
                      maxHeight: "320px",
                      overflowY: "auto",
                      zIndex: 1000,
                      position: "absolute",
                      // Positioning untuk tidak menutupi text sebelumnya
                      transform: "translateY(8px)",
                    }}
                  >
                    {props.items.map((item: any, index: number) => (
                      <div
                        key={index}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor: props.selectedIndex === index 
                            ? (computedColorScheme === "dark" ? "#495057" : "#f8f9fa")
                            : "transparent",
                          border: props.selectedIndex === index 
                            ? `2px solid ${computedColorScheme === "dark" ? "#6c757d" : "#dee2e6"}`
                            : "2px solid transparent",
                          margin: "2px 0",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                        onClick={() => {
                          props.onItemClick?.(item);
                        }}
                        onMouseEnter={() => {
                          // Handle hover if needed
                        }}
                      >
                        {/* Icon */}
                        <div style={{ 
                          minWidth: "24px", 
                          height: "24px", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          color: item.title === "AI Assistant" ? "#007BFF" : 
                                item.title === "AI Continue" ? "#28a745" : "#6c757d"
                        }}>
                          {item.icon}
                        </div>
                        
                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: "14px", 
                            fontWeight: "600",
                            color: computedColorScheme === "dark" ? "#ffffff" : "#212529",
                            marginBottom: "2px"
                          }}>
                            {item.title}
                          </div>
                          {item.subtext && (
                            <div style={{ 
                              fontSize: "12px", 
                              color: computedColorScheme === "dark" ? "#adb5bd" : "#6c757d",
                              lineHeight: "1.3"
                            }}>
                              {item.subtext}
                            </div>
                          )}
                        </div>

                        {/* Badge untuk AI items */}
                        {(item.title === "AI Assistant" || item.title === "AI Continue") && (
                          <div style={{
                            backgroundColor: item.title === "AI Assistant" ? "#e3f2fd" : "#e8f5e9",
                            color: item.title === "AI Assistant" ? "#1976d2" : "#388e3c",
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: "600",
                            textTransform: "uppercase"
                          }}>
                            AI
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }, [computedColorScheme])}
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
              ? "linear-gradient(135deg, #1a1a1a 0%, #2c2e33 100%)"
              : "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
            borderBottom: `1px solid ${computedColorScheme === "dark" ? "#2c2e33" : "#e9ecef"}`,
          },
          body: {
            padding: "2rem",
          },
        }}
      >
        <Stack gap="xl">
          {!generatedContent ? (
            <>
              {/* Mode indicator dengan informasi struktur yang terdeteksi */}
              {aiMode === "continue" && (
                <Paper p="md" radius="md" bg="green.0">
                  <Group gap="md">
                    <ThemeIcon size="lg" color="green" variant="light">
                      <IconEdit size={20} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={600} c="green">
                        Mode Lanjutkan Konten
                      </Text>
                              {(() => {
                                const existing = analyzeExistingContent();
                                if (existing.hasStructure && existing.structure) {
                                  return (
                                    <Stack gap={8}>
                                      <Text size="sm" c="green">
                                        📋 Struktur terdeteksi: <strong>{existing.mainTitle}</strong>
                                      </Text>
                                      <Text size="sm" c="green">
                                        📝 {existing.chapters?.length || 0} Bab | {existing.subChapters?.length || 0} Sub Bab
                                      </Text>
                                      
                                      {/* Heading Selection */}
                                      <Paper p="sm" bg="green.1" radius="md">
                                        <Text size="xs" fw={500} c="green" mb="xs">
                                          Pilih bagian yang ingin diisi (kosongkan untuk semua):
                                        </Text>
                                        <Stack gap={4} style={{ maxHeight: '120px', overflow: 'auto' }}>
                                          {existing.structure
                                            .filter(h => h.level <= 3) // Only show up to level 3
                                            .map((heading, index) => (
                                            <Checkbox
                                              key={index}
                                              size="xs"
                                              label={
                                                <Text size="xs" style={{ 
                                                  marginLeft: (heading.level - 1) * 12,
                                                  fontWeight: heading.level <= 2 ? 600 : 400 
                                                }}>
                                                  {'#'.repeat(heading.level)} {heading.text}
                                                </Text>
                                              }
                                              checked={selectedHeadings.includes(heading.text)}
                                              onChange={(event) => {
                                                if (event.currentTarget.checked) {
                                                  setSelectedHeadings(prev => [...prev, heading.text]);
                                                } else {
                                                  setSelectedHeadings(prev => prev.filter(h => h !== heading.text));
                                                }
                                              }}
                                            />
                                          ))}
                                        </Stack>
                                        
                                        {selectedHeadings.length > 0 && (
                                          <Group gap="xs" mt="xs">
                                            <Badge size="xs" color="green">
                                              {selectedHeadings.length} terpilih
                                            </Badge>
                                            <Button 
                                              size="xs" 
                                              variant="subtle" 
                                              color="green"
                                              onClick={() => setSelectedHeadings([])}
                                            >
                                              Reset
                                            </Button>
                                          </Group>
                                        )}
                                      </Paper>
                                      
                                      <Text size="xs" c="dimmed">
                                        AI akan mengisi konten detail hanya untuk bagian yang dipilih
                                      </Text>
                                    </Stack>
                                  );
                                } else {
                                  return (
                                    <Text size="sm" c="green">
                                      Konten baru akan ditambahkan di akhir editor tanpa menghapus yang sudah ada
                                    </Text>
                                  );
                                }
                              })()}
                    </Stack>
                  </Group>
                </Paper>
              )}

              {/* Enhanced Input Section */}
              <Paper p="lg" radius="md" bg={computedColorScheme === "dark" ? "dark.7" : "gray.0"}>
                <Stack gap="md">
                  <Text fw={500} size="lg" c="blue">
                    💡 Masukkan topik atau deskripsi konten
                  </Text>
                  
                  <Textarea
                    placeholder="Contoh: Panduan memulai karir di bidang teknologi, Tutorial belajar pemrograman, Strategi digital marketing 2024..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    autosize
                    minRows={3}
                    maxRows={6}
                    styles={{
                      input: {
                        fontSize: '16px',
                        padding: '16px',
                        border: `2px solid ${computedColorScheme === "dark" ? "#495057" : "#ced4da"}`,
                        borderRadius: '12px',
                      }
                    }}
                  />
                  
                  <Text size="sm" c="dimmed">
                    <strong>Tips:</strong> 
                    {aiMode === "continue" ? (
                      (() => {
                        const existing = analyzeExistingContent();
                        if (existing.hasStructure) {
                          return selectedHeadings.length > 0 
                            ? `Jelaskan aspek spesifik untuk "${selectedHeadings.join(', ')}" atau biarkan kosong untuk konten umum.`
                            : "Pilih bagian spesifik di atas atau biarkan kosong untuk mengisi semua bagian. Jelaskan aspek yang ingin ditekankan.";
                        } else {
                          return "Untuk mode \"Struktur\" - jelaskan topik secara umum. Untuk mode \"Konten\" - masukkan bab/sub bab spesifik yang ingin diisi.";
                        }
                      })()
                    ) : (
                      "Untuk mode \"Struktur\" - jelaskan topik secara umum. Untuk mode \"Konten\" - masukkan bab/sub bab spesifik yang ingin diisi."
                    )}
                  </Text>
                </Stack>
              </Paper>

              {/* AI Templates Grid - dengan logika khusus untuk Continue mode */}
              <Stack gap="md">
                <Text fw={500} size="lg" c="dimmed">
                  Pilih mode generate:
                </Text>
                
                <SimpleGrid cols={2} spacing="lg">
                  {(() => {
                    // Jika Continue mode dan ada struktur, prioritaskan Content mode
                    if (aiMode === "continue") {
                      const existing = analyzeExistingContent();
                      if (existing.hasStructure) {
                        return [
                          {
                            title: "Isi Konten", 
                            description: "Isi detail untuk bab/sub bab yang sudah ada",
                            type: "content",
                            color: "green", 
                            icon: IconEdit,
                            defaultPrompt: "Isi konten detail untuk semua bab dan sub bab"
                          },
                          {
                            title: "Struktur Tambahan",
                            description: "Tambah bab/sub bab baru ke struktur",
                            type: "structure",
                            color: "blue",
                            icon: IconList,
                            defaultPrompt: "Tambahkan bab dan sub bab baru"
                          }
                        ];
                      }
                    }
                    // Default templates
                    return aiTemplates;
                  })().map((template) => (
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
                        // Pass shouldClearEditor berdasarkan AI mode
                        handleAIGeneration(finalPrompt, template.type, aiMode === "new");
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
                  {aiMode === "continue" && (
                    <Badge size="sm" color="green" variant="light" ml="sm">
                      Mode Lanjutkan
                    </Badge>
                  )}
                </Text>
                <CopyButton value={generatedContent} timeout={2000}>
                  {({ copied, copy }) => (
                    <Button
                      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      variant="light"
                      color={copied ? "teal" : "gray"}
                      onClick={copy}
                      size="sm"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  )}
                </CopyButton>
              </Group>

              {/* Enhanced Content Preview */}
              <Paper 
                p="lg" 
                radius="md" 
                style={{ 
                  maxHeight: '400px', 
                  overflow: 'auto',
                  border: `1px solid ${computedColorScheme === "dark" ? "#495057" : "#dee2e6"}`,
                  background: computedColorScheme === "dark" ? "#2c2e33" : "#f8f9fa",
                }}
              >
                <Text 
                  style={{ 
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.6,
                  }}
                  size="sm"
                >
                  {generatedContent}
                </Text>
              </Paper>

              {/* Action Buttons dengan opsi berdasarkan mode */}
              <Group gap="md" grow>
                <Button
                  size="lg"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  leftSection={<IconPencil size={20} />}
                  onClick={() => insertContentToEditor(aiMode === "continue")}
                  style={{ 
                    height: '50px',
                    fontWeight: 600,
                  }}
                >
                  {aiMode === "continue" ? "Tambahkan ke Editor" : "Masukkan ke Editor"}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  color="gray"
                  leftSection={<IconSparkles size={20} />}
                  onClick={() => {
                    setGeneratedContent("");
                    setPrompt("");
                  }}
                  style={{ 
                    height: '50px',
                    fontWeight: 600,
                  }}
                >
                  Generate Ulang
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
}