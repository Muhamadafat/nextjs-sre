'use client';

import '@blocknote/core/fonts/inter.css';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { useComputedColorScheme } from '@mantine/core';
import React from 'react';

interface BlockNoteEditorProps {
  onContentChange?: (content: any[]) => void;
  style?: React.CSSProperties;
}

export default function BlockNoteEditorComponent({ onContentChange, style }: BlockNoteEditorProps) {
  const computedColorScheme = useComputedColorScheme('light');

  // Creates a new editor instance
  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: 'heading',
        props: {
          level: 1,
        },
        content: 'Judul Artikel Anda',
      },
      {
        type: 'paragraph',
        content: "Mulai menulis artikel Anda di sini. Ketik '/' untuk melihat semua opsi formatting yang tersedia.",
      },
      {
        type: 'paragraph',
        content: 'BlockNote mendukung berbagai fitur seperti heading, bold, italic, lists, dan masih banyak lagi!',
      },
    ],
  });

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
          console.error('Error getting editor content:', error);
        }
      }, 1000); // Debounce untuk 1 detik
    };

    // Listen for focus events sebagai trigger
    const editorElement = document.querySelector('[data-editor="true"]');
    if (editorElement) {
      editorElement.addEventListener('input', handleContentChange);
      editorElement.addEventListener('keyup', handleContentChange);
    }

    // Initial content
    handleContentChange();

    return () => {
      clearTimeout(timeoutId);
      if (editorElement) {
        editorElement.removeEventListener('input', handleContentChange);
        editorElement.removeEventListener('keyup', handleContentChange);
      }
    };
  }, [editor, onContentChange]);

  return (
    <div style={{ ...style, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <BlockNoteView editor={editor} theme={computedColorScheme === 'dark' ? 'dark' : 'light'} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  );
}