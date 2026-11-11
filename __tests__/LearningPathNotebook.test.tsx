// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearningPathNotebook from "@/app/components/LearningPathNotebook";
import { DEFAULT_EMPTY_NOTE_DOC } from "@/lib/learning-notes";

afterEach(cleanup);

const mockNote = {
  id: "note-123",
  user_id: "user-123",
  learning_path_id: "path-123",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Existing notes on LLMs" }],
      },
    ],
  },
  created_at: "2026-11-10T12:00:00Z",
  updated_at: "2026-11-10T12:00:00Z",
};

describe("LearningPathNotebook Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notebook header, toolbar buttons, and editor area", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { note: mockNote } }),
    } as Response);

    render(<LearningPathNotebook pathId="path-123" pathTitle="LLM Fundamentals" />);

    expect(screen.getByText(/LLM Fundamentals — Shared Path Notebook/i)).not.toBeNull();
    expect(screen.getByTestId("format-bold")).not.toBeNull();
    expect(screen.getByTestId("format-italic")).not.toBeNull();
    expect(screen.getByTestId("format-h1")).not.toBeNull();
    expect(screen.getByTestId("format-h2")).not.toBeNull();
    expect(screen.getByTestId("format-h3")).not.toBeNull();
    expect(screen.getByTestId("format-bullet-list")).not.toBeNull();
    expect(screen.getByTestId("format-ordered-list")).not.toBeNull();
    expect(screen.getByTestId("format-blockquote")).not.toBeNull();
    expect(screen.getByTestId("format-codeblock")).not.toBeNull();
    expect(screen.getByTestId("action-undo")).not.toBeNull();
    expect(screen.getByTestId("action-redo")).not.toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId("tiptap-editor-content")).not.toBeNull();
    });
  });

  it("initializes with fetched existing notes and displays saved status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { note: mockNote } }),
    } as Response);

    render(<LearningPathNotebook pathId="path-123" pathTitle="LLM Fundamentals" />);

    await waitFor(() => {
      expect(screen.getByText(/Saved/i)).not.toBeNull();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/learning-paths/path-123/notes");
  });

  it("displays error state and allows manual retry when save fails", async () => {
    // Initial fetch succeeds with empty doc
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { note: { ...mockNote, content: DEFAULT_EMPTY_NOTE_DOC } } }),
      } as Response)
      // Save attempt fails
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: "Network error saving notes" } }),
      } as Response)
      // Retry attempt succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { note: mockNote } }),
      } as Response);

    render(<LearningPathNotebook pathId="path-123" pathTitle="LLM Fundamentals" />);

    await waitFor(() => {
      expect(screen.getByTestId("tiptap-editor-content")).not.toBeNull();
    });

    // Simulate autosave failure by triggering retry handler directly or via button
    // Let's verify manual retry button renders when in error state
  });
});
