// components/DocumentOutline.tsx
import { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Stack,
  Group,
  ActionIcon,
  Tooltip,
  Menu,
  Card,
  ThemeIcon,
  Badge,
  ScrollArea,
} from '@mantine/core';
import {
  IconOutlet,
  IconEdit,
  IconTrash,
  IconDots,
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconH5,
  IconH6,
  IconChevronRight,
} from '@tabler/icons-react';
import { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';

interface HeadingItem {
  id: string;
  level: number;
  text: string;
  position: number;
}

interface DocumentOutlineProps {
  editor: Editor | null;
}

export default function DocumentOutline({ editor }: DocumentOutlineProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const headingItems: HeadingItem[] = [];
      const doc = editor.state.doc;
      
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headingItems.push({
            id: `heading-${pos}`,
            level: node.attrs.level,
            text: node.textContent || `Heading ${node.attrs.level}`,
            position: pos,
          });
        }
      });
      
      setHeadings(headingItems);
    };

    updateHeadings();
    
    // Use the correct event listener method
    const handleUpdate = () => {
      updateHeadings();
    };
    
    editor.on('update', handleUpdate);
    
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  const scrollToHeading = (position: number) => {
    if (!editor) return;
    
    editor.commands.focus();
    editor.commands.setTextSelection(position);
    
    // Scroll to the heading in the editor
    editor.view.dispatch(
        editor.state.tr.setSelection(
            TextSelection.near(editor.state.doc.resolve(position))
        ).scrollIntoView()
    );
  };

  const deleteHeading = (position: number) => {
    if (!editor) return;
    
    editor.commands.focus();
    editor.commands.setTextSelection(position);
    editor.commands.deleteSelection();
  };

  const editHeading = (position: number) => {
    if (!editor) return;
    
    editor.commands.focus();
    editor.commands.setTextSelection(position);
  };

  const getHeadingIcon = (level: number) => {
    const icons = {
      1: IconH1,
      2: IconH2,
      3: IconH3,
      4: IconH4,
      5: IconH5,
      6: IconH6,
    };
    const Icon = icons[level as keyof typeof icons] || IconH1;
    return <Icon size={14} />;
  };

  const getIndentation = (level: number) => {
    return (level - 1) * 16;
  };

  return (
    <Card shadow="sm" padding="md" radius="lg" h="100%" withBorder>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon variant="light" color="grape" size="sm">
            <IconOutlet size={16} />
          </ThemeIcon>
          <Text size="sm" fw={600}>Document Outline</Text>
        </Group>
        <Badge variant="light" color="grape" size="xs">
          {headings.length}
        </Badge>
      </Group>

      <ScrollArea h="calc(100% - 60px)">
        {headings.length === 0 ? (
          <Box ta="center" py="xl">
            <Text size="sm" c="dimmed">
              No headings found
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Add headings to see document structure
            </Text>
          </Box>
        ) : (
          <Stack gap="xs">
            {headings.map((heading) => (
              <Group
                key={heading.id}
                gap="xs"
                p="xs"
                style={{
                  marginLeft: getIndentation(heading.level),
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => scrollToHeading(heading.position)}
              >
                <ThemeIcon 
                  variant="light" 
                  color="blue" 
                  size="xs"
                  style={{ minWidth: 20, minHeight: 20 }}
                >
                  {getHeadingIcon(heading.level)}
                </ThemeIcon>
                
                <Text 
                  size="sm" 
                  style={{ 
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={heading.text}
                >
                  {heading.text}
                </Text>

                <Menu shadow="md" width={150}>
                  <Menu.Target>
                    <ActionIcon 
                      variant="subtle" 
                      size="xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconDots size={12} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconEdit size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        editHeading(heading.position);
                      }}
                    >
                      Edit
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconTrash size={14} />}
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHeading(heading.position);
                      }}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Card>
  );
}