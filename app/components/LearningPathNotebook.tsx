"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DEFAULT_EMPTY_NOTE_DOC } from "@/lib/learning-notes";
import type { TiptapNode } from "@/types/learning-path";

interface Props {
  pathId: string;
  pathTitle: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function LearningPathNotebook({ pathId, pathTitle }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<TiptapNode | null>(null);

  const saveContent = useCallback(
    async (content: TiptapNode) => {
      setSaveStatus("saving");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/learning-paths/${pathId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message ?? "Failed to save notes");
        }
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        pendingContentRef.current = null;
      } catch (err) {
        setSaveStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to save notes");
      }
    },
    [pathId]
  );

  const handleManualRetry = () => {
    if (pendingContentRef.current) {
      void saveContent(pendingContentRef.current);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
    ],
    content: DEFAULT_EMPTY_NOTE_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[360px] p-4 text-gray-900 leading-relaxed font-sans text-base",
        "aria-label": `Rich text notebook for ${pathTitle}`,
        "data-testid": "tiptap-editor-content",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const json = updatedEditor.getJSON() as TiptapNode;
      pendingContentRef.current = json;
      setSaveStatus("saving");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        void saveContent(json);
      }, 1000);
    },
  });

  // Load initial content from API once
  useEffect(() => {
    let isMounted = true;
    const fetchNote = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/learning-paths/${pathId}/notes`);
        const json = await res.json();
        if (res.ok && json.data?.note?.content && isMounted && editor) {
          editor.commands.setContent(json.data.note.content);
          if (json.data.note.updated_at) {
            setSaveStatus("saved");
            setLastSavedTime(
              new Date(json.data.note.updated_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            );
          }
        }
      } catch (err) {
        console.error("Failed to load path notes:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (editor) {
      void fetchNote();
    }

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [pathId, editor]);

  if (!editor) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      {/* Notebook Header & Autosave Status */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {pathTitle} — Shared Path Notebook
          </h3>
          <p className="text-xs text-gray-500">
            One persistent notebook for all resources and tutorials in this path.
          </p>
        </div>

        <div className="flex items-center gap-2" data-testid="autosave-status">
          {isLoading && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              Loading note...
            </span>
          )}
          {!isLoading && saveStatus === "saving" && (
            <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Saving...
            </span>
          )}
          {!isLoading && saveStatus === "saved" && (
            <span className="text-xs font-medium text-green-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Saved {lastSavedTime ? `at ${lastSavedTime}` : ""}
            </span>
          )}
          {!isLoading && saveStatus === "error" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-red-600">
                {errorMessage ?? "Save failed"}
              </span>
              <button
                type="button"
                onClick={handleManualRetry}
                className="px-2 py-0.5 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium transition cursor-pointer"
                data-testid="retry-save-button"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor Formatting Toolbar */}
      <div
        className="bg-gray-100 border-b border-gray-200 p-2 flex flex-wrap items-center gap-1"
        role="toolbar"
        aria-label="Notebook Formatting Controls"
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2.5 py-1 text-xs font-bold rounded transition cursor-pointer ${
            editor.isActive("bold")
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Bold (Ctrl+B / Cmd+B)"
          aria-label="Bold"
          data-testid="format-bold"
        >
          B
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2.5 py-1 text-xs italic rounded transition cursor-pointer ${
            editor.isActive("italic")
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Italic (Ctrl+I / Cmd+I)"
          aria-label="Italic"
          data-testid="format-italic"
        >
          I
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
            editor.isActive("heading", { level: 1 })
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Heading 1"
          aria-label="Heading 1"
          data-testid="format-h1"
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
            editor.isActive("heading", { level: 2 })
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Heading 2"
          aria-label="Heading 2"
          data-testid="format-h2"
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
            editor.isActive("heading", { level: 3 })
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Heading 3"
          aria-label="Heading 3"
          data-testid="format-h3"
        >
          H3
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
            editor.isActive("bulletList")
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Bullet List"
          aria-label="Bullet List"
          data-testid="format-bullet-list"
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
            editor.isActive("orderedList")
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Numbered List"
          aria-label="Numbered List"
          data-testid="format-ordered-list"
        >
          1. List
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2.5 py-1 text-xs rounded transition cursor-pointer ${
            editor.isActive("blockquote")
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Blockquote"
          aria-label="Blockquote"
          data-testid="format-blockquote"
        >
          &ldquo; Quote
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2.5 py-1 text-xs font-mono rounded transition cursor-pointer ${
            editor.isActive("codeBlock")
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-200 border border-gray-300"
          }`}
          title="Code Block"
          aria-label="Code Block"
          data-testid="format-codeblock"
        >
          &lt;/&gt;
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="px-2.5 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          title="Undo (Ctrl+Z / Cmd+Z)"
          aria-label="Undo"
          data-testid="action-undo"
        >
          ↺ Undo
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="px-2.5 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          title="Redo (Ctrl+Y / Cmd+Y)"
          aria-label="Redo"
          data-testid="action-redo"
        >
          ↻ Redo
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="bg-white min-h-[360px] cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
