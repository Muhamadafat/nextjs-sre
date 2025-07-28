'use client';

import dynamic from 'next/dynamic';
import { ActionIcon, AppShell, Avatar, Box, Burger, Button, Container, Flex, Group, Image, ScrollArea, Stack, Text, TextInput, ThemeIcon, Title, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
// import BlockNoteEditorComponent from '@/components/BlockNoteEditor';
//  // Fixed: menggunakan alias @/ yang lebih standar
const BlockNoteEditorComponent = dynamic(
  () => import('@/components/BlockNoteEditor'),
  { ssr: false }
);
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconBrain, IconFilePlus, IconGraph, IconMessageCircle2, IconMoon, IconSend, IconSettings, IconSun, IconUpload } from '@tabler/icons-react';
import NextImage from 'next/image';
import { useState } from 'react';
import Split from 'react-split';
import knowledgeImage from '../imageCollection/graph.png';
import myimage from '../imageCollection/logoSRE_Tulis.png';

// Logo Component menggunakan LogoSRE_Fix.png
function SmartResearchEngineLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const computedColorScheme = useComputedColorScheme('light');
  
  const sizeConfig = {
    sm: { logoWidth: 120, logoHeight: 32, titleSize: 'md' },
    md: { logoWidth: 160, logoHeight: 40, titleSize: 'lg' },
    lg: { logoWidth: 200, logoHeight: 48, titleSize: 'xl' }
  };
  
  const config = sizeConfig[size];
  
  return (
    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
      <Image
        component={NextImage}
        src={myimage}
        alt="Smart Research Engine Logo"
        w={config.logoWidth}
        h={config.logoHeight}
        fit="contain"
        style={{
          flexShrink: 0,
          filter: computedColorScheme === 'dark' ? 'brightness(1.1)' : 'none',
        }}
      />
      
      <div style={{ minWidth: 0, flex: 1 }}>
        <Title
          order={2}
          size={config.titleSize}
          fw={700}
          c="#007BFF"
          style={{ 
            lineHeight: 1.2,
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          Smart Research Engine
        </Title>
        {size !== 'sm' && (
          <Text
            size="xs"
            c="dimmed"
            style={{ 
              lineHeight: 1.1, 
              marginTop: 2,
              whiteSpace: 'nowrap'
            }}
          >
            Knowledge Visualization Platform
          </Text>
        )}
      </div>
    </Group>
  );
}

export default function Home() {
  const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] = useDisclosure();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: true,
  });

  const toggleColorScheme = () => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');

  const [activeTab, setActiveTab] = useState('knowledge');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [fileName, setFileName] = useState('Judul Artikel 1');
  // Enhanced headings state dengan level
  const [headings, setHeadings] = useState<Array<{ id: string; text: string; level: number }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [editorContent, setEditorContent] = useState<any[]>([]);

  const sendMessage = () => {
    if (chatInput.trim() === '') return;
    setMessages((prev) => [...prev, chatInput]);
    setChatInput('');
  };

  // Enhanced handleContentChange untuk extract heading dengan level dan auto-update/reset title
  const handleContentChange = (content: any[]) => {
    setEditorContent(content);

    // Extract headings from BlockNote content dengan level
    const extractedHeadings: { id: string; text: string; level: number }[] = [];
    let firstH1Title = '';
    let hasAnyContent = false;
    
    content.forEach((block) => {
      // Check if ada content apapun
      if (block.content && block.content.length > 0) {
        const hasText = block.content.some((item: any) => {
          const text = typeof item === 'string' ? item : (item.text || '');
          return text.trim().length > 0;
        });
        if (hasText) {
          hasAnyContent = true;
        }
      }
      
      if (block.type === 'heading' && block.content?.length > 0) {
        const text = block.content.map((item: any) => item.text || '').join('');
        if (text.trim()) {
          const level = block.props?.level || 1;
          
          extractedHeadings.push({
            id: block.id || `heading-${Math.random().toString(36).substr(2, 9)}`,
            text: text.trim(),
            level: level,
          });
          
          // Auto-update fileName dengan H1 pertama yang ditemukan
          if (level === 1 && !firstH1Title) {
            firstH1Title = text.trim();
          }
        }
      }
    });
    
    setHeadings(extractedHeadings);
    
    // Logic untuk update/reset title
    if (!hasAnyContent) {
      // Jika editor benar-benar kosong, reset title
      setFileName('📝 Tidak ada judul');
    } else if (firstH1Title && firstH1Title !== fileName) {
      // Jika ada H1, update dengan H1 tersebut
      setFileName(firstH1Title);
    }
    // Jika ada content tapi tidak ada H1, biarkan title yang ada
  };

  const handleSaveDraft = () => {
    console.log('Draft:', editorContent);
    alert('Draft disimpan!');
  };

  const handleSaveFinal = () => {
    console.log('Final:', editorContent);
    alert('Artikel final disimpan!');
  };

  return (
    <AppShell header={{ height: 90 }} padding="md">
      <AppShell.Header
        style={{
          backgroundColor: computedColorScheme === 'dark' ? '#1a1a1a' : '#fff',
          borderBottom: `1px solid ${computedColorScheme === 'dark' ? '#2a2a2a' : '#e0e0e0'}`,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Container size="100%" h="100%" px="md">
          <Flex justify="space-between" align="center" h="100%" w="100%">
            <Group gap="md" style={{ minWidth: 0, flex: 1 }}>
              <Burger 
                size="sm" 
                opened={navbarOpened} 
                onClick={toggleNavbar} 
                aria-label="Toggle navigation"
                style={{ flexShrink: 0 }}
              />

              {/* Logo yang diperbaiki - tidak akan terpotong */}
              <div style={{ 
                minWidth: 0, 
                flex: 1, 
                maxWidth: isMobile ? 'calc(100vw - 150px)' : 'calc(100vw - 200px)',
                overflow: 'hidden'
              }}>
                <SmartResearchEngineLogo size={isMobile ? "sm" : "md"} />
              </div>
            </Group>

            <Group gap="md" style={{ flexShrink: 0 }}>
              <ActionIcon 
                onClick={toggleColorScheme} 
                variant="default" 
                size="lg" 
                aria-label="Toggle color scheme"
                style={{
                  transition: 'all 0.2s ease',
                }}
              >
                {computedColorScheme === 'dark' ? 
                  <IconSun size={20} /> : 
                  <IconMoon size={20} />
                }
              </ActionIcon>

              <ActionIcon 
                variant="default" 
                size="lg" 
                aria-label="Settings"
                style={{
                  transition: 'all 0.2s ease',
                }}
              >
                <IconSettings size={20} />
              </ActionIcon>

              <Avatar 
                variant="filled" 
                radius="xl" 
                color="#007BFF" 
                alt="User" 
                src="" 
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              />
            </Group>
          </Flex>
        </Container>
      </AppShell.Header>

      <AppShell.Main style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 11, height: '100%' }}>
          <Flex direction={isMobile ? 'column' : 'row'} justify="space-between" align="stretch" style={{ height: '100%', flexGrow: 1 }} gap="md">
            {/* Panel Kiri */}
            <Box
              style={{
                width: '20%',
                border: '1px solid #ccc',
                borderRadius: '8px',
                backgroundColor: computedColorScheme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 140px)',
                overflowY: 'auto',
              }}
            >
              <Text size="xs" fw={600} c="dimmed" mb="sm" ml="sm">
                Daftar Artikel
              </Text>

              <TextInput
                value={fileName}
                onChange={(e) => setFileName(e.currentTarget.value)}
                variant="unstyled"
                styles={{
                  input: {
                    fontWeight: 600,
                    fontSize: '17px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    backgroundColor: computedColorScheme === 'dark' ? '#007BFF' : '#007BFF',
                    marginBottom: '12px',
                    color: 'white',
                  },
                }}
              />

              {/* Enhanced Daftar heading dengan navigation dan level */}
              <Stack ml="sm" gap={8}>
                {headings.length === 0 ? (
                  <Box ta="center" py="md">
                    <Text size="xs" c="dimmed" mb="xs">
                      Outline artikel akan muncul di sini
                    </Text>
                    <Text size="xs" c="dimmed">
                      Gunakan AI untuk membuat konten dengan heading
                    </Text>
                  </Box>
                ) : (
                  headings.map(({ id, text, level }) => {
                    // Get icon berdasarkan level
                    const getHeadingIcon = () => {
                      switch(level) {
                        case 1: return '📝';
                        case 2: return '📌';
                        case 3: return '🔸';
                        case 4: return '▪️';
                        default: return '•';
                      }
                    };
                    
                    // Get indentation berdasarkan level
                    const getIndentation = () => {
                      return (level - 1) * 12;
                    };
                    
                    // Get color berdasarkan level
                    const getTextColor = () => {
                      switch(level) {
                        case 1: return '#1971c2';
                        case 2: return '#2f9e44';
                        case 3: return '#f76707';
                        case 4: return '#7048e8';
                        default: return '#495057';
                      }
                    };

                    return (
                      <Group
                        key={id}
                        gap="xs"
                        p="xs"
                        style={{ 
                          cursor: 'pointer',
                          marginLeft: getIndentation(),
                          borderRadius: 6,
                          transition: 'all 0.2s ease',
                          border: '1px solid transparent',
                        }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-200"
                        onClick={() => {
                          // Enhanced scroll function
                          try {
                            // Method 1: Cari berdasarkan block ID
                            const blockElement = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
                            if (blockElement) {
                              blockElement.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center' 
                              });
                              
                              // Highlight sementara
                              blockElement.style.background = 'rgba(59, 130, 246, 0.1)';
                              blockElement.style.borderLeft = '4px solid #3b82f6';
                              blockElement.style.borderRadius = '0 8px 8px 0';
                              setTimeout(() => {
                                blockElement.style.background = '';
                                blockElement.style.borderLeft = '';
                                blockElement.style.borderRadius = '';
                              }, 2000);
                              return;
                            }
                            
                            // Method 2: Fallback ke method lama
                            const element = document.getElementById(id) as HTMLElement;
                            if (element) {
                              element.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start' 
                              });
                            }
                          } catch (error) {
                            console.error('Error scrolling to heading:', error);
                          }
                        }}
                      >
                        <Text size="xs" style={{ minWidth: 16 }}>
                          {getHeadingIcon()}
                        </Text>
                        <Text
                          size="sm"
                          fw={level <= 2 ? 600 : 500}
                          style={{
                            color: getTextColor(),
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                          title={text}
                        >
                          {text}
                        </Text>
                        <Text size="xs" c="dimmed">
                          H{level}
                        </Text>
                      </Group>
                    );
                  })
                )}
              </Stack>
            </Box>

            <Split
              className="split"
              sizes={[70, 30]}
              minSize={300}
              expandToMin={false}
              gutterSize={10}
              gutterAlign="center"
              snapOffset={30}
              dragInterval={1}
              direction="horizontal"
              cursor="col-resize"
              style={{ display: 'flex', width: '100%' }}
            >
              {/* Panel Tengah - BlockNote Editor dengan AI Indonesia */}
              <Box
                style={{
                  width: isMobile ? '100%' : '60%',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  backgroundColor: computedColorScheme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                  padding: '10px',
                  flexGrow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  maxHeight: 'calc(100vh - 140px)',
                  height: '100%',
                  minHeight: '100%',
                }}
              >
                {/* BlockNote Editor Component dengan AI Indonesia */}
                <BlockNoteEditorComponent
                  onContentChange={handleContentChange}
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                />

                {/* Action Buttons */}
                <Group justify="flex-end" mt="sm" gap="md">
                  <Button 
                    variant="outline" 
                    color="gray" 
                    leftSection={<IconFilePlus size={18} />} 
                    radius="md" 
                    size="md" 
                    px={24} 
                    onClick={handleSaveDraft}
                    style={{
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Simpan Draf
                  </Button>

                  <Button 
                    variant="filled" 
                    color="blue" 
                    leftSection={<IconUpload size={18} />} 
                    radius="md" 
                    size="md" 
                    px={24} 
                    onClick={handleSaveFinal}
                    style={{
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Simpan Final
                  </Button>
                </Group>
              </Box>

              {/* Panel Kanan */}
              <Box
                style={{
                  width: isMobile ? '100%' : '20%',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  backgroundColor: computedColorScheme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  maxHeight: 'calc(100vh - 140px)',
                  height: '100%',
                  minHeight: '100%',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                }}
              >
                <Box
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '16px',
                    padding: '6px 3px',
                    borderRadius: '99px',
                    border: '2px solid #007BFF',
                    backgroundColor: 'transparent',
                    width: '10 px',
                    marginInline: '60px',
                  }}
                >
                  {[
                    { icon: <IconGraph size={20} />, value: 'knowledge', label: 'Knowledge Graph' },
                    { icon: <IconMessageCircle2 size={20} />, value: 'chat', label: 'Chat' },
                    { icon: <IconBrain size={20} />, value: 'ask', label: 'AI Assistant' },
                  ].map((item) => (
                    <ActionIcon
                      key={item.value}
                      onClick={() => setActiveTab(item.value)}
                      radius="xl"
                      size="md"
                      variant={activeTab === item.value ? 'filled' : 'transparent'}
                      color="#007BFF"
                      style={{
                        border: activeTab === item.value ? '2px solid transparent' : '2px solid #007BFF',
                        backgroundColor: activeTab === item.value ? '#007BFF' : 'transparent',
                        color: activeTab === item.value ? 'white' : '#007BFF',
                        transition: 'all 0.2s ease',
                      }}
                      title={item.label}
                    >
                      {item.icon}
                    </ActionIcon>
                  ))}
                </Box>

                {/* Tab Content */}
                <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {activeTab === 'knowledge' && (
                    <Box style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <NextImage 
                        src={knowledgeImage} 
                        alt="Knowledge Graph" 
                        width={200} 
                        height={150} 
                        style={{ margin: '0 auto' }} 
                      />
                      <Text size="sm" mt="md" c="dimmed">
                        Knowledge Graph akan muncul di sini
                      </Text>
                    </Box>
                  )}

                  {activeTab === 'chat' && (
                    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <Text size="sm" fw={600} mb="md" c="dimmed">
                        💬 Chat dengan AI
                      </Text>
                      <ScrollArea style={{ flex: 1, marginBottom: '10px' }}>
                        <Stack gap="xs">
                          {messages.length === 0 ? (
                            <Box
                              p="md"
                              style={{
                                backgroundColor: computedColorScheme === 'dark' ? '#444' : '#f0f8ff',
                                borderRadius: '8px',
                                textAlign: 'center',
                              }}
                            >
                              <IconMessageCircle2 size={32} style={{ margin: '0 auto 8px', color: '#007BFF' }} />
                              <Text size="sm" c="dimmed">
                                Mulai percakapan dengan AI assistant
                              </Text>
                            </Box>
                          ) : (
                            messages.map((msg, index) => (
                              <Box
                                key={index}
                                p="xs"
                                style={{
                                  backgroundColor: computedColorScheme === 'dark' ? '#444' : '#e7f3ff',
                                  borderRadius: '8px',
                                  marginLeft: index % 2 === 0 ? '0' : '20px',
                                  marginRight: index % 2 === 0 ? '20px' : '0',
                                }}
                              >
                                <Text size="sm">{msg}</Text>
                              </Box>
                            ))
                          )}
                        </Stack>
                      </ScrollArea>
                      <Group gap="xs">
                        <TextInput 
                          placeholder="Ketik pesan..." 
                          value={chatInput} 
                          onChange={(e) => setChatInput(e.currentTarget.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
                          style={{ flex: 1 }}
                          styles={{
                            input: {
                              borderColor: '#007BFF',
                              '&:focus': {
                                borderColor: '#007BFF',
                              }
                            }
                          }}
                        />
                        <ActionIcon 
                          onClick={sendMessage} 
                          color="blue" 
                          variant="filled"
                          size="lg"
                          style={{
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <IconSend size={16} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  )}

                  {activeTab === 'ask' && (
                    <Box style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <ThemeIcon
                        variant="gradient"
                        gradient={{ from: '#007BFF', to: '#0056b3', deg: 45 }}
                        size={80}
                        radius="xl"
                        mx="auto"
                        mb="md"
                        style={{
                          boxShadow: '0 4px 16px rgba(0, 123, 255, 0.3)',
                        }}
                      >
                        <IconBrain size={48} />
                      </ThemeIcon>
                      <Text fw={600} mb="xs">
                        🤖 Assistant AI
                      </Text>
                      <Text size="sm" c="dimmed" mb="md">
                        AI Assistant terintegrasi dengan editor untuk membantu menulis konten
                      </Text>
                      <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                        💡 Gunakan tombol AI di editor atau ketik "/" untuk mengakses fitur AI
                      </Text>
                    </Box>
                  )}
                </Box>
              </Box>
            </Split>
          </Flex>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}