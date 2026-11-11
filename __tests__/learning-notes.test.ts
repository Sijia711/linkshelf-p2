import { describe, it, expect } from "vitest";
import {
  DEFAULT_EMPTY_NOTE_DOC,
  validateTiptapContent,
} from "@/lib/learning-notes";

describe("Learning Notes Pure Helpers & Validation", () => {
  it("provides a standard valid empty doc default", () => {
    expect(DEFAULT_EMPTY_NOTE_DOC.type).toBe("doc");
    expect(Array.isArray(DEFAULT_EMPTY_NOTE_DOC.content)).toBe(true);
    expect(DEFAULT_EMPTY_NOTE_DOC.content?.[0].type).toBe("paragraph");
  });

  describe("validateTiptapContent", () => {
    it("accepts valid default empty document", () => {
      const res = validateTiptapContent(DEFAULT_EMPTY_NOTE_DOC);
      expect(res.isValid).toBe(true);
      expect(res.data?.type).toBe("doc");
    });

    it("accepts rich document with headings, paragraphs, lists, marks, and codeblocks", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "LLM Study Notes" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Key insights on attention mechanisms: ",
                marks: [{ type: "bold" }],
              },
              {
                type: "text",
                text: "Query, Key, Value vectors.",
                marks: [{ type: "italic" }],
              },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Multi-head attention" }],
                  },
                ],
              },
            ],
          },
          {
            type: "codeBlock",
            attrs: { language: "python" },
            content: [{ type: "text", text: "import torch\nimport torch.nn as nn" }],
          },
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Attention is all you need." }],
              },
            ],
          },
        ],
      };

      const res = validateTiptapContent(doc);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("rejects non-object inputs", () => {
      expect(validateTiptapContent(null).isValid).toBe(false);
      expect(validateTiptapContent("string").isValid).toBe(false);
      expect(validateTiptapContent(123).isValid).toBe(false);
      expect(validateTiptapContent([]).isValid).toBe(false);
      expect(validateTiptapContent(undefined).isValid).toBe(false);
    });

    it("rejects document when root type is not 'doc'", () => {
      const res = validateTiptapContent({ type: "paragraph", content: [] });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Root document must have type "doc"');
    });

    it("rejects node with invalid or empty type", () => {
      const doc = {
        type: "doc",
        content: [{ type: "", content: [] }],
      };
      const res = validateTiptapContent(doc);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("non-empty string type");
    });

    it("rejects text node with non-string text property", () => {
      const doc = {
        type: "doc",
        content: [{ type: "text", text: 12345 }],
      };
      const res = validateTiptapContent(doc);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("text property must be a string");
    });

    it("rejects invalid marks format", () => {
      const doc1 = {
        type: "doc",
        content: [{ type: "text", text: "hello", marks: "bold" }],
      };
      expect(validateTiptapContent(doc1).isValid).toBe(false);

      const doc2 = {
        type: "doc",
        content: [{ type: "text", text: "hello", marks: [{ type: 123 }] }],
      };
      expect(validateTiptapContent(doc2).isValid).toBe(false);
    });

    it("rejects document exceeding maximum nesting depth", () => {
      // Build a deeply nested structure exceeding maxDepth of 5
      let deepNode: Record<string, unknown> = { type: "paragraph", content: [] };
      for (let i = 0; i < 6; i++) {
        deepNode = { type: "listItem", content: [deepNode] };
      }
      const doc = { type: "doc", content: [deepNode] };

      const res = validateTiptapContent(doc, 5);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("nesting depth");
    });

    it("rejects payload exceeding max serialized size", () => {
      const largeText = "A".repeat(1000);
      const doc = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: largeText }] }],
      };

      const res = validateTiptapContent(doc, 20, 500);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("exceeds maximum allowed size");
    });
  });
});
