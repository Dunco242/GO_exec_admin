"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    Bold, Italic, Strikethrough, Code, List, ListOrdered,
    Heading1, Heading2, Heading3, PilcrowSquare, Quote, SeparatorHorizontal, Undo, Redo
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface DocumentEditorProps {
    initialContent: string; // JSON string from TipTap output
    onSave: (content: string) => Promise<void>; // Callback to save content
    isSaving: boolean;
    isReadOnly: boolean; // New prop to control read-only mode
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ initialContent, onSave, isSaving, isReadOnly }) => {
    const { toast } = useToast();
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Disable history extension when readOnly, to prevent undo/redo actions
                history: isReadOnly ? false : {},
            }),
        ],
        content: initialContent,
        editable: !isReadOnly, // Set editable based on isReadOnly prop
        onUpdate: ({ editor }) => {
            // Optional: You can save content to a temporary state here if needed
            // For now, we rely on the explicit save button
        },
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert max-w-none min-h-[300px] p-4 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#2660ff]',
            },
        },
    });

    // Update editor content when initialContent changes
    useEffect(() => {
        if (editor && initialContent && editor.getHTML() !== initialContent) {
            editor.commands.setContent(initialContent, false); // false to prevent dispatching update event
        }
    }, [editor, initialContent]);

    // Update editable state when isReadOnly changes
    useEffect(() => {
        if (editor) {
            editor.setEditable(!isReadOnly);
        }
    }, [editor, isReadOnly]);

    const handleSaveClick = useCallback(async () => {
        if (editor) {
            const contentToSave = editor.getHTML();
            await onSave(contentToSave);
        }
    }, [editor, onSave]);

    if (!editor) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">Document Content</CardTitle>
                {!isReadOnly && (
                    <div className="flex items-center space-x-2">
                        <Button onClick={handleSaveClick} disabled={isSaving} className="bg-[#2660ff] hover:bg-[#1a4cd1]">
                            {isSaving ? 'Saving...' : 'Save Document'}
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {!isReadOnly && (
                    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-x rounded-t-md bg-gray-50 dark:bg-gray-800">
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('bold')}
                            onPressedChange={() => editor.chain().focus().toggleBold().run()}
                            disabled={!editor.can().chain().focus().toggleBold().run()}
                        >
                            <Bold className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('italic')}
                            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                            disabled={!editor.can().chain().focus().toggleItalic().run()}
                        >
                            <Italic className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('strike')}
                            onPressedChange={() => editor.chain().focus().toggleStrike().run()}
                            disabled={!editor.can().chain().focus().toggleStrike().run()}
                        >
                            <Strikethrough className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('code')}
                            onPressedChange={() => editor.chain().focus().toggleCode().run()}
                            disabled={!editor.can().chain().focus().toggleCode().run()}
                        >
                            <Code className="h-4 w-4" />
                        </Toggle>
                        <span className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" /> {/* Separator */}
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('heading', { level: 1 })}
                            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        >
                            <Heading1 className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('heading', { level: 2 })}
                            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        >
                            <Heading2 className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('heading', { level: 3 })}
                            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        >
                            <Heading3 className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('paragraph')}
                            onPressedChange={() => editor.chain().focus().setParagraph().run()}
                        >
                            <PilcrowSquare className="h-4 w-4" />
                        </Toggle>
                        <span className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" /> {/* Separator */}
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('bulletList')}
                            onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                        >
                            <List className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('orderedList')}
                            onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                        >
                            <ListOrdered className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('blockquote')}
                            onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                        >
                            <Quote className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
                        >
                            <SeparatorHorizontal className="h-4 w-4" />
                        </Toggle>
                        <span className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" /> {/* Separator */}
                        <Toggle
                            size="sm"
                            onPressedChange={() => editor.chain().focus().undo().run()}
                            disabled={!editor.can().chain().focus().undo().run()}
                        >
                            <Undo className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            onPressedChange={() => editor.chain().focus().redo().run()}
                            disabled={!editor.can().chain().focus().redo().run()}
                        >
                            <Redo className="h-4 w-4" />
                        </Toggle>
                    </div>
                )}
                <EditorContent editor={editor} />
            </CardContent>
        </Card>
    );
};

export default DocumentEditor;
