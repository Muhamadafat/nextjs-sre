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
} from "@tabler/icons-react";
import { generateText } from "ai";
import React from "react";

// Clean interfaces
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

// Main component
export default function BlockNoteEditorComponent({
  onContentChange,
  style,
}: BlockNoteEditorProps) {
  const computedColorScheme = useComputedColorScheme("light");
  
  // Core states
  const [isAILoading, setIsAILoading] = React.useState(false);
  const [aiModalOpened, { open: openAIModal, close: closeAIModal }] = useDisclosure(false);
  const [prompt, setPrompt] = React.useState("");
  const [generatedContent, setGeneratedContent] = React.useState("");
  const [aiMode, setAIMode] = React.useState<"new" | "continue">("new");
  const [isAutoContinuing, setIsAutoContinuing] = React.useState(false);

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
    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      
      if (!apiKey) {
        console.warn("NEXT_PUBLIC_GROQ_API_KEY not found. AI features will be disabled.");
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
        console.error("Upload failed:", error);
        return "";
      }
    },
  });

  // AI Templates
  const aiTemplates = [
    {
      title: "Buat Struktur", 
      description: "Outline lengkap dengan heading dan sub-heading",
      type: "structure",
      color: "blue", 
      icon: IconList,
      defaultPrompt: "Buat outline untuk artikel"
    },
    {
      title: "Isi Konten",
      description: "Konten detail dan mendalam untuk topik",
      type: "content", 
      color: "green",
      icon: IconEdit,
      defaultPrompt: "Tulis konten detail tentang"
    }
  ];

  // Inline AI suggestions
  const inlineAISuggestions = [
    {
      icon: "✏️",
      title: "Continue Writing",
      description: "AI will continue from where you left off",
      action: "continue"
    },
    {
      icon: "📝",
      title: "Summarize",
      description: "Create a summary of the content",
      action: "summarize"
    },
    {
      icon: "✨",
      title: "Write Anything...",
      description: "Ask AI to write custom content",
      action: "write_anything"
    }
  ];

  // Utility functions
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
        if (block.content && Array.isArray(block.content)) {
          const text = block.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object' && 'text' in item) return item.text;
              return '';
            })
            .join('');
          
          if (text.trim()) {
            if (block.type === "heading") {
              context += `\n# ${text}\n`;
            } else {
              context += `${text}\n`;
            }
          }
        }
      });
      
      return context.trim();
    } catch (error) {
      console.error("Error extracting context:", error);
      return "";
    }
  };

  const shouldShowContinueButton = (block: any): boolean => {
    try {
      if (!block) return false;
      if (block.type !== "paragraph") return false;
      if (!block.content || !Array.isArray(block.content)) return false;
      
      const text = block.content
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'text' in item) return item.text;
          return '';
        })
        .join('').trim();
      
      if (text.length < 10) return false;
      
      const endsWithContinuation = /[.!?,:;]\s*$/.test(text);
      const hasIncompleteThought = text.length > 20 && !endsWithContinuation;
      
      return endsWithContinuation || hasIncompleteThought;
    } catch (error) {
      return false;
    }
  };

  const parseInlineFormatting = (text: string): any[] => {
    if (!text || typeof text !== 'string') return [{ type: "text", text: text || "" }];
    
    const result: any[] = [];
    const patterns = [
      { regex: /\*\*\*(.*?)\*\*\*/g, styles: { bold: true, italic: true } },
      { regex: /\*\*(.*?)\*\*/g, styles: { bold: true } },
      { regex: /\*(.*?)\*/g, styles: { italic: true } },
      { regex: /`(.*?)`/g, styles: { code: true } },
      { regex: /~~(.*?)~~/g, styles: { strike: true } },
    ];
    
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
    
    matches.sort((a, b) => a.start - b.start);
    
    const filteredMatches = [];
    let lastEnd = 0;
    
    for (const match of matches) {
      if (match.start >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.end;
      }
    }
    
    let textIndex = 0;
    
    for (const match of filteredMatches) {
      if (match.start > textIndex) {
        const beforeText = text.substring(textIndex, match.start);
        if (beforeText) {
          result.push({ type: "text", text: beforeText });
        }
      }
      
      result.push({
        type: "text",
        text: match.text,
        styles: match.styles
      });
      
      textIndex = match.end;
    }
    
    if (textIndex < text.length) {
      const remainingText = text.substring(textIndex);
      if (remainingText) {
        result.push({ type: "text", text: remainingText });
      }
    }
    
    if (result.length === 0) {
      result.push({ type: "text", text: text });
    }
    
    return result;
  };

  const findMatchingHeading = (blocks: any[], headingText: string, level: number, startIndex: number): number => {
    for (let i = startIndex; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type === "heading" && block.props?.level === level) {
        if (block.content && Array.isArray(block.content)) {
          const blockText = block.content
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object' && 'text' in item) return item.text;
              return '';
            })
            .join('').trim();
          
          if (blockText === headingText) {
            return i;
          }
        }
      }
    }
    return -1;
  };

  // Helper functions
  const closeModalAndReset = () => {
    closeAIModal();
    setPrompt("");
    setGeneratedContent("");
    setAIMode("new");
  };

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
      } catch (error) {
        console.log("Editor clearing adjustment:", error);
      }
    }
    
    await generateAIContent(inputPrompt, type);
  };

  // Handle inline AI trigger with enhanced debugging and stability
  const handleInlineAITrigger = React.useCallback(() => {
    console.log("🔍 handleInlineAITrigger called");
    
    try {
      // Reset state first
      setInlineAIState(prev => ({ ...prev, isVisible: false }));
      
      // Wait a bit for state to reset
      setTimeout(() => {
        const cursorPosition = editor.getTextCursorPosition();
        console.log("📍 Cursor position:", cursorPosition);
        
        if (!cursorPosition) {
          console.warn("❌ No cursor position found");
          return;
        }

        const selection = window.getSelection();
        console.log("🎯 Selection:", selection);
        
        if (!selection || !selection.rangeCount) {
          console.warn("❌ No selection found, creating artificial selection");
          
          // Try to create selection if none exists
          try {
            const range = document.createRange();
            const textNode = document.createTextNode("");
            range.setStart(textNode, 0);
            range.setEnd(textNode, 0);
            selection?.removeAllRanges();
            selection?.addRange(range);
          } catch (selectionError) {
            console.error("Failed to create selection:", selectionError);
          }
        }

        let rect;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          rect = range.getBoundingClientRect();
          console.log("📏 Selection rect:", rect);
        } else {
          // Fallback: use a default position
          rect = { left: 100, top: 100, bottom: 100, right: 100 };
          console.log("📏 Using fallback rect:", rect);
        }
        
        // Try to get editor container dengan multiple methods
        const possibleContainers = [
          document.querySelector('.ProseMirror'),
          document.querySelector('[data-is-editor="true"]'),
          document.querySelector('.bn-editor'),
          document.querySelector('.mantine-BlockNoteView-root'),
          document.activeElement?.closest('[role="textbox"]'),
          document.activeElement?.closest('.bn-container')
        ].filter(Boolean);
        
        console.log("🏠 Found containers:", possibleContainers);
        const editorContainer = possibleContainers[0];
        
        let finalX = rect.left;
        let finalY = rect.bottom + 8;
        
        if (editorContainer) {
          const editorRect = editorContainer.getBoundingClientRect();
          console.log("🏠 Editor rect:", editorRect);
          
          // Calculate position relative to editor
          finalX = rect.left - editorRect.left;
          finalY = rect.bottom - editorRect.top + 8;
          
          // Popup dimensions
          const popupWidth = 320;
          const popupHeight = 280;
          
          // Keep popup within editor bounds
          const margin = 20;
          
          if (finalX + popupWidth > editorRect.width - margin) {
            finalX = Math.max(margin, editorRect.width - popupWidth - margin);
          }
          
          if (finalY + popupHeight > editorRect.height - margin) {
            finalY = Math.max(margin, finalY - popupHeight - 16);
          }
          
          finalX = Math.max(margin, finalX);
          finalY = Math.max(margin, finalY);
        } else {
          console.warn("❌ No editor container found, using viewport coordinates");
          
          // Fallback: use viewport coordinates
          const popupWidth = 320;
          const popupHeight = 280;
          const margin = 20;
          
          if (finalX + popupWidth > window.innerWidth - margin) {
            finalX = Math.max(margin, window.innerWidth - popupWidth - margin);
          }
          
          if (finalY + popupHeight > window.innerHeight - margin) {
            finalY = Math.max(margin, rect.top - popupHeight - 8);
          }
        }
        
        console.log("🎯 Final position:", { x: finalX, y: finalY });
        
        setInlineAIState({
          isVisible: true,
          position: { x: finalX, y: finalY },
          currentBlock: cursorPosition.block,
          query: ""
        });
        
        console.log("✅ Inline AI state set successfully");
        
      }, 50); // Small delay to ensure state is ready
      
    } catch (error) {
      console.error("❌ Error triggering inline AI:", error);
      
      // Emergency fallback with console info
      console.log("🚨 Using emergency fallback");
      setInlineAIState({
        isVisible: true,
        position: { 
          x: 100,
          y: 100
        },
        currentBlock: null,
        query: ""
      });
    }
  }, [editor]); // Add editor as dependency

  // Handle cursor position changes for continue button
  React.useEffect(() => {
    const handleSelectionChange = () => {
      try {
        const cursorPosition = editor.getTextCursorPosition();
        if (!cursorPosition) {
          setContinueState(prev => ({ ...prev, isVisible: false }));
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
          }
        } else {
          setContinueState(prev => ({ ...prev, isVisible: false }));
        }
      } catch (error) {
        console.error("Error handling selection change:", error);
        setContinueState(prev => ({ ...prev, isVisible: false }));
      }
    };

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = editor.onChange?.(handleSelectionChange);
    } catch (error) {
      console.error("Error setting up editor change listener:", error);
    }
    
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editor]);

  // AI Generation function
  const generateAIContent = async (prompt: string, type: string = "structure") => {
    if (!aiModel) return null;
    
    setIsAILoading(true);
    try {
      let systemPrompt = "";
      
      if (aiMode === "continue") {
        const editorBlocks = editor.document;
        let contextContent = "";
        
        editorBlocks.forEach(block => {
          if (block.content && Array.isArray(block.content)) {
            const text = block.content
              .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'text' in item) return item.text;
                return '';
              })
              .join('');
            
            if (text.trim()) {
              if (block.type === "heading") {
                const level = block.props?.level || 1;
                const headingPrefix = '#'.repeat(level);
                contextContent += `\n${headingPrefix} ${text}\n`;
              } else {
                contextContent += `${text}\n`;
              }
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
        // AI Generator mode - HANYA struktur heading tanpa konten
        if (type === "content") {
          systemPrompt = `Buat outline struktur lengkap dengan heading dan subheading untuk topik: ${prompt}

ATURAN STRUKTUR HEADING:
- Gunakan # untuk judul utama (hanya 1)
- Gunakan ## untuk bab-bab utama (level 2) 
- Gunakan ### untuk sub-bab (level 3)
- Gunakan #### untuk detail bagian (level 4)
- Jangan skip level heading (misalnya dari # langsung ke ###)

INSTRUKSI PENTING:
- HANYA tulis heading dan subheading
- JANGAN tulis konten paragraf apapun
- TIDAK ada penjelasan atau deskripsi di bawah heading
- Fokus pada struktur yang logis dan terorganisir

FORMAT OUTPUT:
# Judul Utama
## Bab 1
### Sub Bab 1.1
### Sub Bab 1.2
## Bab 2
### Sub Bab 2.1
#### Detail 2.1.1
#### Detail 2.1.2
### Sub Bab 2.2

TUGAS:
Buat HANYA struktur heading untuk "${prompt}" tanpa konten apapun.`;
        } else {
          // Mode struktur - sama, hanya outline
          systemPrompt = `Buat outline lengkap dan terstruktur untuk topik: ${prompt}

ATURAN STRUKTUR HEADING:
- Gunakan # untuk judul utama (hanya 1)
- Gunakan ## untuk bab-bab utama (level 2)
- Gunakan ### untuk sub-bab (level 3)
- Gunakan #### untuk detail bagian (level 4)
- Jangan skip level heading (misalnya dari # langsung ke ###)

INSTRUKSI PENTING:
- HANYA tulis heading dan subheading
- JANGAN tulis konten paragraf apapun
- TIDAK ada penjelasan atau deskripsi
- Buat struktur yang komprehensif dan logis

FORMAT OUTPUT:
- Mulai dengan 1 judul utama menggunakan #
- Buat 4-6 bab utama menggunakan ##
- Setiap bab utama memiliki 2-4 sub-bab menggunakan ###
- Beberapa sub-bab bisa memiliki detail menggunakan ####

TUGAS:
Buat HANYA outline heading untuk "${prompt}" tanpa konten paragraf.`;
        }
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: systemPrompt,
        maxTokens: aiMode === "continue" ? 4000 : 1000, // Reduce maxTokens untuk structure-only
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

  // Smart content merging
  const insertContentWithSmartMerging = () => {
    try {
      const currentBlocks = editor.document;
      const generatedLines = generatedContent.split('\n').filter((line: string) => line.trim());
      
      let currentBlockIndex = 0;
      let i = 0;
      
      while (i < generatedLines.length && currentBlockIndex < currentBlocks.length) {
        const line = generatedLines[i].trim();
        if (!line) {
          i++;
          continue;
        }
        
        const headingMatch = line.match(/^(#+)\s+(.+)$/);
        
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2];
          
          const matchingBlockIndex = findMatchingHeading(currentBlocks, headingText, level, currentBlockIndex);
          
          if (matchingBlockIndex !== -1) {
            currentBlockIndex = matchingBlockIndex;
            i++;
            
            const contentToInsert: any[] = [];
            while (i < generatedLines.length) {
              const contentLine = generatedLines[i].trim();
              if (!contentLine) {
                i++;
                continue;
              }
              
              if (contentLine.match(/^#+\s+/)) {
                break;
              }
              
              contentToInsert.push({
                type: "paragraph",
                content: parseInlineFormatting(contentLine),
                props: {},
              });
              i++;
            }
            
            if (contentToInsert.length > 0) {
              const targetBlock = currentBlocks[currentBlockIndex];
              editor.insertBlocks(contentToInsert as any, targetBlock, "after");
              currentBlockIndex += contentToInsert.length + 1;
            }
          } else {
            i++;
          }
        } else {
          i++;
        }
      }
    } catch (error) {
      console.error("Error in smart merging:", error);
      const lines = generatedContent.split('\n').filter((line: string) => line.trim());
      const blocksToInsert = lines.map((line: string) => ({
        type: "paragraph",
        content: parseInlineFormatting(line.trim()),
        props: {},
      }));
      
      if (blocksToInsert.length > 0) {
        editor.insertBlocks(blocksToInsert as any, editor.document[editor.document.length - 1], "after");
      }
    }
  };

  // Insert content to editor
  const insertContentToEditor = (shouldAppend: boolean = false) => {
    if (!generatedContent) return;

    try {
      if (aiMode === "continue") {
        insertContentWithSmartMerging();
        closeModalAndReset();
        return;
      }
      
      let blocksToInsert: any[] = [];
      const lines = generatedContent.split('\n').filter((line: string) => line.trim());
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let blockType: string = "paragraph";
        let content: any = line;
        let props: any = {};
        
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
        } else if (line.match(/^\* .+/) || line.match(/^- .+/)) {
          blockType = "bulletListItem";
          content = parseInlineFormatting(line.replace(/^[\*-] /, '').trim());
        } else if (line.match(/^\d+\. .+/)) {
          blockType = "numberedListItem";
          content = parseInlineFormatting(line.replace(/^\d+\. /, '').trim());
        } else {
          blockType = "paragraph";
          content = parseInlineFormatting(line);
        }
        
        blocksToInsert.push({
          type: blockType,
          content: content,
          props: props,
        });
      }
      
      if (blocksToInsert.length > 0) {
        if (!shouldAppend) {
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
      
      closeModalAndReset();
    } catch (error) {
      console.error("Error inserting content:", error);
      alert("❌ Terjadi kesalahan saat memasukkan konten ke editor. Silakan coba lagi.");
    }
  };

  // Analyze current cursor position and find the exact heading context
  const analyzeCurrentCursorContext = () => {
    try {
      const cursorPosition = editor.getTextCursorPosition();
      if (!cursorPosition) return null;
      
      const currentBlock = cursorPosition.block;
      const allBlocks = editor.document;
      const currentIndex = allBlocks.findIndex(block => block.id === currentBlock.id);
      
      // Check if cursor is directly on a heading
      if (currentBlock.type === "heading") {
        const headingText = currentBlock.content
          ?.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'text' in item) return item.text;
            return '';
          })
          .join('').trim();
        
        if (headingText) {
          const level = currentBlock.props?.level || 1;
          return {
            targetHeading: {
              text: headingText,
              level: level,
              position: currentIndex,
              block: currentBlock
            },
            headingContent: "", // Empty because we're at the heading itself
            insertPosition: currentIndex,
            isAtHeading: true
          };
        }
      }
      
      // Find the heading that governs current cursor position
      let governingHeading = null;
      let headingContent = "";
      let headingStartIndex = -1;
      
      // Look backwards for the nearest heading
      for (let i = currentIndex - 1; i >= 0; i--) {
        const block = allBlocks[i];
        if (block.type === "heading") {
          if (block.content && Array.isArray(block.content)) {
            const headingText = block.content
              .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'text' in item) return item.text;
                return '';
              })
              .join('').trim();
            
            if (headingText) {
              const level = block.props?.level || 1;
              governingHeading = {
                text: headingText,
                level: level,
                position: i,
                block: block
              };
              headingStartIndex = i;
              break;
            }
          }
        }
      }
      
      // Collect content under this heading up to current cursor position
      if (governingHeading) {
        for (let i = headingStartIndex + 1; i < currentIndex; i++) {
          const block = allBlocks[i];
          
          // Stop if we hit another heading of same or higher level
          if (block.type === "heading") {
            const blockLevel = block.props?.level || 1;
            if (blockLevel <= governingHeading.level) {
              break;
            }
          }
          
          // Collect content
          if (block.content && Array.isArray(block.content)) {
            const text = block.content
              .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'text' in item) return item.text;
                return '';
              })
              .join('').trim();
            
            if (text) {
              if (block.type === "heading") {
                const level = block.props?.level || 1;
                const headingPrefix = '#'.repeat(level);
                headingContent += `${headingPrefix} ${text}\n`;
              } else {
                headingContent += `${text}\n`;
              }
            }
          }
        }
      }
      
      return {
        targetHeading: governingHeading,
        headingContent: headingContent.trim(),
        insertPosition: currentIndex,
        isAtHeading: false
      };
    } catch (error) {
      console.error("Error analyzing cursor context:", error);
      return null;
    }
  };

  // Handle inline AI actions
  const handleInlineAIAction = async (action: string) => {
    if (!aiModel || !inlineAIState.currentBlock) return;

    setInlineAIState(prev => ({ ...prev, isVisible: false }));
    setIsAutoContinuing(true);

    try {
      let systemPrompt = "";
      let maxTokens = 500;

      switch (action) {
        case "continue":
          // Analyze cursor context untuk smart continuation
          const cursorContext = analyzeCurrentCursorContext();
          
          if (cursorContext?.targetHeading) {
            // Smart continuation berdasarkan posisi cursor yang tepat
            const { targetHeading, headingContent, isAtHeading } = cursorContext;
            
            systemPrompt = `Tulis konten untuk heading berikut. HANYA tulis isi konten paragraf, JANGAN tulis ulang headingnya.

HEADING YANG AKAN DIISI:
${targetHeading.text}

KONTEN YANG SUDAH ADA:
${headingContent || "(Belum ada konten)"}

INSTRUKSI KETAT:
- JANGAN menulis ulang heading atau subheading apapun
- HANYA tulis konten paragraf yang informatif
- Tulis 2-3 paragraf yang menjelaskan topik "${targetHeading.text}" secara detail
- Gunakan bahasa yang natural dan engaging  
- Berikan informasi yang valuable, contoh konkret, atau penjelasan praktis
- Jika sudah ada konten sebelumnya, lanjutkan dengan informasi tambahan yang relevan
- TIDAK ada format markdown heading (# ## ###)
- Fokus pada konten yang langsung membahas topik

TUGAS:
Tulis HANYA isi konten untuk "${targetHeading.text}" tanpa heading apapun.`;
            
            maxTokens = 600;
          } else {
            // Fallback jika tidak ada heading context
            const editorBlocks = editor.document;
            let contextContent = "";
            
            editorBlocks.forEach(block => {
              if (block.content && Array.isArray(block.content)) {
                const text = block.content
                  .map((item: any) => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object' && 'text' in item) return item.text;
                    return '';
                  })
                  .join('');
                
                if (text.trim()) {
                  if (block.type === "heading") {
                    const level = block.props?.level || 1;
                    const headingPrefix = '#'.repeat(level);
                    contextContent += `\n${headingPrefix} ${text}\n`;
                  } else {
                    contextContent += `${text}\n`;
                  }
                }
              }
            });

            systemPrompt = `Lanjutkan penulisan dari konteks saat ini dengan natural. Tulis 1-2 paragraf yang mengalir dengan baik.

Konten saat ini:
${contextContent}

Instruksi:
- Lanjutkan secara natural dari tempat terakhir
- Jaga konsistensi tone dan style
- Berikan informasi yang valuable
- HANYA tulis konten, jangan ulang informasi yang sudah ada`;
            maxTokens = 400;
          }
          break;

        case "summarize":
          // Extract context from current editor untuk summarize
          const editorBlocks = editor.document;
          let contextContent = "";
          
          editorBlocks.forEach(block => {
            if (block.content && Array.isArray(block.content)) {
              const text = block.content
                .map((item: any) => {
                  if (typeof item === 'string') return item;
                  if (item && typeof item === 'object' && 'text' in item) return item.text;
                  return '';
                })
                .join('');
              
              if (text.trim()) {
                if (block.type === "heading") {
                  const level = block.props?.level || 1;
                  const headingPrefix = '#'.repeat(level);
                  contextContent += `\n${headingPrefix} ${text}\n`;
                } else {
                  contextContent += `${text}\n`;
                }
              }
            }
          });

          systemPrompt = `Create a concise summary of the following content:

Content to summarize:
${contextContent}

Instructions:
- Provide a clear, concise summary
- Capture the main points and key insights
- Keep it brief but comprehensive`;
          maxTokens = 300;
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
        maxTokens,
        temperature: 0.7,
        presencePenalty: 0.2,
        frequencyPenalty: 0.1,
      });

      if (text && inlineAIState.currentBlock) {
        const lines = text.split('\n').filter((line: string) => line.trim());
        const blocksToInsert = lines.map((line: string) => ({
          type: "paragraph" as const,
          content: parseInlineFormatting(line.trim()),
          props: {},
        }));

        if (blocksToInsert.length > 0) {
          // Use current cursor position for insertion, not inlineAIState.currentBlock
          const cursorPosition = editor.getTextCursorPosition();
          const targetBlock = cursorPosition?.block || inlineAIState.currentBlock;
          
          editor.insertBlocks(blocksToInsert as any, targetBlock, "after");
          
          setTimeout(() => {
            try {
              // Move cursor to end of inserted content
              const allBlocks = editor.document;
              const currentIndex = allBlocks.findIndex(block => block.id === targetBlock.id);
              const lastInsertedIndex = currentIndex + blocksToInsert.length;
              const lastInsertedBlock = allBlocks[lastInsertedIndex];
              
              if (lastInsertedBlock) {
                editor.setTextCursorPosition(lastInsertedBlock, "end");
              }
            } catch (e) {
              console.log("Cursor positioning adjustment");
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error("Inline AI action failed:", error);
    } finally {
      setIsAutoContinuing(false);
    }
  };

  // Custom AI Slash Menu Items dengan proper dependency
  const getCustomAISlashMenuItems = React.useMemo(() => {
    if (!aiModel) return [];
    
    return [
      {
        title: "AI Generator",
        onItemClick: () => {
          setAIMode("new");
          openAIModal();
        },
        aliases: ["generate", "write", "tulis"],
        group: "AI Tools",
        subtext: "Generate new content",
        icon: <IconEdit size={18} />,
      },
      {
        title: "Ask AI anything...",
        onItemClick: () => {
          // Add delay to ensure cursor position is stable
          setTimeout(() => {
            handleInlineAITrigger();
          }, 100);
        },
        aliases: ["ai", "assistant", "ask", "help"],
        group: "AI Tools",
        subtext: "AI suggestions and actions",
        icon: <IconSparkles size={18} />,
      }
    ];
  }, [aiModel]); // Removed openAIModal dari dependencies

  // Custom Slash Menu Items dengan callback yang stabil
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

  // Handle content changes
  React.useEffect(() => {
    const handleChange = () => {
      if (onContentChange) {
        onContentChange(editor.document);
      }
    };

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = editor.onChange?.(handleChange);
    } catch (error) {
      console.error("Error setting up content change listener:", error);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [editor, onContentChange]);

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

        {/* Inline AI Suggestions Popup - Debug Version */}
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
              {/* Temporary Debug Info */}
              <div style={{ 
                fontSize: '10px', 
                color: '#666', 
                marginBottom: '4px',
                padding: '4px',
                background: '#f0f0f0',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}>
                Debug: x={inlineAIState.position.x}, y={inlineAIState.position.y}
                <br />
                Block ID: {inlineAIState.currentBlock?.id || 'null'}
                <br />
                Time: {new Date().toLocaleTimeString()}
              </div>
              
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
                    Ask AI anything...
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {inlineAISuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      console.log("🔧 AI suggestion clicked:", suggestion.action);
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
                    <span style={{ fontSize: '16px' }}>{suggestion.icon}</span>
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
            className="continue-button-wrapper"
            style={{
              position: 'absolute',
              left: continueState.position.x,
              top: continueState.position.y,
              zIndex: 999,
              pointerEvents: 'auto'
            }}
          >
            <Tooltip label="Continue writing with AI" position="top">
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

        {/* Auto Continue Loading Overlay */}
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
                <Text fw={500} c="blue">AI sedang melanjutkan tulisan...</Text>
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
              {aiMode === "continue" ? "🚀 AI Lanjutan Konten" : "✨ AI Content Generator"}
            </Text>
          </Group>
        }
        size="xl"
        radius="lg"
        padding="xl"
        centered
        className="ai-modal"
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
                    placeholder="Untuk mode 'Struktur' - jelaskan topik secara umum. Untuk mode 'Konten' - masukkan bab/sub bab spesifik yang ingin diisi."
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
                  <Text size="sm" c="dimmed">
                    Untuk mode "Struktur" - jelaskan topik secara umum. Untuk mode "Konten" - masukkan bab/sub bab spesifik yang ingin diisi.
                  </Text>
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
                      AI akan menganalisis heading/subheading di editor dan melengkapi konten yang masih kosong atau singkat.
                    </Text>
                  </Stack>
                </Paper>
              )}

              {/* AI Templates Grid */}
              <Stack gap="md">
                <Text fw={500} size="lg" c="dimmed">
                  Pilih mode generate:
                </Text>
                
                <SimpleGrid cols={aiMode === "continue" ? 1 : 2} spacing="lg">
                  {(() => {
                    if (aiMode === "continue") {
                      return [{
                        title: "Lanjutkan Konten", 
                        description: "AI akan melengkapi heading yang masih kosong dengan konten detail",
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
                      className="ai-template-card"
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