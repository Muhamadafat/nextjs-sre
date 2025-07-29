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
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
  Overlay,
} from "@mantine/core";
import { useDisclosure, useClickOutside } from "@mantine/hooks";
import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconList,
  IconPencil,
  IconSparkles,
  IconWand,
  IconFileText,
  IconBulb,
  IconPencilPlus,
} from "@tabler/icons-react";
import { generateText } from "ai";
import React from "react";
import dynamic from "next/dynamic";

// Interfaces
interface BlockNoteEditorProps {
  onContentChange?: (content: any[]) => void;
  style?: React.CSSProperties;
}

interface ContinueWritingState {
  isVisible: boolean;
  position: { x: number; y: number };
  currentBlock: any;
  contextText: string;
}

interface InlineAIState {
  isVisible: boolean;
  position: { x: number; y: number };
  currentBlock: any;
  query: string;
}

// Loading component
const EditorLoading = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '400px',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa'
  }}>
    <Stack align="center" gap="md">
      <Loader size="lg" color="blue" />
      <Text size="sm" c="dimmed">Memuat Editor...</Text>
    </Stack>
  </div>
);

// Main component
function BlockNoteEditorComponent({
  onContentChange,
  style,
}: BlockNoteEditorProps) {
  const computedColorScheme = useComputedColorScheme("light");
  
  // Hydration check
  const [isMounted, setIsMounted] = React.useState(false);
  
  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Core states
  const [isAILoading, setIsAILoading] = React.useState(false);
  const [aiModalOpened, { open: openAIModal, close: closeAIModal }] = useDisclosure(false);
  const [prompt, setPrompt] = React.useState("");
  const [generatedContent, setGeneratedContent] = React.useState("");
  const [aiMode, setAIMode] = React.useState<"new" | "continue">("new");
  const [isAutoContinuing, setIsAutoContinuing] = React.useState(false);

  // Simple typing animation state
  const [isTyping, setIsTyping] = React.useState(false);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Continue writing state
  const [continueState, setContinueState] = React.useState<ContinueWritingState>({
    isVisible: false,
    position: { x: 0, y: 0 },
    currentBlock: null,
    contextText: ""
  });
  const continueRef = useClickOutside(() => setContinueState(prev => ({ ...prev, isVisible: false })));

  // Inline AI state
  const [inlineAIState, setInlineAIState] = React.useState<InlineAIState>({
    isVisible: false,
    position: { x: 0, y: 0 },
    currentBlock: null,
    query: "",
  });
  const inlineAIRef = useClickOutside(() => setInlineAIState(prev => ({ ...prev, isVisible: false })));

  // AI Model setup
  const aiModel = React.useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      
      if (!apiKey) {
        console.warn("NEXT_PUBLIC_GROQ_API_KEY tidak ditemukan. Fitur AI akan dinonaktifkan.");
        return null;
      }
      
      const groq = createGroq({
        apiKey: apiKey,
      });
      
      return groq("llama-3.3-70b-versatile");
    } catch (error) {
      console.error("Error initializing AI model:", error);
      return null;
    }
  }, []);

  // BlockNote Editor setup
  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "paragraph",
        content: "",
      },
    ],
    uploadFile: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: body,
        });
        const json = await response.json();
        return json.url;
      } catch (error) {
        console.error("Upload gagal:", error);
        return "";
      }
    },
  });

  // AI Templates - FIXED DESCRIPTIONS
  const aiTemplates = [
    {
      title: "Buat Struktur", 
      description: "Kerangka lengkap dengan judul dan sub-judul",
      type: "structure",
      color: "blue", 
      icon: IconList,
      defaultPrompt: "Buat kerangka untuk artikel"
    },
    {
      title: "Isi Konten",
      description: "Konten paragraf lengkap tanpa judul/struktur",
      type: "content", 
      color: "green",
      icon: IconEdit,
      defaultPrompt: "Tulis konten detail tentang"
    }
  ];

  // Inline AI suggestions
  const inlineAISuggestions = [
    {
      icon: <IconPencilPlus size={16} />,
      title: "Lanjutkan Menulis",
      description: "AI akan melanjutkan dari tempat Anda berhenti",
      action: "continue"
    },
    {
      icon: <IconFileText size={16} />,
      title: "Buat Ringkasan",
      description: "Buat ringkasan dari konten yang ada",
      action: "summarize"
    },
    {
      icon: <IconBulb size={16} />,
      title: "Tulis Sesuatu...",
      description: "Minta AI menulis konten khusus",
      action: "write_anything"
    }
  ];

  // Simple typing function
  const typeText = async (text: string, targetBlock: any): Promise<void> => {
    return new Promise((resolve) => {
      setIsTyping(true);
      let index = 0;
      
      const typeNextChar = () => {
        if (index <= text.length) {
          const currentText = text.substring(0, index);
          
          try {
            editor.updateBlock(targetBlock, {
              type: targetBlock.type,
              content: currentText,
              ...(targetBlock.props && { props: targetBlock.props })
            });
          } catch (error) {
            console.warn("Error memperbarui blok:", error);
          }

          index++;
          
          if (index <= text.length) {
            typingTimeoutRef.current = setTimeout(typeNextChar, 5);
          } else {
            setIsTyping(false);
            resolve();
          }
        }
      };

      typeNextChar();
    });
  };

  // Simple batch typing
  const typeBlocks = async (blocks: { text: string; type: string; props?: any }[], insertAfterBlock: any): Promise<void> => {
    setIsAutoContinuing(true);
    
    try {
      let currentBlock = insertAfterBlock;
      
      for (const blockData of blocks) {
        const newBlock = {
          type: blockData.type as any,
          content: "",
          ...(blockData.props && { props: blockData.props })
        };

        await editor.insertBlocks([newBlock], currentBlock, "after");
        
        const allBlocks = editor.document;
        const currentIndex = allBlocks.findIndex(block => block.id === currentBlock.id);
        const insertedBlock = allBlocks[currentIndex + 1];

        if (insertedBlock && blockData.text) {
          await typeText(blockData.text, insertedBlock);
          currentBlock = insertedBlock;
        }
      }
    } catch (error) {
      console.error("Error mengetik:", error);
    } finally {
      setIsAutoContinuing(false);
    }
  };

  // Stop typing
  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    setIsAutoContinuing(false);
  };

  // Utility function to extract text from any block
  const extractTextFromBlock = (block: any): string => {
    try {
      if (!block) return "";
      
      if (typeof block.content === 'string') {
        return block.content;
      }
      
      if (Array.isArray(block.content)) {
        return block.content
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              if ('text' in item) return item.text;
              if ('content' in item && typeof item.content === 'string') return item.content;
            }
            return '';
          })
          .join('').trim();
      }
      
      return "";
    } catch (error) {
      console.error("Error mengekstrak teks dari blok:", error);
      return "";
    }
  };

  // Extract context from cursor position
  const extractContextFromCursor = (): string => {
    try {
      const cursorPosition = editor.getTextCursorPosition();
      if (!cursorPosition) return "";
      
      const currentBlock = cursorPosition.block;
      const allBlocks = editor.document;
      const currentIndex = allBlocks.findIndex(block => block.id === currentBlock.id);
      
      const contextBlocks = allBlocks.slice(Math.max(0, currentIndex - 3), currentIndex + 1);
      
      let context = "";
      contextBlocks.forEach(block => {
        const text = extractTextFromBlock(block);
        if (text) {
          if (block.type === "heading") {
            context += `\n# ${text}\n`;
          } else {
            context += `${text}\n`;
          }
        }
      });
      
      return context.trim();
    } catch (error) {
      console.error("Error mengekstrak konteks:", error);
      return "";
    }
  };

  // Check if should show continue button
  const shouldShowContinueButton = (block: any): boolean => {
    try {
      if (!block) return false;
      
      if (block.type === "heading") {
        return true;
      }
      
      if (block.type === "paragraph") {
        const text = extractTextFromBlock(block);
        if (text.length >= 5) {
          return true;
        }
      }
      
      if (block.type === "bulletListItem" || block.type === "numberedListItem") {
        const text = extractTextFromBlock(block);
        if (text.length >= 3) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  };

  // Insert AI content with typing animation
  const insertAIContentAtCursor = async (text: string, currentBlock: any) => {
    try {
      if (!text || !text.trim()) return;
      
      const lines = text.split('\n').filter((line: string) => line.trim());
      if (lines.length === 0) return;
      
      const blocksToType = lines.map((line: string) => {
        const trimmedLine = line.trim();
        
        const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
          return {
            text: headingMatch[2],
            type: "heading",
            props: { level },
          };
        }
        
        if (trimmedLine.match(/^[\*\-]\s+/)) {
          return {
            text: trimmedLine.replace(/^[\*\-]\s+/, ''),
            type: "bulletListItem",
          };
        }
        
        if (trimmedLine.match(/^\d+\.\s+/)) {
          return {
            text: trimmedLine.replace(/^\d+\.\s+/, ''),
            type: "numberedListItem",
          };
        }
        
        return {
          text: trimmedLine,
          type: "paragraph",
        };
      });

      await typeBlocks(blocksToType, currentBlock);

      // TRIGGER CONTENT CHANGE AFTER TYPING
      setTimeout(() => {
        if (onContentChange) {
          onContentChange(editor.document);
        }
      }, 100);

    } catch (error) {
      console.error("Error memasukkan konten:", error);
    }
  };

  // Handle inline AI trigger
  const handleInlineAITrigger = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      setInlineAIState(prev => ({ ...prev, isVisible: false }));
      
      setTimeout(() => {
        const cursorPosition = editor.getTextCursorPosition();
        
        if (!cursorPosition) {
          console.warn("Posisi kursor tidak ditemukan");
          return;
        }

        const selection = window.getSelection();
        let rect = { left: 100, top: 100, bottom: 100, right: 100 };

        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          rect = range.getBoundingClientRect();
        }
        
        let finalX = rect.left;
        let finalY = rect.bottom + 8;
        
        const popupWidth = 320;
        const popupHeight = 280;
        const margin = 20;
        
        if (finalX + popupWidth > window.innerWidth - margin) {
          finalX = Math.max(margin, window.innerWidth - popupWidth - margin);
        }
        
        if (finalY + popupHeight > window.innerHeight - margin) {
          finalY = Math.max(margin, rect.top - popupHeight - 8);
        }
        
        setInlineAIState({
          isVisible: true,
          position: { x: finalX, y: finalY },
          currentBlock: cursorPosition.block,
          query: ""
        });
        
      }, 50);
      
    } catch (error) {
      console.error("Error memicu inline AI:", error);
      setInlineAIState({
        isVisible: true,
        position: { x: 100, y: 100 },
        currentBlock: null,
        query: ""
      });
    }
  }, [editor]);

  // Handle inline AI actions
  const handleInlineAIAction = async (action: string) => {
    const cursorPosition = editor.getTextCursorPosition();
    const currentBlock = cursorPosition?.block;
    
    if (!aiModel || !currentBlock) {
      console.error("Model AI atau blok saat ini tidak tersedia");
      alert("❌ Model AI tidak tersedia. Silakan periksa konfigurasi API key.");
      return;
    }

    setInlineAIState(prev => ({ ...prev, isVisible: false }));
    setContinueState(prev => ({ ...prev, isVisible: false }));
    setIsAutoContinuing(true);

    try {
      let systemPrompt = "";

      switch (action) {
        case "continue":
          const contextText = extractContextFromCursor();
          systemPrompt = `Lanjutkan penulisan dari konteks berikut:

KONTEKS: ${contextText}

INSTRUKSI:
- Tulis 1-2 paragraf yang mengalir natural
- Gunakan bahasa Indonesia yang natural
- Berikan informasi yang valuable
- HANYA tulis dalam bentuk paragraf, jangan gunakan heading atau list`;
          break;

        case "summarize":
          const editorBlocks = editor.document;
          let contextContent = "";
          
          editorBlocks.forEach(block => {
            const text = extractTextFromBlock(block);
            if (text) {
              if (block.type === "heading") {
                const level = block.props?.level || 1;
                const headingPrefix = '#'.repeat(level);
                contextContent += `\n${headingPrefix} ${text}\n`;
              } else {
                contextContent += `${text}\n`;
              }
            }
          });

          systemPrompt = `Buat ringkasan dari konten berikut:

${contextContent}

INSTRUKSI:
- Buat ringkasan dalam 2-3 paragraf
- Tangkap poin-poin utama
- Gunakan bahasa yang jelas dan ringkas
- HANYA tulis dalam bentuk paragraf, jangan gunakan heading atau list`;
          break;

        case "write_anything":
          setAIMode("continue");
          openAIModal();
          setIsAutoContinuing(false);
          return;

        default:
          setIsAutoContinuing(false);
          return;
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: systemPrompt,
        maxTokens: 500,
        temperature: 0.7,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1,
      });

      if (text && text.trim()) {
        await insertAIContentAtCursor(text, currentBlock);
      }

    } catch (error) {
      console.error("Aksi inline AI gagal:", error);
      alert("❌ Gagal menggunakan AI. Silakan coba lagi.");
    } finally {
      setIsAutoContinuing(false);
    }
  };

  // Handle selection change
  const handleSelectionChange = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const cursorPosition = editor.getTextCursorPosition();
      if (!cursorPosition) {
        setContinueState(prev => ({ ...prev, isVisible: false }));
        setInlineAIState(prev => ({ ...prev, isVisible: false }));
        return;
      }

      const currentBlock = cursorPosition.block;
      
      if (shouldShowContinueButton(currentBlock)) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const contextText = extractContextFromCursor();
          
          setContinueState({
            isVisible: true,
            position: { x: rect.right + 10, y: rect.bottom + 5 },
            currentBlock,
            contextText
          });
          
          setInlineAIState(prev => ({ 
            ...prev, 
            currentBlock,
            isVisible: false
          }));
        }
      } else {
        setContinueState(prev => ({ ...prev, isVisible: false }));
        setInlineAIState(prev => ({ ...prev, isVisible: false }));
      }
    } catch (error) {
      console.error("Error menangani perubahan seleksi:", error);
      setContinueState(prev => ({ ...prev, isVisible: false }));
      setInlineAIState(prev => ({ ...prev, isVisible: false }));
    }
  }, [editor]);

  // Setup selection change listener
  React.useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;
    
    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = editor.onChange?.(handleSelectionChange);
    } catch (error) {
      console.error("Error menyiapkan listener perubahan editor:", error);
    }
    
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editor, handleSelectionChange, isMounted]);

  // AI Generation function - FIXED CONTENT MODE
  const generateAIContent = async (prompt: string, type: string = "structure") => {
    if (!aiModel) {
      alert("❌ Model AI tidak tersedia. Silakan periksa konfigurasi API key.");
      return null;
    }
    
    setIsAILoading(true);
    try {
      let systemPrompt = "";
      
      if (aiMode === "continue") {
        const editorBlocks = editor.document;
        let contextContent = "";
        
        editorBlocks.forEach(block => {
          const text = extractTextFromBlock(block);
          if (text) {
            if (block.type === "heading") {
              const level = block.props?.level || 1;
              const headingPrefix = '#'.repeat(level);
              contextContent += `\n${headingPrefix} ${text}\n`;
            } else {
              contextContent += `${text}\n`;
            }
          }
        });

        systemPrompt = `Anda adalah AI writer yang akan melanjutkan konten yang sudah ada di editor.

KONTEN YANG SUDAH ADA:
${contextContent}

TUGAS ANDA:
1. Analisis struktur dan konten yang sudah ada
2. Identifikasi heading/subheading yang masih kosong atau perlu dilengkapi
3. Lanjutkan dengan menulis konten yang natural dan coherent
4. Fokus pada heading yang belum memiliki konten atau konten yang masih singkat

INSTRUKSI PENULISAN:
- Tulis konten dalam format yang sama (gunakan # ## ### untuk heading)
- Setiap heading yang kosong atau singkat, isi dengan 2-3 paragraf detail
- Jaga konsistensi tone dan style dengan konten yang sudah ada
- Berikan informasi yang valuable dan mendalam
- Jangan mengulang informasi yang sudah ada

KONTEKS TAMBAHAN: ${prompt}`;
      } else {
        if (type === "structure") {
          // Mode Struktur - Generate outline dengan headings
          systemPrompt = `Buat kerangka struktur lengkap dengan judul dan sub-judul untuk topik: ${prompt}

ATURAN STRUKTUR JUDUL:
- Gunakan # untuk judul utama (hanya 1)
- Gunakan ## untuk bab-bab utama (level 2) 
- Gunakan ### untuk sub-bab (level 3)
- Gunakan #### untuk detail bagian (level 4)
- Jangan skip level judul

INSTRUKSI PENTING:
- HANYA tulis judul dan sub-judul
- JANGAN tulis konten paragraf apapun
- TIDAK ada penjelasan atau deskripsi di bawah judul
- Fokus pada struktur yang logis dan terorganisir

TUGAS:
Buat HANYA struktur judul untuk "${prompt}" tanpa konten apapun.`;

        } else if (type === "content") {
          // Mode Konten - Generate text paragraf saja tanpa struktur
          systemPrompt = `Tulis artikel lengkap dalam bentuk paragraf tentang: ${prompt}

INSTRUKSI SANGAT PENTING:
- HANYA tulis dalam bentuk paragraf text biasa
- JANGAN gunakan judul (#), sub-judul (##), atau format struktur apapun
- JANGAN gunakan bullet points (•, -, *) atau numbered list (1., 2., 3.)
- JANGAN gunakan format markdown apapun
- Tulis konten yang mengalir dalam bentuk paragraf yang berkesinambungan
- Gunakan bahasa Indonesia yang natural, formal, dan mudah dipahami
- Buat 5-7 paragraf dengan konten yang mendalam dan informatif
- Setiap paragraf minimal 4-5 kalimat yang substantial
- Fokus pada konten yang valuable, detail, dan educational
- Jangan gunakan format apapun selain text paragraf biasa

FORMAT YANG DIINGINKAN:
Paragraf pertama membahas pengenalan topik dengan detail yang komprehensif. Jelaskan konteks dan background yang relevan dengan topik yang dibahas.

Paragraf kedua menjelaskan aspek pertama dari topik dengan detail yang mendalam. Berikan informasi yang specific dan actionable untuk pembaca.

Paragraf ketiga menguraikan aspek kedua dengan contoh-contoh konkret dan practical. Pastikan informasi yang diberikan relevan dan berguna.

Dan seterusnya untuk paragraf berikutnya...

TUGAS:
Tulis konten artikel tentang "${prompt}" dalam bentuk paragraf text murni tanpa format apapun.`;
        }
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: systemPrompt,
        maxTokens: aiMode === "continue" ? 4000 : (type === "content" ? 1500 : 1000),
        temperature: 0.7,
        presencePenalty: 0.1,
        frequencyPenalty: 0.1,
      });
      
      setGeneratedContent(text);
      return text;
    } catch (error) {
      console.error("Generasi AI gagal:", error);
      alert("❌ Gagal menghasilkan konten AI. Silakan coba lagi.");
      return null;
    } finally {
      setIsAILoading(false);
    }
  };

  // Close modal and reset
  const closeModalAndReset = () => {
    closeAIModal();
    setPrompt("");
    setGeneratedContent("");
    setAIMode("new");
  };

  // Handle AI generation
  const handleAIGeneration = async (inputPrompt: string, type: string = "structure", shouldClearEditor: boolean = true) => {
    if (!inputPrompt.trim()) {
      alert("⚠️ Silakan masukkan topik atau kata kunci sebelum generate konten!");
      return;
    }
    
    if (shouldClearEditor) {
      try {
        const currentBlocks = editor.document;
        
        if (currentBlocks.length > 0) {
          if (currentBlocks.length > 1) {
            const blocksToRemove = currentBlocks.slice(1);
            editor.removeBlocks(blocksToRemove);
          }
          
          const firstBlock = editor.document[0];
          if (firstBlock) {
            editor.updateBlock(firstBlock, {
              type: "paragraph",
              content: "",
            });
          }
        }

        // TRIGGER CONTENT CHANGE AFTER CLEARING
        setTimeout(() => {
          if (onContentChange) {
            onContentChange(editor.document);
          }
        }, 50);

      } catch (error) {
        console.log("Penyesuaian pembersihan editor:", error);
      }
    }
    
    await generateAIContent(inputPrompt, type);
  };

  // Insert content to editor - FIXED WITH PROPER CONTENT CHANGE TRIGGER
  const insertContentToEditor = async (shouldAppend: boolean = false) => {
    if (!generatedContent || !generatedContent.trim()) {
      console.warn("Tidak ada konten yang dihasilkan untuk dimasukkan");
      return;
    }

    try {
      const lines = generatedContent.split('\n').filter((line: string) => line.trim());
      
      if (lines.length === 0) {
        console.warn("Tidak ada baris yang valid untuk dimasukkan");
        return;
      }
      
      const blocksToInsert: any[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
          const headingText = headingMatch[2].trim();
          
          blocksToInsert.push({
            type: "heading" as const,
            content: headingText,
            props: { level },
          });
        }
        else if (line.match(/^[\*\-]\s+/)) {
          const listText = line.replace(/^[\*\-]\s+/, '').trim();
          blocksToInsert.push({
            type: "bulletListItem" as const,
            content: listText,
          });
        }
        else if (line.match(/^\d+\.\s+/)) {
          const listText = line.replace(/^\d+\.\s+/, '').trim();
          blocksToInsert.push({
            type: "numberedListItem" as const,
            content: listText,
          });
        }
        else {
          blocksToInsert.push({
            type: "paragraph" as const,
            content: line,
          });
        }
      }
      
      if (blocksToInsert.length > 0) {
        if (!shouldAppend) {
          await editor.replaceBlocks(editor.document, blocksToInsert);
          
          setTimeout(() => {
            try {
              const firstBlock = editor.document[0];
              if (firstBlock) {
                editor.setTextCursorPosition(firstBlock, "start");
              }

              // MANUALLY TRIGGER CONTENT CHANGE
              if (onContentChange) {
                onContentChange(editor.document);
              }
            } catch (e) {
              console.log("Penyesuaian posisi kursor:", e);
            }
          }, 100);
        }
      }
      
      closeModalAndReset();
    } catch (error) {
      console.error("Error memasukkan konten:", error);
      alert("❌ Terjadi kesalahan saat memasukkan konten ke editor. Silakan coba lagi.");
    }
  };

  // Custom AI Slash Menu Items
  const getCustomAISlashMenuItems = React.useMemo(() => {
    if (!aiModel) return [];
    
    return [
      {
        title: "Generator AI",
        onItemClick: () => {
          setAIMode("new");
          openAIModal();
        },
        aliases: ["generate", "write", "tulis"],
        group: "Alat AI",
        subtext: "Buat konten baru",
        icon: <IconEdit size={18} />,
      },
      {
        title: "Tanya AI apa saja...",
        onItemClick: () => {
          setTimeout(() => {
            handleInlineAITrigger();
          }, 100);
        },
        aliases: ["ai", "assistant", "ask", "help"],
        group: "Alat AI",
        // subtext: "Saran dan aksi AI",
        icon: <IconSparkles size={18} />,
      }
    ];
  }, [aiModel, handleInlineAITrigger, openAIModal]);

  // Custom Slash Menu Items
  const getCustomSlashMenuItems = React.useMemo(() => {
    const baseItems = getDefaultReactSlashMenuItems(editor);
    
    const orderedItems = [
      ...getCustomAISlashMenuItems,
      ...baseItems.filter(item => 
        ['Heading 1', 'Heading 2', 'Heading 3'].includes(item.title)
      ),
      ...baseItems.filter(item => 
        ['Numbered List', 'Bulleted List', 'Bullet List'].includes(item.title)
      ),
      ...baseItems.filter(item => 
        ['Table', 'Divider'].includes(item.title)
      )
    ];

    return orderedItems;
  }, [editor, getCustomAISlashMenuItems]);

  // Handle content changes - ENHANCED
  React.useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;
    
    const handleChange = () => {
      if (onContentChange) {
        // Small delay to ensure content is fully updated
        setTimeout(() => {
          onContentChange(editor.document);
        }, 10);
      }
    };

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = editor.onChange?.(handleChange);
    } catch (error) {
      console.error("Error menyiapkan listener perubahan konten:", error);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [editor, onContentChange, isMounted]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopTyping();
    };
  }, []);

  // Show loading until component is mounted (hydrated)
  if (!isMounted) {
    return <EditorLoading />;
  }

  return (
    <>
      <div style={{ position: 'relative', height: '100%', ...style }}>
        <div style={{ height: '100%', overflow: 'auto' }}>
          <BlockNoteView
            editor={editor}
            slashMenu={false}
            theme={computedColorScheme}
          >
            <SuggestionMenuController
              triggerCharacter={"/"}
              getItems={async (query) =>
                filterSuggestionItems(
                  getCustomSlashMenuItems,
                  query
                )
              }
            />
          </BlockNoteView>
        </div>

        {/* Inline AI Suggestions Popup */}
        {inlineAIState.isVisible && (
          <div
            ref={inlineAIRef}
            style={{
              position: 'absolute',
              left: inlineAIState.position.x,
              top: inlineAIState.position.y,
              zIndex: 1000,
              pointerEvents: 'auto',
              maxWidth: '320px'
            }}
          >
            <div
              style={{
                backgroundColor: computedColorScheme === "dark" ? "#2c2e33" : "#ffffff",
                border: `2px solid ${computedColorScheme === "dark" ? "#495057" : "#e9ecef"}`,
                borderRadius: "12px",
                boxShadow: computedColorScheme === "dark" 
                  ? "0 8px 20px rgba(0, 0, 0, 0.4)" 
                  : "0 8px 20px rgba(0, 0, 0, 0.15)",
                padding: "8px",
                minWidth: "280px",
                maxHeight: "280px",
                overflowY: "auto"
              }}
            >
              {/* Header */}
              <div style={{ 
                padding: '12px 16px', 
                borderBottom: `1px solid ${computedColorScheme === "dark" ? "#495057" : "#e9ecef"}`,
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconSparkles size={16} color={computedColorScheme === "dark" ? "#9ca3af" : "#6b7280"} />
                  <span style={{ 
                    color: computedColorScheme === "dark" ? "#9ca3af" : "#6b7280", 
                    fontSize: '14px', 
                    fontWeight: 500 
                  }}>
                    Tanya AI apa saja...
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {inlineAISuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      handleInlineAIAction(suggestion.action);
                    }}
                    style={{
                      all: 'unset',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'transparent',
                      color: computedColorScheme === "dark" ? '#e5e7eb' : '#374151',
                      border: '2px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = computedColorScheme === "dark" ? '#495057' : '#f8f9fa';
                      e.currentTarget.style.borderColor = computedColorScheme === "dark" ? '#6c757d' : '#dee2e6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '16px', display: 'flex', alignItems: 'center' }}>
                      {suggestion.icon}
                    </span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: 500, 
                        marginBottom: '2px',
                        color: computedColorScheme === "dark" ? '#e5e7eb' : '#374151'
                      }}>
                        {suggestion.title}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: computedColorScheme === "dark" ? '#9ca3af' : '#6b7280'
                      }}>
                        {suggestion.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Auto Continue Writing Button */}
        {continueState.isVisible && !isAutoContinuing && (
          <div
            ref={continueRef}
            style={{
              position: 'absolute',
              left: continueState.position.x,
              top: continueState.position.y,
              zIndex: 999,
              pointerEvents: 'auto'
            }}
          >
            <Tooltip label="Lanjutkan menulis dengan AI" position="top">
              <ActionIcon
                size="lg"
                radius="xl"
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                onClick={() => handleInlineAIAction('continue')}
                style={{
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  animation: 'pulse 2s infinite'
                }}
              >
                <IconWand size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        )}

        {/* Simple loading overlay */}
        {isAutoContinuing && (
          <Overlay opacity={0.3}>
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              background: computedColorScheme === "dark" ? "#2a2a2a" : "white",
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)'
            }}>
              <Group gap="md">
                <Loader size="md" color="blue" />
                <Text fw={500} c="blue">
                  {isTyping ? 'AI sedang mengetik...' : 'AI sedang berpikir...'}
                </Text>
              </Group>
            </div>
          </Overlay>
        )}
      </div>

      {/* AI Modal */}
      <Modal
        opened={aiModalOpened}
        onClose={closeModalAndReset}
        title={
          <Group gap="md">
            <ThemeIcon size="lg" gradient={{ from: 'blue', to: 'cyan' }} variant="gradient">
              <IconSparkles size={20} />
            </ThemeIcon>
            <Text fw={700} size="xl">
              {aiMode === "continue" ? "AI Lanjutan Konten" : "Generator Konten AI"}
            </Text>
          </Group>
        }
        size="xl"
        radius="lg"
        padding="xl"
        centered
        styles={{
          content: { borderRadius: '16px' },
          header: { borderBottom: `2px solid ${computedColorScheme === "dark" ? "#404040" : "#dee2e6"}` }
        }}
      >
        <Stack gap="xl">
          {!generatedContent ? (
            <>
              {/* Prompt Input */}
              <Paper p="lg" radius="md" bg={computedColorScheme === "dark" ? "dark.6" : "gray.1"}>
                <Stack gap="md">
                  <Text fw={500} size="md">
                    💡 Topik atau Kata Kunci
                  </Text>
                  <Textarea
                    placeholder="Masukkan topik yang ingin Anda buat - contoh: 'Kecerdasan Buatan dalam Pendidikan'"
                    value={prompt}
                    onChange={(event) => setPrompt(event.currentTarget.value)}
                    minRows={3}
                    maxRows={6}
                    autosize
                    size="md"
                    styles={{
                      input: {
                        fontSize: '14px',
                        lineHeight: 1.5,
                        border: `1px solid ${computedColorScheme === "dark" ? "#495057" : "#ced4da"}`,
                      }
                    }}
                  />
                </Stack>
              </Paper>

              {/* Info untuk AI Lanjutan */}
              {aiMode === "continue" && (
                <Paper p="lg" radius="md" bg="blue.0">
                  <Stack gap="md">
                    <Text fw={500} size="md" c="blue">
                      🤖 AI akan otomatis melanjutkan konten yang sudah ada
                    </Text>
                    <Text size="sm" c="blue">
                      AI akan menganalisis judul/sub-judul di editor dan melengkapi konten yang masih kosong atau singkat.
                    </Text>
                  </Stack>
                </Paper>
              )}

              {/* AI Templates Grid */}
              <Stack gap="md">
                <Text fw={500} size="lg" c="dimmed">
                  Pilih mode pembuatan:
                </Text>
                
                <SimpleGrid cols={aiMode === "continue" ? 1 : 2} spacing="lg">
                  {(() => {
                    if (aiMode === "continue") {
                      return [{
                        title: "Lanjutkan Konten", 
                        description: "AI akan melengkapi judul yang masih kosong dengan konten detail",
                        type: "content",
                        color: "green", 
                        icon: IconEdit,
                        defaultPrompt: "Lanjutkan dan lengkapi konten"
                      }];
                    }
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
                      onClick={() => {
                        const finalPrompt = prompt.trim() || template.defaultPrompt;
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

              {/* Tips Section */}
              {!isAILoading && (
                <Paper p="lg" radius="md" bg="blue.0" style={{ border: '1px solid #e3f2fd' }}>
                  <Group gap="sm" align="flex-start">
                    <IconBulb size={20} style={{ color: '#1976d2', marginTop: 2 }} />
                    <div>
                      <Text fw={600} size="sm" c="blue.8" mb="xs">
                        💡 Perbedaan Mode Pembuatan:
                      </Text>
                      <Text size="xs" c="blue.7" style={{ lineHeight: 1.5 }}>
                        • <strong>Buat Struktur:</strong> Menghasilkan kerangka judul/sub-judul saja (ideal untuk perencanaan)<br/>
                        • <strong>Isi Konten:</strong> Menghasilkan artikel lengkap dalam paragraf teks (tanpa judul)<br/>
                        • Gunakan kata kunci yang spesifik untuk hasil yang lebih relevan<br/>
                        • Anda bisa mengedit hasil pembuatan sebelum memasukkan ke editor
                      </Text>
                    </div>
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
                      {copied ? "Disalin!" : "Salin"}
                    </Button>
                  )}
                </CopyButton>
              </Group>

              {/* Content Preview */}
              <Paper 
                p="lg" 
                radius="md" 
                style={{ 
                  height: '500px',
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

              {/* Action Buttons */}
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
                  Buat Ulang
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
}

// Export with dynamic import to avoid SSR issues
const BlockNoteEditorWithNoSSR = dynamic(
  () => Promise.resolve(BlockNoteEditorComponent),
  {
    ssr: false,
    loading: () => <EditorLoading />
  }
);

export default BlockNoteEditorWithNoSSR;