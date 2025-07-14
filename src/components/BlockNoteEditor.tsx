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
  IconEdit, // Fixed: Use IconEdit instead of IconWrite
  IconList,
  IconPalette,
  IconPencil,
  IconQuestionMark,
  IconRobot,
  IconSparkles
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

  // Enhanced AI generation dengan format markdown yang proper dan lengkap
  const generateAIContent = async (prompt: string, type: string = "general") => {
    if (!aiModel) return null;
    
    setIsAILoading(true);
    try {
      let systemPrompt = "";
      
      switch (type) {
        case "blog":
          systemPrompt = `Tulis artikel blog komprehensif dan LENGKAP tentang: ${prompt}. 
          WAJIB gunakan format markdown dengan struktur LENGKAP:
          # Judul Utama
          
          ## Pendahuluan
          [konten pendahuluan yang menarik dan detail, minimal 2-3 paragraf]
          
          ## Poin Utama 1
          [konten detail dengan penjelasan LENGKAP, contoh, dan analisis mendalam]
          
          ## Poin Utama 2  
          [konten detail dengan penjelasan LENGKAP, contoh, dan analisis mendalam]
          
          ## Poin Utama 3
          [konten detail dengan penjelasan LENGKAP, contoh, dan analisis mendalam]
          
          ## Poin Utama 4
          [konten detail dengan penjelasan LENGKAP jika diperlukan]
          
          ## Kesimpulan
          [kesimpulan yang kuat, actionable, dan komprehensif]
          
          Gunakan bahasa Indonesia yang profesional. PENTING: Berikan penjelasan yang LENGKAP dan TUNTAS untuk setiap bagian. Jangan berhenti di tengah-tengah. Pastikan setiap section memiliki penjelasan yang detail dan komprehensif.`;
          break;
          
        case "summary":
          systemPrompt = `Buat ringkasan informatif yang LENGKAP dan KOMPREHENSIF tentang: ${prompt}. 
          WAJIB gunakan format markdown:
          # Ringkasan: ${prompt}
          
          ## Poin Kunci
          [5-7 poin utama yang paling penting dengan penjelasan LENGKAP untuk setiap poin]
          
          ## Detail Penting
          [penjelasan LENGKAP dan DETAIL untuk setiap aspek penting]
          
          ## Implikasi dan Dampak
          [analisis LENGKAP tentang dampak dan implikasi]
          
          ## Kesimpulan
          [rangkuman final yang KOMPREHENSIF]
          
          PENTING: Berikan informasi yang LENGKAP dan TUNTAS. Jangan potong penjelasan di tengah-tengah.`;
          break;
          
        case "explain":
          systemPrompt = `Jelaskan dengan LENGKAP dan TUNTAS tentang: ${prompt}. 
          WAJIB gunakan format markdown:
          # Penjelasan: ${prompt}
          
          ## Definisi Dasar
          [penjelasan dasar yang LENGKAP dengan bahasa sederhana]
          
          ## Cara Kerja
          [penjelasan DETAIL dan LENGKAP tentang mekanisme atau proses]
          
          ## Contoh Praktis
          [berikan 3-5 contoh nyata yang LENGKAP dan mudah dipahami]
          
          ## Manfaat dan Kegunaan
          [penjelasan LENGKAP tentang kegunaan praktis dalam kehidupan]
          
          ## Tips dan Rekomendasi
          [berikan tips praktis yang LENGKAP dan actionable]
          
          PENTING: Gunakan bahasa sederhana tapi berikan penjelasan yang LENGKAP dan TUNTAS. Jangan berhenti sebelum selesai menjelaskan semua aspek penting.`;
          break;
          
        case "creative":
          systemPrompt = `Tulis konten kreatif yang LENGKAP dan MENARIK tentang: ${prompt}. 
          WAJIB gunakan format markdown:
          # ${prompt}
          
          ## Pembuka yang Menarik
          [hook yang engaging dan menarik perhatian dengan detail yang LENGKAP]
          
          ## Pengembangan Cerita
          [konten utama yang kreatif, imajinatif, dan LENGKAP dengan detail yang kaya]
          
          ## Plot Twist atau Elemen Menarik
          [elemen mengejutkan atau menarik dengan pengembangan yang LENGKAP]
          
          ## Pengembangan Karakter/Konsep
          [pengembangan lebih lanjut yang DETAIL dan LENGKAP]
          
          ## Penutup yang Berkesan
          [ending yang memorable, impactful, dan LENGKAP]
          
          PENTING: Buat konten yang engaging, imajinatif, dan LENGKAP. Kembangkan setiap bagian dengan detail yang kaya dan jangan berhenti di tengah-tengah.`;
          break;
          
        default:
          systemPrompt = `Tulis konten berkualitas tinggi yang LENGKAP dan KOMPREHENSIF tentang: ${prompt}. 
          WAJIB gunakan format markdown dengan struktur heading:
          # Judul Utama
          
          ## Pendahuluan
          [konten pembuka yang LENGKAP dan menarik]
          
          ## Poin Utama 1
          [konten dengan detail yang LENGKAP, contoh, dan analisis]
          
          ## Poin Utama 2
          [konten dengan detail yang LENGKAP, contoh, dan analisis]
          
          ## Poin Utama 3
          [konten dengan detail yang LENGKAP, contoh, dan analisis]
          
          ## Kesimpulan
          [rangkuman dan insight yang LENGKAP dan actionable]
          
          PENTING: Buat konten yang informatif, terstruktur, menarik, dan LENGKAP. Berikan penjelasan yang TUNTAS untuk setiap bagian. Jangan berhenti sebelum menyelesaikan semua aspek penting dari topik ini.`;
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: systemPrompt,
        maxTokens: 3000, // Ditingkatkan dari 1200 ke 3000 untuk konten yang lebih lengkap
        temperature: 0.7, // Ditambahkan untuk variasi yang lebih baik
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
  const handleAIGeneration = async (inputPrompt: string, type: string = "general") => {
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
    
    // Generate AI content
    await generateAIContent(inputPrompt, type);
  };

  // Enhanced insert function dengan parsing markdown formatting yang lengkap
  const insertContentToEditor = () => {
    if (!generatedContent) return;

    try {
      const currentPos = editor.getTextCursorPosition();
      const lines = generatedContent.split('\n').filter(line => line.trim());
      
      let insertedBlocks = 0;
      
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
        
        if (insertedBlocks === 0) {
          // Replace current block
          editor.updateBlock(currentPos.block, blockData);
        } else {
          // Insert new blocks
          const targetBlock = editor.getTextCursorPosition().block;
          editor.insertBlocks([blockData], targetBlock, "after");
          
          // Move cursor
          setTimeout(() => {
            try {
              const blocks = editor.document;
              const lastBlock = blocks[blocks.length - 1];
              if (lastBlock) {
                editor.setTextCursorPosition(lastBlock, "end");
              }
            } catch (e) {
              console.log("Cursor positioning adjustment");
            }
          }, 100);
        }
        
        insertedBlocks++;
      }
      
      closeModalAndReset();
      
      // Simple & Elegant Success Notification dengan delay
      setTimeout(() => {
        const headingCount = lines.filter(line => line.match(/^#{1,6} /)).length;
        showSimpleSuccessNotification(insertedBlocks, headingCount);
      }, 300);
      
    } catch (error) {
      console.error("Error inserting content:", error);
      showErrorPopup();
    }
  };

  // Function untuk parsing inline formatting (bold, italic, dll)
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

  // Simple & Elegant Success Notification
  const showSimpleSuccessNotification = (blocksCount: number, headingsCount: number) => {
    // Create notification container
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #e3f2fd;
      border-left: 4px solid #2196f3;
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      min-width: 300px;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Success content
    notification.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="
          width: 24px;
          height: 24px;
          background: #4caf50;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        ">
          <span style="color: white; font-size: 14px; font-weight: bold;">✓</span>
        </div>
        
        <div style="flex: 1;">
          <div style="
            font-weight: 600;
            color: #1976d2;
            font-size: 14px;
            margin-bottom: 4px;
          ">
            Konten berhasil dimasukkan!
          </div>
          
          <div style="
            color: #666;
            font-size: 13px;
            line-height: 1.4;
          ">
            ${blocksCount} blok ditambahkan, ${headingsCount} heading terdeteksi
          </div>
        </div>
        
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='#f5f5f5'; this.style.color='#333'" onmouseout="this.style.background='none'; this.style.color='#999'">
          ×
        </button>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);

    // Add CSS animations if not exists
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };

  // Simple Error Notification
  const showErrorPopup = () => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #ffebee;
      border-left: 4px solid #f44336;
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      min-width: 300px;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="
          width: 24px;
          height: 24px;
          background: #f44336;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        ">
          <span style="color: white; font-size: 14px; font-weight: bold;">!</span>
        </div>
        
        <div style="flex: 1;">
          <div style="
            font-weight: 600;
            color: #d32f2f;
            font-size: 14px;
            margin-bottom: 4px;
          ">
            Gagal memasukkan konten
          </div>
          
          <div style="
            color: #666;
            font-size: 13px;
            line-height: 1.4;
          ">
            Silakan copy paste manual
          </div>
        </div>
        
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='#f5f5f5'; this.style.color='#333'" onmouseout="this.style.background='none'; this.style.color='#999'">
          ×
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  };

  const closeModalAndReset = () => {
    closeAIModal();
    setPrompt("");
    setGeneratedContent("");
  };

  // Enhanced AI Templates dengan bahasa Indonesia
  const aiTemplates = [
    {
      title: "✍️ Artikel Umum",
      description: "Generate konten apapun",
      type: "general",
      color: "blue",
      icon: IconEdit, // Fixed: Use IconEdit instead of IconWrite
      defaultPrompt: "Dampak teknologi AI terhadap dunia kerja"
    },
    {
      title: "📝 Blog Post",
      description: "Buat artikel blog lengkap",
      type: "blog", 
      color: "green",
      icon: IconPencil,
      defaultPrompt: "Panduan lengkap memulai karir di bidang teknologi"
    },
    {
      title: "📋 Ringkasan",
      description: "Ringkasan singkat dan padat",
      type: "summary",
      color: "orange",
      icon: IconList,
      defaultPrompt: "Tren teknologi terbaru tahun 2024"
    },
    {
      title: "🎯 Penjelasan",
      description: "Penjelasan topik kompleks",
      type: "explain",
      color: "purple",
      icon: IconQuestionMark,
      defaultPrompt: "Blockchain dan cryptocurrency untuk pemula"
    },
    {
      title: "🚀 Konten Kreatif",
      description: "Tulisan kreatif dan menarik",
      type: "creative",
      color: "pink",
      icon: IconPalette,
      defaultPrompt: "Masa depan teknologi dalam 20 tahun mendatang"
    }
  ];

  // Custom AI Slash Menu Items
  const getCustomAISlashMenuItems = () => {
    if (!aiModel) return [];
    
    return [
      {
        title: "🤖 AI Assistant",
        onItemClick: () => {
          openAIModal();
        },
        aliases: ["ai", "assistant", "generate", "write", "tulis"],
        group: "AI Assistant",
        hint: "Buka AI Assistant dengan template",
      }
    ];
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
            {/* Custom Slash Menu dengan AI */}
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                filterSuggestionItems(
                  [
                    ...getDefaultReactSlashMenuItems(editor),
                    ...getCustomAISlashMenuItems(),
                  ],
                  query,
                )
              }
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
            /* Input dan Template Selection */
            <>
              {/* Input Prompt */}
              <Stack gap="sm">
                <Text fw={500} size="md">
                  🎯 Masukkan topik atau kata kunci:
                </Text>
                <Textarea
                  placeholder="Contoh: Artificial Intelligence, Teknologi Blockchain, Tutorial React, dll..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  minRows={3}
                  maxRows={5}
                  radius="md"
                  size="md"
                  styles={{
                    input: {
                      fontSize: '16px',
                      lineHeight: '1.5',
                    }
                  }}
                />
              </Stack>

              {/* Info Box */}
              <Paper p="md" radius="md" bg="blue.0">
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconBulb size={16} style={{ color: '#007BFF' }} />
                    <Text size="sm" fw={500} c="blue">
                      Tips untuk hasil optimal:
                    </Text>
                  </Group>
                  <Text size="xs" c="blue">
                    • Berikan topik yang spesifik untuk konten yang lebih fokus
                    • Gunakan bahasa Indonesia atau Inggris
                    • Semakin detail input Anda, semakin baik hasil AI
                  </Text>
                </Stack>
              </Paper>

              {/* AI Templates Grid */}
              <Stack gap="sm">
                <Text fw={500} size="md" c="dimmed">
                  🎨 Pilih template konten:
                </Text>
                
                <SimpleGrid cols={3} spacing="md">
                  {aiTemplates.map((template) => (
                    <Card
                      key={template.type}
                      p="md"
                      withBorder
                      radius="md"
                      style={{
                        cursor: "pointer",
                        transition: 'all 0.2s ease',
                        height: '120px',
                      }}
                      className="hover:transform hover:scale-105 hover:shadow-lg"
                      onClick={() => {
                        const finalPrompt = prompt.trim() || template.defaultPrompt;
                        handleAIGeneration(finalPrompt, template.type);
                      }}
                    >
                      <Stack gap="xs" align="center" justify="center" h="100%">
                        <ThemeIcon 
                          size="lg" 
                          color={template.color} 
                          variant="light"
                          radius="md"
                        >
                          <template.icon size={20} />
                        </ThemeIcon>
                        <Text size="sm" fw={500} ta="center" lh={1.2}>
                          {template.title}
                        </Text>
                        <Text size="xs" c="dimmed" ta="center">
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
                      color={copied ? 'teal' : 'blue'}
                      variant="light"
                      onClick={copy}
                      size="sm"
                    >
                      {copied ? 'Disalin!' : 'Salin Semua'}
                    </Button>
                  )}
                </CopyButton>
              </Group>

              <Textarea
                value={generatedContent}
                readOnly
                minRows={15}
                maxRows={25}
                radius="md"
                styles={{
                  input: {
                    background: computedColorScheme === "dark" ? "#2a2a2a" : "#f8f9fa",
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    padding: '16px',
                    border: `2px solid ${computedColorScheme === "dark" ? "#404040" : "#e9ecef"}`,
                  }
                }}
              />

              <Paper p="md" radius="md" bg="green.0">
                <Group gap="md">
                  <IconBulb size={20} style={{ color: '#28a745' }} />
                  <div>
                    <Text size="sm" c="green" fw={500}>
                      Konten siap dimasukkan!
                    </Text>
                    <Text size="xs" c="green">
                      Klik "Masukkan ke Editor" untuk menambahkan konten ini langsung ke BlockNote editor dengan struktur heading otomatis
                    </Text>
                  </div>
                </Group>
              </Paper>

              <Group justify="space-between" gap="md">
                <Group gap="md">
                  <Button 
                    variant="light" 
                    color="gray" 
                    onClick={() => {
                      setGeneratedContent("");
                      // Reset prompt untuk generate baru
                      setPrompt("");
                    }}
                    leftSection={<IconPencil size={16} />}
                  >
                    Generate Baru
                  </Button>
                </Group>
                
                <Button 
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  size="md"
                  onClick={insertContentToEditor}
                  leftSection={<IconSparkles size={18} />}
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