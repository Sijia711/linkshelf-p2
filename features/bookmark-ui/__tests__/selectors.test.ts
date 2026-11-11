import { describe, expect, it } from "vitest";
import { collectTags, filterBookmarks, getEmptyState, pruneSelection } from "../selectors";
import type { BookmarkRecord } from "../types";

function makeBookmark(id: string, title: string, tags: string[]): BookmarkRecord {
  return {
    id,
    title,
    url: `https://example.com/${id}`,
    tags,
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
  };
}

const bookmarks: BookmarkRecord[] = [
  makeBookmark("1", "MDN Web Docs", ["dev", "reference"]),
  makeBookmark("2", "A List Apart", ["design", "reading"]),
  makeBookmark("3", "Smashing Magazine", ["Design", "dev"]),
  makeBookmark("4", "Postgres Documentation", ["dev", "reference"]),
];

const ids = (list: BookmarkRecord[]) => list.map((b) => b.id);

describe("filterBookmarks", () => {
  it("returns everything when the query is empty and the tag is All", () => {
    expect(ids(filterBookmarks(bookmarks, { query: "", tag: null }))).toEqual(["1", "2", "3", "4"]);
  });

  it("matches titles case-insensitively", () => {
    expect(ids(filterBookmarks(bookmarks, { query: "mdn", tag: null }))).toEqual(["1"]);
    expect(ids(filterBookmarks(bookmarks, { query: "DOC", tag: null }))).toEqual(["1", "4"]);
  });

  it("trims the search query", () => {
    expect(ids(filterBookmarks(bookmarks, { query: "  smashing  ", tag: null }))).toEqual(["3"]);
  });

  it("searches titles only, not URLs", () => {
    expect(filterBookmarks(bookmarks, { query: "example.com", tag: null })).toHaveLength(0);
  });

  it("filters by tag case-insensitively", () => {
    expect(ids(filterBookmarks(bookmarks, { query: "", tag: "DESIGN" }))).toEqual(["2", "3"]);
  });

  it("combines search and tag with AND", () => {
    expect(ids(filterBookmarks(bookmarks, { query: "doc", tag: "reference" }))).toEqual(["1", "4"]);
    expect(ids(filterBookmarks(bookmarks, { query: "smashing", tag: "reference" }))).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const copy = [...bookmarks];
    filterBookmarks(bookmarks, { query: "mdn", tag: "dev" });
    expect(bookmarks).toEqual(copy);
  });
});

describe("collectTags", () => {
  it("returns unique tags case-insensitively, sorted", () => {
    expect(collectTags(bookmarks)).toEqual(["design", "dev", "reading", "reference"]);
  });

  it("returns an empty list when there are no bookmarks", () => {
    expect(collectTags([])).toEqual([]);
  });
});

describe("getEmptyState", () => {
  it("reports no bookmarks when the input list is empty", () => {
    expect(getEmptyState(0, 0)).toBe("no-bookmarks");
  });

  it("reports no results when bookmarks exist but nothing matches", () => {
    expect(getEmptyState(4, 0)).toBe("no-results");
  });

  it("reports nothing when cards are visible", () => {
    expect(getEmptyState(4, 2)).toBe(null);
  });
});

describe("pruneSelection", () => {
  it("removes IDs that are no longer present", () => {
    const next = pruneSelection(new Set(["1", "99"]), bookmarks);
    expect(Array.from(next)).toEqual(["1"]);
  });

  it("returns the same instance when nothing changed", () => {
    const selected = new Set(["1", "2"]);
    expect(pruneSelection(selected, bookmarks)).toBe(selected);
  });
});
