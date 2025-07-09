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
import { ActionIcon, Tooltip, useComputedColorScheme } from "@mantine/core";
import { IconLoader, IconSparkles } from "@tabler/icons-react";
import { generateText } from "ai";
import React from "react";

interface BlockNoteEditorProps {
  onContentChange?: (content: any[]) => void;
  style?: React.CSSProperties;
}

export default function BlockNoteEditorComponent({
  onContentChange,
  style,
}: BlockNoteEditorProps) {
  const computedColorScheme = useComputedColorScheme("light");
  const [isAILoading, setIsAILoading] = React.useState(false);

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

  // Custom AI Functions
  const generateAIContent = async (prompt: string) => {
    if (!aiModel) return null;
    
    setIsAILoading(true);
    try {
      const { text } = await generateText({
        model: aiModel,
        prompt: `Write content for: ${prompt}. Write in a clear, professional tone. Return only the content without any meta-commentary.`,
        maxTokens: 500,
      });
      
      return text;
    } catch (error) {
      console.error("AI generation failed:", error);
      return null;
    } finally {
      setIsAILoading(false);
    }
  };

  const insertAIContent = async (prompt: string) => {
    const content = await generateAIContent(prompt);
    if (!content) return;

    // Insert generated content as new block
    const currentPos = editor.getTextCursorPosition();
    editor.insertBlocks(
      [
        {
          type: "paragraph",
          content: content,
        },
      ],
      currentPos.block,
      "after"
    );
  };

  // Custom AI Slash Menu Items
  const getCustomAISlashMenuItems = () => {
    if (!aiModel) return [];
    
    return [
      {
        title: "🤖 AI Writer",
        onItemClick: () => {
          const prompt = window.prompt("What would you like me to write about?");
          if (prompt) {
            insertAIContent(prompt);
          }
        },
        aliases: ["ai", "write", "generate"],
        group: "AI Assistant",
        hint: "Generate content with AI",
      },
      {
        title: "📝 AI Blog Post",
        onItemClick: () => {
          const topic = window.prompt("Blog post topic:");
          if (topic) {
            insertAIContent(`Write a comprehensive blog post about: ${topic}`);
          }
        },
        aliases: ["blog", "article"],
        group: "AI Assistant",
        hint: "Generate a blog post",
      },
      {
        title: "📋 AI Summary",
        onItemClick: () => {
          const topic = window.prompt("What should I summarize?");
          if (topic) {
            insertAIContent(`Write a concise summary about: ${topic}`);
          }
        },
        aliases: ["summary", "summarize"],
        group: "AI Assistant",
        hint: "Generate a summary",
      },
      {
        title: "📚 AI Explain",
        onItemClick: () => {
          const topic = window.prompt("What should I explain?");
          if (topic) {
            insertAIContent(`Explain in simple terms: ${topic}`);
          }
        },
        aliases: ["explain", "define"],
        group: "AI Assistant",
        hint: "Explain a concept",
      },
    ];
  };

  // Handle content changes
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
    <div style={{ ...style, height: "100%", display: "flex", flexDirection: "column" }}>
      <BlockNoteView
        editor={editor}
        theme={computedColorScheme === "dark" ? "dark" : "light"}
        style={{ flex: 1, overflow: "hidden" }}
        slashMenu={false}
      >
        {/* Custom Slash Menu with AI */}
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
      
      {/* Status with AI Button */}
      <div style={{ 
        fontSize: "12px", 
        color: aiModel ? "#007BFF" : "#6c757d", 
        padding: "8px 16px",
        textAlign: "center",
        borderTop: "1px solid #e9ecef",
        background: computedColorScheme === "dark" ? "#1a1a1a" : "#f8f9fa",
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px"
      }}>
        <span style={{ flex: 1 }}>
          {aiModel 
            ? "🤖 AI Editor Ready - Ketik \"/\" lalu pilih AI commands untuk bantuan AI"
            : "✍️ BlockNote Editor - Add GROQ_API_KEY di .env.local untuk AI features"
          }
        </span>
        
        {aiModel && (
          <Tooltip label="Quick AI Generate" position="top">
            <ActionIcon
              size="md"
              variant="light"
              color="blue"
              loading={isAILoading}
              onClick={() => {
                const prompt = window.prompt("Quick AI generation - What do you want to write?");
                if (prompt) insertAIContent(prompt);
              }}
              style={{ minWidth: "36px" }}
            >
              {isAILoading ? <IconLoader size={16} /> : <IconSparkles size={16} />}
            </ActionIcon>
          </Tooltip>
        )}
      </div>
    </div>
  );
}