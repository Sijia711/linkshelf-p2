// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BULK_DELETE_ERROR_MESSAGE,
  BookmarkWorkspace,
  DELETE_ERROR_MESSAGE,
  RESTORE_ERROR_MESSAGE,
} from "../BookmarkWorkspace";
import { SAVE_ERROR_MESSAGE } from "../BookmarkFormModal";
import type { BookmarkRecord, BookmarkWorkspaceProps } from "../types";

afterEach(cleanup);

function makeBookmark(id: string, title: string, url: string, tags: string[]): BookmarkRecord {
  return { id, title, url, tags, createdAt: "2026-11-05T10:00:00.000Z", updatedAt: "2026-11-05T10:00:00.000Z" };
}

const SAMPLE: BookmarkRecord[] = [
  makeBookmark("1", "MDN Web Docs", "https://developer.mozilla.org", ["dev", "reference"]),
  makeBookmark("2", "A List Apart", "https://alistapart.com", ["design", "reading"]),
  makeBookmark("3", "Postgres Documentation", "https://postgresql.org/docs", ["dev", "reference"]),
];

function makeCallbacks() {
  return {
    onCreate: vi.fn<BookmarkWorkspaceProps["onCreate"]>(async () => {}),
    onUpdate: vi.fn<BookmarkWorkspaceProps["onUpdate"]>(async () => {}),
    onDelete: vi.fn<BookmarkWorkspaceProps["onDelete"]>(async () => {}),
    onBulkDelete: vi.fn<BookmarkWorkspaceProps["onBulkDelete"]>(async () => {}),
    onRestore: vi.fn<BookmarkWorkspaceProps["onRestore"]>(async () => {}),
  };
}

function setup(props: Partial<Omit<BookmarkWorkspaceProps, keyof ReturnType<typeof makeCallbacks>>> = {}) {
  const callbacks = makeCallbacks();
  const user = userEvent.setup();
  const allProps: BookmarkWorkspaceProps = { bookmarks: SAMPLE, ...props, ...callbacks };
  const utils = render(<BookmarkWorkspace {...allProps} />);
  const rerenderWith = (bookmarks: BookmarkRecord[]) =>
    utils.rerender(<BookmarkWorkspace {...allProps} bookmarks={bookmarks} />);
  return { ...callbacks, user, rerenderWith };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const cardTitles = () => screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

async function selectCards(user: ReturnType<typeof userEvent.setup>, ...titles: string[]) {
  for (const title of titles) {
    await user.click(screen.getByRole("checkbox", { name: `Select ${title}` }));
  }
}

describe("BookmarkWorkspace — display states", () => {
  it("renders a card for every bookmark", () => {
    setup();
    expect(cardTitles()).toEqual(["MDN Web Docs", "A List Apart", "Postgres Documentation"]);
  });

  it("shows the empty state when there are no bookmarks", () => {
    setup({ bookmarks: [] });
    expect(screen.getByText("No bookmarks saved yet. Add your first bookmark.")).not.toBeNull();
  });

  it("shows a loading state while the first load is in progress", () => {
    setup({ bookmarks: [], isLoading: true });
    expect(screen.getByRole("status").textContent).toBe("Loading bookmarks…");
  });

  it("shows the parent's error message instead of a misleading empty state", () => {
    setup({ bookmarks: [], errorMessage: "Could not load bookmarks." });
    expect(screen.getByRole("alert").textContent).toBe("Could not load bookmarks.");
    expect(screen.queryByText("No bookmarks saved yet. Add your first bookmark.")).toBeNull();
  });
});

describe("BookmarkWorkspace — search and tag filter", () => {
  it("filters by title case-insensitively", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search bookmarks by title" }), "DOC");
    expect(cardTitles()).toEqual(["MDN Web Docs", "Postgres Documentation"]);
  });

  it("combines the search with the selected tag, and All clears the tag", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "reference" }));
    expect(cardTitles()).toEqual(["MDN Web Docs", "Postgres Documentation"]);

    await user.type(screen.getByRole("searchbox"), "postgres");
    expect(cardTitles()).toEqual(["Postgres Documentation"]);

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(cardTitles()).toEqual(["Postgres Documentation"]);
  });

  it("shows the no-results message when nothing matches", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No bookmarks match your search or filter.")).not.toBeNull();
  });
});

