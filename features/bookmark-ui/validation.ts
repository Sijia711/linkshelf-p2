import { normalizeTags, validateTitle, validateUrl } from "@/lib/bookmarks";
import type { BookmarkInput, BookmarkRecord } from "./types";

/**
 * Form-level validation for the bookmark UI.
 *
 * Field rules are delegated to the shared server-side helpers in
 * `lib/bookmarks.ts` so the browser and the API enforce identical rules
 * (non-empty title up to 255 chars, http/https URL only, lowercase
 * de-duplicated tags).
 */

/** Matches the server limit in `validateBulkInput` (lib/bookmarks.ts). */
export const MAX_BULK_SELECTION = 100;

export type BookmarkFormValues = {
  title: string;
  url: string;
  /** Comma-separated tag text as typed by the user. */
  tagsText: string;
};

export type BookmarkFormErrors = {
  title?: string;
  url?: string;
};

export type BookmarkFormResult =
  | { ok: true; input: BookmarkInput }
  | { ok: false; errors: BookmarkFormErrors };

export const EMPTY_FORM_VALUES: BookmarkFormValues = {
  title: "",
  url: "",
  tagsText: "",
};

/** Splits comma-separated text into trimmed, lowercase, unique tags. */
export function parseTagInput(text: string): string[] {
  return normalizeTags(text.split(","));
}

/** Formats stored tags for display in the tag text field. */
export function formatTagInput(tags: string[]): string {
  return tags.join(", ");
}

/** Builds pre-filled form values for editing an existing bookmark. */
export function toFormValues(bookmark: BookmarkRecord): BookmarkFormValues {
  return {
    title: bookmark.title,
    url: bookmark.url,
    tagsText: formatTagInput(bookmark.tags),
  };
}

/** Validates form values and returns either a normalized input or field errors. */
export function validateBookmarkForm(values: BookmarkFormValues): BookmarkFormResult {
  const titleResult = validateTitle(values.title);
  const urlResult = validateUrl(values.url);

  if (
    !titleResult.isValid ||
    !urlResult.isValid ||
    titleResult.value === undefined ||
    urlResult.value === undefined
  ) {
    const errors: BookmarkFormErrors = {};
    if (!titleResult.isValid) errors.title = titleResult.error ?? "Title is required.";
    if (!urlResult.isValid) errors.url = urlResult.error ?? "Invalid URL format.";
    return { ok: false, errors };
  }

  return {
    ok: true,
    input: {
      title: titleResult.value,
      url: urlResult.value,
      tags: parseTagInput(values.tagsText),
    },
  };
}
