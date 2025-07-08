'use client';

import { ActionIcon, AppShell, Avatar, Box, Burger, Button, Container, Flex, Group, Image, ScrollArea, Stack, Text, TextInput, Title, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import NextImage from 'next/image';

import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconBrain, IconFilePlus, IconGraph, IconMessageCircle2, IconMoon, IconSend, IconSettings, IconSun, IconUpload } from '@tabler/icons-react';
import { useState } from 'react';
import Split from 'react-split';
import BlockNoteEditorComponent from '../../components/BlockNoteEditor';
import myimage from '../imageCollection/LogoSRE_Fix.png';
import knowledgeImage from '../imageCollection/graph.png';

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
  const [headings, setHeadings] = useState<Array<{ id: string; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [editorContent, setEditorContent] = useState<any[]>([]);

  const sendMessage = () => {
    if (chatInput.trim() === '') return;
    setMessages((prev) => [...prev, chatInput]);
    setChatInput('');
  };

  const handleContentChange = (content: any[]) => {
    setEditorContent(content);

    // Extract headings from BlockNote content
    const extractedHeadings: { id: string; text: string }[] = [];
    content.forEach((block) => {
      if (block.type === 'heading' && block.content?.length > 0) {
        const text = block.content.map((item: any) => item.text || '').join('');
        if (text.trim()) {
          extractedHeadings.push({
            id: block.id || `heading-${Math.random().toString(36).substr(2, 9)}`,
            text: text.trim(),
          });
        }
      }
    });
    setHeadings(extractedHeadings);
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
        }}
      >
        <Container size="100%" h="100%">
          <Flex justify="space-between" align="center" h="100%" w="100%">
            <Group>
              <Burger size="sm" opened={navbarOpened} onClick={toggleNavbar} aria-label="Toggle navigation" />

              <Group gap="sm">
                <Image component={NextImage} src={myimage} alt="Logo" w={40} h={40} />
                <Title order={2} size="h3" fw={700} c="#007BFF">
                  Smart Research Engine
                </Title>
              </Group>
            </Group>

            <Group gap="md">
              <ActionIcon onClick={toggleColorScheme} variant="default" size="lg" aria-label="Toggle color scheme">
                {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              </ActionIcon>

              <ActionIcon variant="default" size="lg" aria-label="Settings">
                <IconSettings size={20} />
              </ActionIcon>

              <Avatar variant="filled" radius="xl" color="#007BFF" alt="User" src="" />
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
                  },
                }}
              />

              {/* Daftar heading hasil ketikan user */}
              <Stack ml="sm" gap={8}>
                {headings.map(({ id, text }) => (
                  <Text
                    key={id}
                    size="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const element = document.getElementById(id);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  >
                    {text}
                  </Text>
                ))}
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
              {/* Panel Tengah - BlockNote Editor */}
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
                {/* BlockNote Editor Component */}
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
                  <Button variant="outline" color="gray" leftSection={<IconFilePlus size={18} />} radius="md" size="md" px={24} onClick={handleSaveDraft}>
                    Simpan Draf
                  </Button>

                  <Button variant="filled" color="blue" leftSection={<IconUpload size={18} />} radius="md" size="md" px={24} onClick={handleSaveFinal}>
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
                    { icon: <IconGraph size={20} />, value: 'knowledge' },
                    { icon: <IconMessageCircle2 size={20} />, value: 'chat' },
                    { icon: <IconBrain size={20} />, value: 'ask' },
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
                      }}
                    >
                      {item.icon}
                    </ActionIcon>
                  ))}
                </Box>

                {/* Tab Content */}
                <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {activeTab === 'knowledge' && (
                    <Box style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <NextImage src={knowledgeImage} alt="Knowledge Graph" width={200} height={150} style={{ margin: '0 auto' }} />
                      <Text size="sm" mt="md" c="dimmed">
                        Knowledge Graph akan muncul di sini
                      </Text>
                    </Box>
                  )}

                  {activeTab === 'chat' && (
                    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <ScrollArea style={{ flex: 1, marginBottom: '10px' }}>
                        <Stack gap="xs">
                          {messages.map((msg, index) => (
                            <Box
                              key={index}
                              p="xs"
                              style={{
                                backgroundColor: computedColorScheme === 'dark' ? '#444' : '#e7f3ff',
                                borderRadius: '8px',
                              }}
                            >
                              <Text size="sm">{msg}</Text>
                            </Box>
                          ))}
                        </Stack>
                      </ScrollArea>
                      <Group gap="xs">
                        <TextInput placeholder="Ketik pesan..." value={chatInput} onChange={(e) => setChatInput(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} style={{ flex: 1 }} />
                        <ActionIcon onClick={sendMessage} color="blue" variant="filled">
                          <IconSend size={16} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  )}

                  {activeTab === 'ask' && (
                    <Box style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <IconBrain size={64} style={{ margin: '0 auto', color: '#007BFF' }} />
                      <Text size="sm" mt="md" c="dimmed">
                        AI Assistant akan muncul di sini
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
