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
  CopyButton,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useComputedColorScheme
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconBulb, IconCheck, IconCopy, IconPencil, IconRobot, IconSparkles } from "@tabler/icons-react";
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

  // AI generation function
  const generateAIContent = async (prompt: string, type: string = "general") => {
    if (!aiModel) return null;
    
    setIsAILoading(true);
    try {
      let systemPrompt = "";
      
      switch (type) {
        case "blog":
          systemPrompt = `Write a comprehensive blog post about: ${prompt}. Include an engaging introduction, main points with details, and a conclusion. Write in a professional but accessible tone.`;
          break;
        case "summary":
          systemPrompt = `Write a concise and informative summary about: ${prompt}. Focus on key points and important details.`;
          break;
        case "explain":
          systemPrompt = `Explain in simple, clear terms: ${prompt}. Use examples if helpful and make it easy to understand.`;
          break;
        case "creative":
          systemPrompt = `Write creative content about: ${prompt}. Be engaging, imaginative, and compelling.`;
          break;
        default:
          systemPrompt = `Write high-quality content about: ${prompt}. Be informative, well-structured, and engaging.`;
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: systemPrompt,
        maxTokens: 800,
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

  // Enhanced AI generation - requires prompt input
  const handleAIGeneration = async (inputPrompt: string, type: string = "general") => {
    // Always require prompt input
    if (!inputPrompt.trim()) {
      alert("⚠️ Please enter a topic or keyword before generating content!");
      return;
    }
    
    await generateAIContent(inputPrompt, type);
  };

  const insertContentToEditor = () => {
    if (!generatedContent) return;

    try {
      // Get current position
      const currentPos = editor.getTextCursorPosition();
      
      // Split content into paragraphs
      const paragraphs = generatedContent.split('\n\n').filter(p => p.trim());
      
      // Insert paragraphs one by one
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        
        if (i === 0) {
          // Replace current block with first paragraph
          editor.updateBlock(currentPos.block, {
            type: "paragraph",
            content: paragraph,
          });
        } else {
          // Insert additional paragraphs after the previous one
          const targetBlock = i === 1 ? currentPos.block : editor.getTextCursorPosition().block;
          editor.insertBlocks(
            [{
              type: "paragraph", 
              content: paragraph,
            }],
            targetBlock,
            "after"
          );
        }
      }
      
      // Close modal and reset
      closeModalAndReset();
      
      // Show success message
      setTimeout(() => {
        alert("✅ Content successfully inserted into editor!");
      }, 300);
      
    } catch (error) {
      console.error("Error inserting content:", error);
      alert("⚠️ Could not insert content automatically. Please copy and paste manually.");
    }
  };

  const closeModalAndReset = () => {
    closeAIModal();
    setPrompt("");
    setGeneratedContent("");
  };

  // AI Templates with default prompts
  const aiTemplates = [
    {
      title: "✍️ General Writing",
      description: "Generate any type of content",
      type: "general",
      color: "blue",
      defaultPrompt: "The impact of technology on modern education"
    },
    {
      title: "📝 Blog Post",
      description: "Create comprehensive articles",
      type: "blog", 
      color: "green",
      defaultPrompt: "10 emerging trends in sustainable technology"
    },
    {
      title: "📋 Summary",
      description: "Concise summaries and overviews",
      type: "summary",
      color: "orange",
      defaultPrompt: "Latest developments in artificial intelligence and machine learning"
    },
    {
      title: "🎯 Explanation",
      description: "Clear explanations of complex topics",
      type: "explain",
      color: "purple",
      defaultPrompt: "How quantum computing works and its potential applications"
    },
    {
      title: "🚀 Creative Content",
      description: "Engaging and imaginative writing",
      type: "creative",
      color: "pink",
      defaultPrompt: "A day in the life of a space explorer in 2050"
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
        aliases: ["ai", "assistant", "generate", "write"],
        group: "AI Assistant",
        hint: "Open AI Assistant with templates",
      }
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
                <Tooltip label="Open AI Assistant" position="top">
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

      {/* Modern AI Assistant Modal */}
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
          },
          body: {
            padding: 0,
          }
        }}
      >
        <Stack gap="lg" p="lg">
          {!generatedContent ? (
            <>
              {/* Input Section - Enhanced */}
              <Paper p="lg" withBorder radius="md" bg={computedColorScheme === "dark" ? "#2a2a2a" : "#f8f9fa"}>
                <Stack gap="md">
                  <Group align="center" gap="xs">
                    <IconPencil size={20} style={{ color: '#007BFF' }} />
                    <Text fw={600} size="md">
                      Enter your topic or keywords
                    </Text>
                    <Badge size="sm" color="red" variant="light">Required</Badge>
                  </Group>
                  
                  <Textarea
                    placeholder="Examples:&#10;• Artificial intelligence in healthcare&#10;• Sustainable energy solutions for cities&#10;• Future of remote work&#10;• Benefits of meditation for mental health"
                    value={prompt}
                    onChange={(e) => setPrompt(e.currentTarget.value)}
                    minRows={4}
                    maxRows={6}
                    size="md"
                    radius="md"
                    styles={{
                      input: {
                        background: computedColorScheme === "dark" ? "#1a1a1a" : "white",
                        border: "2px solid transparent",
                        fontSize: "15px",
                        lineHeight: "1.5",
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        '&:focus': {
                          borderColor: '#007BFF',
                          boxShadow: '0 0 0 3px rgba(0, 123, 255, 0.1)'
                        }
                      }
                    }}
                  />
                  
                  <Text size="xs" c="dimmed">
                    💡 Be specific! The more detailed your input, the better the AI-generated content will be.
                  </Text>
                </Stack>
              </Paper>

              {/* AI Templates */}
              <Stack gap="xs">
                <Text fw={500} size="sm" c="dimmed">
                  🎯 Choose a template:
                </Text>
                
                <Group gap="md">
                  {aiTemplates.map((template) => (
                    <Paper
                      key={template.type}
                      p="md"
                      withBorder
                      radius="md"
                      style={{
                        cursor: "pointer",
                        transition: 'all 0.2s ease',
                        minWidth: '140px',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }
                      }}
                      onClick={() => handleAIGeneration(prompt, template.type)}
                    >
                      <Stack gap="xs" align="center">
                        <Text size="xs" fw={500} ta="center">
                          {template.title}
                        </Text>
                        <Text size="xs" c="dimmed" ta="center">
                          {template.description}
                        </Text>
                        {!prompt && (
                          <Badge size="xs" color={template.color} variant="light">
                            Use default prompt
                          </Badge>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Group>
              </Stack>

              {/* Action Buttons */}
              <Group justify="flex-end" gap="md">
                <Button 
                  variant="light" 
                  color="gray" 
                  onClick={closeModalAndReset}
                  radius="md"
                >
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  onClick={() => {
                    if (prompt.trim()) {
                      handleAIGeneration(prompt, "general");
                    } else {
                      alert("⚠️ Please enter a topic or keywords first!");
                    }
                  }}
                  disabled={!prompt.trim() || isAILoading}
                  loading={isAILoading}
                  radius="md"
                  leftSection={<IconSparkles size={18} />}
                >
                  Generate Content
                </Button>
              </Group>

              {/* Loading State */}
              {isAILoading && (
                <Paper p="md" radius="md" bg="blue.0">
                  <Group gap="md">
                    <Loader size="sm" color="blue" />
                    <Text size="sm" c="blue">
                      AI is generating your content...
                    </Text>
                  </Group>
                </Paper>
              )}
            </>
          ) : (
            /* Generated Content Display */
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={600} size="lg" c="blue">
                  ✨ Generated Content
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
                      {copied ? 'Copied!' : 'Copy All'}
                    </Button>
                  )}
                </CopyButton>
              </Group>

              <Textarea
                value={generatedContent}
                readOnly
                minRows={12}
                maxRows={20}
                radius="md"
                styles={{
                  input: {
                    background: computedColorScheme === "dark" ? "#2a2a2a" : "#f8f9fa",
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    padding: '16px',
                    border: `2px solid ${computedColorScheme === "dark" ? "#404040" : "#e9ecef"}`,
                  }
                }}
              />

              <Paper p="md" radius="md" bg="blue.0">
                <Group gap="md">
                  <IconBulb size={20} style={{ color: '#007BFF' }} />
                  <div>
                    <Text size="sm" c="blue" fw={500}>
                      Content ready to insert!
                    </Text>
                    <Text size="xs" c="blue">
                      Click "Insert to Editor" to add this content directly to your BlockNote editor
                    </Text>
                  </div>
                </Group>
              </Paper>

              <Group justify="space-between" gap="md">
                <Group gap="md">
                  <Button 
                    variant="light" 
                    color="gray" 
                    onClick={() => setGeneratedContent("")}
                    leftSection={<IconPencil size={16} />}
                  >
                    Generate New
                  </Button>
                  
                  <CopyButton value={generatedContent} timeout={2000}>
                    {({ copied, copy }) => (
                      <Button
                        leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        color={copied ? 'teal' : 'blue'}
                        variant="light"
                        onClick={copy}
                      >
                        {copied ? 'Copied!' : 'Copy Text'}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
                
                <Button 
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  size="md"
                  onClick={insertContentToEditor}
                  leftSection={<IconSparkles size={18} />}
                >
                  Insert to Editor
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
}