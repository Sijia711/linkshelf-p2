import { describe, expect, it } from "vitest";
import {
  EMPTY_FORM_VALUES,
  formatTagInput,
  parseTagInput,
  toFormValues,
  validateBookmarkForm,
} from "../validation";
import type { BookmarkRecord } from "../types";

const validValues = {
  title: "MDN Web Docs",
  url: "https://developer.mozilla.org",
  tagsText: "",
};

describe("validateBookmarkForm — title", () => {
  it("rejects an empty title", () => {
    const result = validateBookmarkForm({ ...validValues, title: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBe("Title is required.");
  });

  it("rejects a whitespace-only title", () => {
    const result = validateBookmarkForm({ ...validValues, title: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBe("Title is required.");
  });

  it("rejects a title longer than the 255-character server limit", () => {
    const result = validateBookmarkForm({ ...validValues, title: "a".repeat(256) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBe("Title must be 255 characters or fewer.");
  });

  it("trims the title before submitting", () => {
    const result = validateBookmarkForm({ ...validValues, title: "  MDN Web Docs  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.title).toBe("MDN Web Docs");
  });
});

describe("validateBookmarkForm — URL", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com/file",
  ])("rejects the unsafe protocol in %s", (url) => {
    const result = validateBookmarkForm({ ...validValues, url });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.url).toBe("URL must use http:// or https:// protocol.");
  });

  it.each(["not a url", "https://", "example.com"])("rejects the malformed URL %s", (url) => {
    const result = validateBookmarkForm({ ...validValues, url });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.url).toBe("Invalid URL format.");
  });

  it("rejects an empty URL", () => {
    const result = validateBookmarkForm({ ...validValues, url: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.url).toBe("URL is required.");
  });

  it.each(["http://example.com", "https://example.com/path?q=1#top"])(
    "accepts the valid URL %s",
    (url) => {
      const result = validateBookmarkForm({ ...validValues, url });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.input.url).toBe(url);
    },
  );

  it("trims surrounding whitespace from the URL", () => {
    const result = validateBookmarkForm({ ...validValues, url: "  https://react.dev  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.url).toBe("https://react.dev");
  });
});

describe("validateBookmarkForm — combined", () => {
  it("reports title and URL errors together", () => {
    const result = validateBookmarkForm(EMPTY_FORM_VALUES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBe("Title is required.");
      expect(result.errors.url).toBe("URL is required.");
    }
  });

  it("returns normalized input for a valid form", () => {
    const result = validateBookmarkForm({
      title: " React ",
      url: "https://react.dev",
      tagsText: "Dev, reference",
    });
    expect(result).toEqual({
      ok: true,
      input: { title: "React", url: "https://react.dev", tags: ["dev", "reference"] },
    });
  });
});

describe("tag helpers", () => {
  it("trims, lowercases, drops empty entries, and de-duplicates", () => {
    expect(parseTagInput(" React, react ,, Design ,  ")).toEqual(["react", "design"]);
  });

  it("returns an empty list for empty text", () => {
    expect(parseTagInput("")).toEqual([]);
  });

  it("formats tags as comma-separated text", () => {
    expect(formatTagInput(["dev", "reference"])).toBe("dev, reference");
  });

  it("round-trips an existing bookmark through the edit form", () => {
    const bookmark: BookmarkRecord = {
      id: "1",
      title: "Postgres Documentation",
      url: "https://postgresql.org/docs",
      tags: ["dev", "reference"],
      createdAt: "2026-11-05T10:00:00.000Z",
      updatedAt: "2026-11-05T10:00:00.000Z",
    };
    const result = validateBookmarkForm(toFormValues(bookmark));
    expect(result).toEqual({
      ok: true,
      input: { title: bookmark.title, url: bookmark.url, tags: bookmark.tags },
    });
  });
});