describe("BookmarkWorkspace — add and edit", () => {
  it("opens the Add dialog and returns focus to the button after Escape", async () => {
    const { user, onCreate } = setup();
    const addButton = screen.getByRole("button", { name: "+ Add Bookmark" });
    await user.click(addButton);
    expect(screen.getByRole("dialog", { name: "Add Bookmark" })).not.toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(addButton);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("sends normalized input to onCreate exactly once, then closes", async () => {
    const { user, onCreate } = setup();
    await user.click(screen.getByRole("button", { name: "+ Add Bookmark" }));
    await user.type(screen.getByLabelText("Title"), "  React docs  ");
    await user.type(screen.getByLabelText("URL"), "https://react.dev");
    await user.type(screen.getByLabelText("Tags (optional)"), "React, react, Docs");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({ title: "React docs", url: "https://react.dev", tags: ["react", "docs"] });
  });

  it("does not send duplicate requests while saving", async () => {
    const { user, onCreate } = setup();
    const pending = deferred();
    onCreate.mockImplementation(() => pending.promise);

    await user.click(screen.getByRole("button", { name: "+ Add Bookmark" }));
    await user.type(screen.getByLabelText("Title"), "React");
    await user.type(screen.getByLabelText("URL"), "https://react.dev");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Saving…" }));
    await user.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the dialog open with the typed values when onCreate rejects", async () => {
    const { user, onCreate } = setup();
    onCreate.mockRejectedValueOnce(new Error("network"));

    await user.click(screen.getByRole("button", { name: "+ Add Bookmark" }));
    await user.type(screen.getByLabelText("Title"), "React");
    await user.type(screen.getByLabelText("URL"), "https://react.dev");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const dialog = screen.getByRole("dialog");
    expect((await within(dialog).findByRole("alert")).textContent).toBe(SAVE_ERROR_MESSAGE);
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("React");
    expect((screen.getByLabelText("URL") as HTMLInputElement).value).toBe("https://react.dev");
  });

  it("edits a bookmark by sending its ID and the new fields", async () => {
    const { user, onUpdate, onCreate } = setup();
    await user.click(screen.getByRole("button", { name: "Edit MDN Web Docs" }));
    expect(screen.getByRole("dialog", { name: "Edit Bookmark" })).not.toBeNull();

    const title = screen.getByLabelText("Title") as HTMLInputElement;
    expect(title.value).toBe("MDN Web Docs");
    await user.clear(title);
    await user.type(title, "MDN");
    await user.type(screen.getByLabelText("Tags (optional)"), ", docs");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onUpdate).toHaveBeenCalledWith("1", {
      title: "MDN",
      url: "https://developer.mozilla.org",
      tags: ["dev", "reference", "docs"],
    });
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("BookmarkWorkspace — single delete", () => {
  it("asks for confirmation and does nothing on Cancel", async () => {
    const { user, onDelete } = setup();
    await user.click(screen.getByRole("button", { name: "Delete MDN Web Docs" }));
    const dialog = screen.getByRole("dialog", { name: "Delete bookmark?" });
    expect(dialog.textContent).toContain("MDN Web Docs");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete with the bookmark ID after confirmation", async () => {
    const { user, onDelete, onBulkDelete } = setup();
    await user.click(screen.getByRole("button", { name: "Delete A List Apart" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).toHaveBeenCalledWith("2");
    expect(onBulkDelete).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the dialog open when onDelete rejects", async () => {
    const { user, onDelete } = setup();
    onDelete.mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getByRole("button", { name: "Delete A List Apart" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(DELETE_ERROR_MESSAGE);
    expect(cardTitles()).toContain("A List Apart");
  });
});

describe("BookmarkWorkspace — selection, bulk delete, and Undo", () => {
  it("shows the selected count and only bulk-deletes the selected IDs", async () => {
    const { user, onBulkDelete } = setup();
    await selectCards(user, "MDN Web Docs", "A List Apart", "Postgres Documentation");
    await selectCards(user, "A List Apart"); // deselect
    expect(screen.getByText("2 selected")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Delete Selected" }));
    const dialog = screen.getByRole("dialog", { name: "Delete 2 selected bookmarks?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete Selected" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onBulkDelete).toHaveBeenCalledTimes(1);
    expect(onBulkDelete).toHaveBeenCalledWith(["1", "3"]);
    expect(screen.queryByText("2 selected")).toBeNull();
    expect(screen.getByText("Deleted 2 bookmarks.")).not.toBeNull();
  });

  it("cancelling the bulk confirmation keeps the selection and deletes nothing", async () => {
    const { user, onBulkDelete } = setup();
    await selectCards(user, "MDN Web Docs");
    await user.click(screen.getByRole("button", { name: "Delete Selected" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(onBulkDelete).not.toHaveBeenCalled();
    expect(screen.getByText("1 selected")).not.toBeNull();
  });

  it("Undo restores the last successfully deleted batch", async () => {
    const { user, onRestore } = setup();
    await selectCards(user, "MDN Web Docs", "A List Apart");
    await user.click(screen.getByRole("button", { name: "Delete Selected" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Selected" }));

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(onRestore).toHaveBeenCalledWith(["1", "2"]);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Undo" })).toBeNull());
  });

  it("a new bulk delete replaces the batch that Undo restores", async () => {
    const { user, onRestore } = setup();
    for (const title of ["MDN Web Docs", "A List Apart"]) {
      await selectCards(user, title);
      await user.click(screen.getByRole("button", { name: "Delete Selected" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Selected" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }

    expect(screen.getByText("Deleted 1 bookmark.")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(["2"]);
  });

  it("a rejected bulk delete keeps the selection and offers no Undo", async () => {
    const { user, onBulkDelete } = setup();
    onBulkDelete.mockRejectedValueOnce(new Error("network"));
    await selectCards(user, "MDN Web Docs", "A List Apart");
    await user.click(screen.getByRole("button", { name: "Delete Selected" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete Selected" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(BULK_DELETE_ERROR_MESSAGE);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("2 selected")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("a rejected restore keeps Undo available for a retry", async () => {
    const { user, onRestore } = setup();
    onRestore.mockRejectedValueOnce(new Error("network"));
    await selectCards(user, "MDN Web Docs");
    await user.click(screen.getByRole("button", { name: "Delete Selected" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Selected" }));

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText(RESTORE_ERROR_MESSAGE)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onRestore).toHaveBeenCalledTimes(2);
    expect(onRestore).toHaveBeenLastCalledWith(["1"]);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Undo" })).toBeNull());
  });

  it("clears the selection when the search or tag filter changes", async () => {
    const { user } = setup();
    await selectCards(user, "MDN Web Docs");
    await user.type(screen.getByRole("searchbox"), "m");
    expect(screen.queryByText("1 selected")).toBeNull();

    await selectCards(user, "MDN Web Docs");
    await user.click(screen.getByRole("button", { name: "dev" }));
    expect(screen.queryByText("1 selected")).toBeNull();
  });

  it("drops selected IDs that disappear from the bookmarks prop", async () => {
    const { user, rerenderWith } = setup();
    await selectCards(user, "MDN Web Docs", "A List Apart");
    rerenderWith(SAMPLE.filter((b) => b.id !== "1"));
    expect(screen.getByText("1 selected")).not.toBeNull();
  });
});

describe("BookmarkWorkspace — additional edge cases", () => {
  it("Dismiss hides the Undo notice without restoring anything", async () => {
    const { user, onRestore } = setup();
    await selectCards(user, "MDN Web Docs");
    await user.click(screen.getByRole("button", { name: "Delete Selected" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Selected" }));

    await user.click(await screen.findByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("closes the Add dialog when the backdrop is clicked", async () => {
    const { user, onCreate } = setup();
    await user.click(screen.getByRole("button", { name: "+ Add Bookmark" }));
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;

    await user.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("falls back to All when the active tag disappears from the bookmarks", async () => {
    const { user, rerenderWith } = setup();
    await user.click(screen.getByRole("button", { name: "reading" }));
    expect(cardTitles()).toEqual(["A List Apart"]);

    rerenderWith(SAMPLE.filter((b) => b.id !== "2"));
    expect(cardTitles()).toEqual(["MDN Web Docs", "Postgres Documentation"]);
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps showing cards with an error banner when a refresh fails", () => {
    setup({ errorMessage: "Could not refresh bookmarks." });
    expect(screen.getByRole("alert").textContent).toBe("Could not refresh bookmarks.");
    expect(cardTitles()).toHaveLength(3);
  });
});

describe("BookmarkWorkspace — filter summary and reset", () => {
  it("shows how many bookmarks match while a search or tag filter is active", async () => {
    const { user } = setup();
    expect(screen.queryByText(/^Showing \d+ of \d+/)).toBeNull();

    await user.type(screen.getByRole("searchbox"), "doc");
    expect(screen.getByText("Showing 2 of 3 bookmarks")).not.toBeNull();

    await user.clear(screen.getByRole("searchbox"));
    await user.click(screen.getByRole("button", { name: "design" }));
    expect(screen.getByText("Showing 1 of 3 bookmarks")).not.toBeNull();
  });

  it("offers a reset in the no-results state that clears search and tag filter", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "reference" }));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No bookmarks match your search or filter.")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear search and filter" }));

    const searchbox = screen.getByRole("searchbox") as HTMLInputElement;
    expect(searchbox.value).toBe("");
    expect(document.activeElement).toBe(searchbox);
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(cardTitles()).toEqual(["MDN Web Docs", "A List Apart", "Postgres Documentation"]);
  });
});
