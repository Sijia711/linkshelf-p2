"use client";

import { useId, useRef, useState } from "react";
import { BookmarkCard } from "./BookmarkCard";
import { BookmarkFormModal } from "./BookmarkFormModal";
import { BulkActionBar, UndoNotice } from "./BulkActionBar";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { TagFilter } from "./TagFilter";
import { collectTags, filterBookmarks, getEmptyState, pruneSelection } from "./selectors";
import type { BookmarkInput, BookmarkRecord, BookmarkWorkspaceProps } from "./types";
import { EMPTY_FORM_VALUES, toFormValues } from "./validation";

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; bookmark: BookmarkRecord };

type ConfirmState =
  | { kind: "none" }
  | { kind: "single"; bookmark: BookmarkRecord }
  | { kind: "bulk"; ids: string[] };

export const DELETE_ERROR_MESSAGE = "Could not delete bookmark.";
export const BULK_DELETE_ERROR_MESSAGE = "Could not delete the selected bookmarks. Please try again.";
export const RESTORE_ERROR_MESSAGE = "Could not restore bookmarks. Please try again.";

/**
 * Backend-agnostic bookmark dashboard.
 *
 * The parent owns canonical data (`bookmarks`) and persistence (callbacks).
 * This component only holds transient UI state: search, tag filter, selection,
 * dialogs, pending flags, errors, and the IDs of the last successful bulk delete.
 *
 * Selection rule: selection is cleared whenever the search text or tag filter
 * changes, and only bookmarks currently visible can be selected or bulk-deleted.
 */
export function BookmarkWorkspace({
  bookmarks,
  isLoading = false,
  errorMessage = null,
  onCreate,
  onUpdate,
  onDelete,
  onBulkDelete,
  onRestore,
}: BookmarkWorkspaceProps) {
  const searchId = useId();
  const restoringRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [confirm, setConfirm] = useState<ConfirmState>({ kind: "none" });
  const [lastDeletedIds, setLastDeletedIds] = useState<string[] | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Everything below is derived from props + UI state on each render.
  const tags = collectTags(bookmarks);
  const effectiveTag =
    activeTag !== null && tags.some((t) => t.toLowerCase() === activeTag.toLowerCase())
      ? activeTag
      : null;
  const visible = filterBookmarks(bookmarks, { query, tag: effectiveTag });
  const selected = pruneSelection(selectedIds, visible);
  const emptyState = getEmptyState(bookmarks.length, visible.length);
  const isFiltered = query.trim() !== "" || effectiveTag !== null;

  function clearSelection() {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }

  function changeQuery(value: string) {
    setQuery(value);
    clearSelection();
  }

  function changeTag(tag: string | null) {
    setActiveTag(tag);
    clearSelection();
  }

  function resetFilters() {
    setQuery("");
    setActiveTag(null);
    clearSelection();
    searchRef.current?.focus();
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(pruneSelection(prev, visible));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitForm(input: BookmarkInput) {
    if (form.mode === "edit") {
      await onUpdate(form.bookmark.id, input);
    } else {
      await onCreate(input);
    }
    setForm({ mode: "closed" });
  }

  async function confirmDelete() {
    if (confirm.kind === "single") {
      await onDelete(confirm.bookmark.id);
    } else if (confirm.kind === "bulk") {
      const ids = confirm.ids;
      await onBulkDelete(ids);
      // Only reached after the parent accepted the deletion.
      setLastDeletedIds(ids);
      setRestoreError(null);
      clearSelection();
    }
    setConfirm({ kind: "none" });
  }

  async function undoLastBulkDelete() {
    if (!lastDeletedIds || restoringRef.current) return;
    restoringRef.current = true;
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await onRestore(lastDeletedIds);
      setLastDeletedIds(null);
    } catch {
      setRestoreError(RESTORE_ERROR_MESSAGE);
    } finally {
      restoringRef.current = false;
      setIsRestoring(false);
    }
  }

  function renderContent() {
    if (isLoading && bookmarks.length === 0) {
      return (
        <p role="status" className="py-16 text-center text-sm text-gray-500">
          Loading bookmarks…
        </p>
      );
    }
    if (errorMessage && bookmarks.length === 0) {
      return null; // The error banner explains why the list is empty.
    }
    if (emptyState === "no-bookmarks") {
      return (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-500">
          No bookmarks saved yet. Add your first bookmark.
        </p>
      );
    }
    if (emptyState === "no-results") {
      return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">No bookmarks match your search or filter.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Clear search and filter
          </button>
        </div>
      );
    }
    return (
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Bookmark list">
        {visible.map((bookmark) => (
          <li key={bookmark.id}>
            <BookmarkCard
              bookmark={bookmark}
              isSelected={selected.has(bookmark.id)}
              onToggleSelected={toggleSelected}
              onEdit={(b) => setForm({ mode: "edit", bookmark: b })}
              onDelete={(b) => setConfirm({ kind: "single", bookmark: b })}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-label="Bookmarks" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={searchId} className="sr-only">
          Search bookmarks by title
        </label>
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="Search bookmarks by title..."
          className="w-full flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setForm({ mode: "create" })}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          + Add Bookmark
        </button>
      </div>

      {tags.length > 0 && <TagFilter tags={tags} activeTag={effectiveTag} onChange={changeTag} />}

      {isFiltered && bookmarks.length > 0 && (
        <p className="text-sm text-gray-600" aria-live="polite">
          Showing {visible.length} of {bookmarks.length} {bookmarks.length === 1 ? "bookmark" : "bookmarks"}
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      {lastDeletedIds && (
        <UndoNotice
          deletedCount={lastDeletedIds.length}
          isRestoring={isRestoring}
          errorMessage={restoreError}
          onUndo={undoLastBulkDelete}
          onDismiss={() => {
            setLastDeletedIds(null);
            setRestoreError(null);
          }}
        />
      )}

      {selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          onClearSelection={clearSelection}
          onDeleteSelected={() => setConfirm({ kind: "bulk", ids: Array.from(selected) })}
        />
      )}

      {renderContent()}

      {form.mode !== "closed" && (
        <BookmarkFormModal
          key={form.mode === "edit" ? form.bookmark.id : "create"}
          mode={form.mode}
          initialValues={form.mode === "edit" ? toFormValues(form.bookmark) : EMPTY_FORM_VALUES}
          onSubmit={submitForm}
          onCancel={() => setForm({ mode: "closed" })}
        />
      )}

      {confirm.kind === "single" && (
        <DeleteConfirmDialog
          heading="Delete bookmark?"
          message={`“${confirm.bookmark.title}” will be deleted from your bookmarks.`}
          confirmLabel="Delete"
          failureMessage={DELETE_ERROR_MESSAGE}
          onConfirm={confirmDelete}
          onCancel={() => setConfirm({ kind: "none" })}
        />
      )}

      {confirm.kind === "bulk" && (
        <DeleteConfirmDialog
          heading={`Delete ${confirm.ids.length} selected ${confirm.ids.length === 1 ? "bookmark" : "bookmarks"}?`}
          message="You can undo this right after deleting."
          confirmLabel="Delete Selected"
          failureMessage={BULK_DELETE_ERROR_MESSAGE}
          onConfirm={confirmDelete}
          onCancel={() => setConfirm({ kind: "none" })}
        />
      )}
    </section>
  );
}
