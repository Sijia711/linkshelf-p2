import { MAX_BULK_SELECTION } from "./validation";

type BulkActionBarProps = {
  selectedCount: number;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
};

/** Shown only while at least one bookmark is selected. */
export function BulkActionBar({ selectedCount, onDeleteSelected, onClearSelection }: BulkActionBarProps) {
  const overLimit = selectedCount > MAX_BULK_SELECTION;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3"
    >
      <p className="text-sm font-medium text-indigo-900" aria-live="polite">
        {selectedCount} selected
      </p>
      {overLimit && (
        <p className="text-sm text-red-700">
          You can delete up to {MAX_BULK_SELECTION} bookmarks at a time.
        </p>
      )}
      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Clear selection
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={overLimit}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
        >
          Delete Selected
        </button>
      </div>
    </div>
  );
}

type UndoNoticeProps = {
  deletedCount: number;
  isRestoring: boolean;
  errorMessage: string | null;
  onUndo: () => void;
  onDismiss: () => void;
};

/** One-step Undo for the most recent successful bulk deletion. */
export function UndoNotice({ deletedCount, isRestoring, errorMessage, onUndo, onDismiss }: UndoNoticeProps) {
  const noun = deletedCount === 1 ? "bookmark" : "bookmarks";

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
    >
      <p className="text-sm text-gray-800">
        Deleted {deletedCount} {noun}.
      </p>
      {errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}
      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          disabled={isRestoring}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={isRestoring}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
        >
          {isRestoring ? "Restoring…" : "Undo"}
        </button>
      </div>
    </div>
  );
}
