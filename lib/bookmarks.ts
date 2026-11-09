import type { CreateBookmarkInput, UpdateBookmarkInput } from "@/types/bookmark";

export interface FieldValidationResult<T> {
  isValid: boolean;
  value?: T;
  error?: string;
}

export interface FormValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: Record<string, string[]>;
}

/**
 * Validates a bookmark title.
 * - Must be a non-empty string after trimming.
 * - Maximum length: 255 characters.
 */
export function validateTitle(title: unknown): FieldValidationResult<string> {
  if (typeof title !== "string") {
    return { isValid: false, error: "Title is required." };
  }

  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "Title is required." };
  }

  if (trimmed.length > 255) {
    return { isValid: false, error: "Title must be 255 characters or fewer." };
  }

  return { isValid: true, value: trimmed };
}

/**
 * Validates a bookmark URL.
 * - Must be a valid absolute URL.
 * - Allowed protocols: http: and https: only (blocks javascript:, ftp:, data:, file:, etc.).
 */
export function validateUrl(url: unknown): FieldValidationResult<string> {
  if (typeof url !== "string") {
    return { isValid: false, error: "URL is required." };
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "URL is required." };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { isValid: false, error: "URL must use http:// or https:// protocol." };
    }

    if (!parsed.hostname) {
      return { isValid: false, error: "Invalid URL format." };
    }

    return { isValid: true, value: trimmed };
  } catch {
    return { isValid: false, error: "Invalid URL format." };
  }
}

/**
 * Normalizes an array of tags.
 * - Trims whitespace.
 * - Converts to lowercase.
 * - Drops empty/whitespace-only tags.
 * - Deduplicates tags case-insensitively.
 */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const set = new Set<string>();

  for (const item of tags) {
    if (typeof item === "string") {
      const clean = item.trim().toLowerCase();
      if (clean.length > 0) {
        set.add(clean);
      }
    }
  }

  return Array.from(set);
}

/**
 * Validates the full payload for creating a bookmark.
 */
export function validateCreateBookmarkInput(
  input: unknown
): FormValidationResult<CreateBookmarkInput> {
  const errors: Record<string, string[]> = {};

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: { _general: ["Invalid request body. JSON object expected."] },
    };
  }

  const raw = input as Record<string, unknown>;

  const titleResult = validateTitle(raw.title);
  if (!titleResult.isValid && titleResult.error) {
    errors.title = [titleResult.error];
  }

  const urlResult = validateUrl(raw.url);
  if (!urlResult.isValid && urlResult.error) {
    errors.url = [urlResult.error];
  }

  const cleanTags = normalizeTags(raw.tags);

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      title: titleResult.value!,
      url: urlResult.value!,
      tags: cleanTags,
    },
    errors: {},
  };
}

/**
 * Validates the partial payload for updating an existing bookmark.
 */
export function validateUpdateBookmarkInput(
  input: unknown
): FormValidationResult<UpdateBookmarkInput> {
  const errors: Record<string, string[]> = {};

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: { _general: ["Invalid request body. JSON object expected."] },
    };
  }

  const raw = input as Record<string, unknown>;
  const hasTitle = raw.title !== undefined;
  const hasUrl = raw.url !== undefined;
  const hasTags = raw.tags !== undefined;

  if (!hasTitle && !hasUrl && !hasTags) {
    return {
      isValid: false,
      errors: { _general: ["At least one field (title, url, tags) must be provided to update."] },
    };
  }

  const data: UpdateBookmarkInput = {};

  if (hasTitle) {
    const titleResult = validateTitle(raw.title);
    if (!titleResult.isValid && titleResult.error) {
      errors.title = [titleResult.error];
    } else {
      data.title = titleResult.value!;
    }
  }

  if (hasUrl) {
    const urlResult = validateUrl(raw.url);
    if (!urlResult.isValid && urlResult.error) {
      errors.url = [urlResult.error];
    } else {
      data.url = urlResult.value!;
    }
  }

  if (hasTags) {
    data.tags = normalizeTags(raw.tags);
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data,
    errors: {},
  };
}
