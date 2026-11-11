/**
 * Public, UI-facing contract for the bookmark workspace module.
 * Locked by the team handoff (Section 9.1). Do not change without approval.
 */

export type BookmarkRecord = {
  id: string;
  title: string;
  url: string;
  tags: string[];
  createdAt: string; // ISO timestamp, e.g. 2026-11-05T10:00:00.000Z
  updatedAt: string; // ISO timestamp
};

export type BookmarkInput = {
  title: string;
  url: string;
  tags: string[];
};

export type BookmarkWorkspaceProps = {
  bookmarks: BookmarkRecord[];
  isLoading?: boolean;
  errorMessage?: string | null;

  onCreate: (input: BookmarkInput) => Promise<void>;
  onUpdate: (id: string, input: BookmarkInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onRestore: (ids: string[]) => Promise<void>;
};
