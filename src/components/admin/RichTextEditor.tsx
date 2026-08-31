"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { looksLikeHtml, plainTextToHtml } from "@/lib/rich-text";

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`border border-line px-2 py-1 text-xs font-semibold ${
        active ? "bg-charcoal text-white" : "bg-white text-charcoal hover:bg-line/40"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1 border border-b-0 border-line bg-white p-1.5">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        U
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </ToolbarButton>
      <ToolbarButton
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt("Link URL");
          if (!url) return;
          editor.chain().focus().setLink({ href: url, target: "_blank", rel: "noopener noreferrer" }).run();
        }}
      >
        Link
      </ToolbarButton>
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        Undo
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        Redo
      </ToolbarButton>
    </div>
  );
}

// Hidden <input type="hidden"> doesn't support the HTML `required`
// constraint at all (excluded by spec) — the caller must validate
// emptiness itself after reading the FormData value, same as any other
// derived/computed field in this form.
export function RichTextEditor({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  const [html, setHtml] = useState(() =>
    defaultValue ? (looksLikeHtml(defaultValue) ? defaultValue : plainTextToHtml(defaultValue)) : "",
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
        link: { openOnClick: false, autolink: true },
      }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class:
          // normal-case counters the "uppercase" label styling this field is
          // nested under (src/components/admin/ProductForm.tsx) — a
          // contenteditable div inherits text-transform, unlike the plain
          // <textarea> this replaced.
          "min-h-[140px] w-full border border-line bg-white px-3 py-2 text-sm normal-case text-charcoal focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-display [&_h2]:text-lg [&_h3]:font-display [&_h3]:text-base [&_a]:text-forest [&_a]:underline",
      },
    },
    onUpdate: ({ editor }) => {
      setHtml(editor.isEmpty ? "" : editor.getHTML());
    },
  });

  if (!editor) {
    return <div className="mt-1 h-[176px] w-full animate-pulse border border-line bg-white" />;
  }

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
