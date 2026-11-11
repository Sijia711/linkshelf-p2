import type { BookmarkRecord } from "./types";

/** Search and filter state. `tag: null` means the "All" chip. */
export type BookmarkFilter = {
  query: string;
  tag: string | null;
};

export type EmptyState = "no-bookmarks" | "no-results" | null;

/** Unique tags across all bookmarks (case-insensitive), sorted alphabetically. */
export function collectTags(bookmarks: BookmarkRecord[]): string[] {
  const byKey = new Map<string, string>();
  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      const key = tag.trim().toLowerCase();
      if (key.length > 0 && !byKey.has(key)) {
        byKey.set(key, tag.trim());
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

/** Case-insensitive title search AND case-insensitive tag filter. */
export function filterBookmarks(
  bookmarks: BookmarkRecord[],
  filter: BookmarkFilter,
): BookmarkRecord[] {
  const query = filter.query.trim().toLowerCase();
  const tag = filter.tag?.trim().toLowerCase() || null;

  return bookmarks.filter((bookmark) => {
    const matchesQuery = query === "" || bookmark.title.toLowerCase().includes(query);
    const matchesTag =
      tag === null || bookmark.tags.some((t) => t.trim().toLowerCase() === tag);
    return matchesQuery && matchesTag;
  });
}

/** Which empty message to show, if any. */
export function getEmptyState(totalCount: number, visibleCount: number): EmptyState {
  if (totalCount === 0) return "no-bookmarks";
  if (visibleCount === 0) return "no-results";
  return null;
}

/**
 * Drops selected IDs that are no longer present in `bookmarks`.
 * Returns the same Set instance when nothing changed, so React state
 * updates can bail out without re-rendering.
 */
export function pruneSelection(
  selected: ReadonlySet<string>,
  bookmarks: BookmarkRecord[],
): ReadonlySet<string> {
  const present = new Set(bookmarks.map((b) => b.id));
  let changed = false;
  const next = new Set<string>();
  for (const id of selected) {
    if (present.has(id)) next.add(id);
    else changed = true;
  }
  return changed ? next : selected;
}
