import React, { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Heading from '@tiptap/extension-heading';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Quote, Code, Undo2, Redo2, Download } from 'lucide-react';
import 'tippy.js/dist/tippy.css';
import { cn } from '@/lib/utils';

type CanvasEditorMode = 'edit' | 'readonly';

export interface CanvasEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  mode?: CanvasEditorMode;
  className?: string;
  onDownload?: (content: string) => void;
  title?: string;
  subtitle?: string;
  meta?: React.ReactNode;
  showToolbar?: boolean;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  label: string;
  icon: React.ReactNode;
}> = ({ onClick, isActive, disabled, label, icon }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-40',
      isActive && 'bg-primary/10 text-primary'
    )}
    aria-label={label}
  >
    {icon}
  </button>
);

const CanvasEditor: React.FC<CanvasEditorProps> = ({
  value,
  onChange,
  placeholder = 'AI is composing the lesson…',
  mode = 'readonly',
  className,
  onDownload,
  title = 'Live Learning Canvas',
  subtitle,
  meta,
  showToolbar = true
}) => {
  const lowlight = useMemo(() => createLowlight(common), []);
  const editable = mode === 'edit';

  const editor = useEditor({
    content: value,
    editable,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false
      }),
      Heading.configure({ levels: [1, 2, 3, 4] }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline-offset-4 underline' } }),
      CodeBlockLowlight.configure({ lowlight })
    ],
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-slate dark:prose-invert focus:outline-none max-w-none text-base leading-relaxed',
          'prose-headings:font-semibold prose-headings:text-foreground prose-h3:text-lg prose-h4:text-base',
          'prose-strong:text-foreground prose-em:text-foreground prose-code:text-primary',
          'prose-p:my-3 prose-li:my-1'
        )
      }
    },
    onUpdate: ({ editor }) => {
      if (editable && onChange) {
        onChange(editor.getHTML());
      }
    }
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const toolbarActions = useMemo(
    () => [
      {
        icon: <Bold className="h-4 w-4" />,
        label: 'Bold',
        run: () => editor?.chain().focus().toggleBold().run(),
        active: editor?.isActive('bold') ?? false
      },
      {
        icon: <Italic className="h-4 w-4" />,
        label: 'Italic',
        run: () => editor?.chain().focus().toggleItalic().run(),
        active: editor?.isActive('italic') ?? false
      },
      {
        icon: <UnderlineIcon className="h-4 w-4" />,
        label: 'Underline',
        run: () => editor?.chain().focus().toggleUnderline().run(),
        active: editor?.isActive('underline') ?? false
      },
      {
        icon: <Strikethrough className="h-4 w-4" />,
        label: 'Strikethrough',
        run: () => editor?.chain().focus().toggleStrike().run(),
        active: editor?.isActive('strike') ?? false
      },
      {
        icon: <List className="h-4 w-4" />,
        label: 'Bullet List',
        run: () => editor?.chain().focus().toggleBulletList().run(),
        active: editor?.isActive('bulletList') ?? false
      },
      {
        icon: <ListOrdered className="h-4 w-4" />,
        label: 'Ordered List',
        run: () => editor?.chain().focus().toggleOrderedList().run(),
        active: editor?.isActive('orderedList') ?? false
      },
      {
        icon: <Quote className="h-4 w-4" />,
        label: 'Blockquote',
        run: () => editor?.chain().focus().toggleBlockquote().run(),
        active: editor?.isActive('blockquote') ?? false
      },
      {
        icon: <Code className="h-4 w-4" />,
        label: 'Inline code',
        run: () => editor?.chain().focus().toggleCode().run(),
        active: editor?.isActive('code') ?? false
      }
    ],
    [editor]
  );

  if (!editor) {
    return (
      <div className={cn('rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6 text-sm text-muted-foreground', className)}>
        Loading canvas…
      </div>
    );
  }

  const handleDownload = () => {
    const blob = new Blob([editor.getHTML()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `learning-canvas-${Date.now()}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    onDownload?.(editor.getHTML());
  };

  return (
    <div className={cn('rounded-3xl border border-slate-800/60 bg-slate-950/40 shadow-2xl shadow-cyan-950/40', className)}>
      <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">{title}</p>
          {subtitle && <p className="text-[0.7rem] text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {meta && <div className="hidden sm:block text-right text-xs text-slate-400">{meta}</div>}
          <button
            type="button"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editable}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:text-foreground disabled:opacity-30"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editable}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:text-foreground disabled:opacity-30"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 rounded-md border border-slate-800/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-slate-800/30"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {editable && showToolbar && (
        <div className="flex flex-wrap gap-1 border-b border-slate-800/60 bg-slate-950/60 px-3 py-2">
          {toolbarActions.map(action => (
            <ToolbarButton
              key={action.label}
              icon={action.icon}
              label={action.label}
              onClick={action.run}
              isActive={action.active}
              disabled={!editable}
            />
          ))}
        </div>
      )}

      <div className="relative">
        {!editable && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-slate-950/40 to-transparent" />
        )}
        <EditorContent editor={editor} className="px-6 py-6" />
      </div>

    </div>
  );
};

export default CanvasEditor;
