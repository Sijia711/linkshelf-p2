import type {
  CreateLearningPathInput,
  UpdateLearningPathInput,
  AddPathItemInput,
  ResourceStatus,
} from "@/types/learning-path";
import { isValidUuid } from "@/lib/bookmarks";

export interface FormValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: Record<string, string[]>;
}

/**
 * Validates and truncates a progress percentage input.
 * Rules:
 * - 0 through 100 inclusive
 * - Decimal numbers are truncated toward zero (e.g. 20.78 -> 20, NOT rounded to 21)
 * - Blank, NaN, Infinity, -Infinity, strings that do not represent numbers,
 *   and values < 0 or > 100 are rejected.
 */
export function validateProgressPercentage(input: unknown): {
  isValid: boolean;
  value?: number;
  error?: string;
} {
  if (input === null || input === undefined) {
    return { isValid: false, error: "Progress percentage is required." };
  }

  let num: number;
  if (typeof input === "number") {
    num = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return { isValid: false, error: "Progress percentage cannot be empty." };
    }
    num = Number(trimmed);
  } else {
    return { isValid: false, error: "Progress percentage must be a number." };
  }

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { isValid: false, error: "Progress percentage must be a valid finite number." };
  }

  if (num < 0 || num > 100) {
    return { isValid: false, error: "Progress percentage must be between 0 and 100." };
  }

  // Truncate decimals toward zero (e.g. 20.78 -> 20, -0 -> 0)
  const truncated = Math.trunc(num);

  return { isValid: true, value: truncated === 0 ? 0 : truncated };
}

/**
 * Returns the resource status classification:
 * - 0 = "not_started"
 * - 1..99 = "in_progress"
 * - 100 = "completed"
 */
export function getResourceStatus(progress: number): ResourceStatus {
  if (progress >= 100) return "completed";
  if (progress > 0) return "in_progress";
  return "not_started";
}

/**
 * Human-readable label for resource status.
 */
export function getResourceStatusLabel(progress: number): string {
  if (progress >= 100) return "Completed";
  if (progress > 0) return "In Progress";
  return "Not Started";
}

/**
 * Validates payload for creating a learning path.
 */
export function validateCreateLearningPathInput(
  input: unknown
): FormValidationResult<CreateLearningPathInput> {
  const errors: Record<string, string[]> = {};

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: { _general: ["Invalid request body. JSON object expected."] },
    };
  }

  const raw = input as Record<string, unknown>;

  if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
    errors.title = ["Title is required."];
  } else if (raw.title.trim().length > 255) {
    errors.title = ["Title must be 255 characters or fewer."];
  }

  let description = "";
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== "string") {
      errors.description = ["Description must be a string."];
    } else if (raw.description.length > 2000) {
      errors.description = ["Description must be 2000 characters or fewer."];
    } else {
      description = raw.description.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      title: (raw.title as string).trim(),
      description,
    },
    errors: {},
  };
}

/**
 * Validates payload for updating an existing learning path.
 */
export function validateUpdateLearningPathInput(
  input: unknown
): FormValidationResult<UpdateLearningPathInput> {
  const errors: Record<string, string[]> = {};

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: { _general: ["Invalid request body. JSON object expected."] },
    };
  }

  const raw = input as Record<string, unknown>;
  const hasTitle = raw.title !== undefined;
  const hasDescription = raw.description !== undefined;

  if (!hasTitle && !hasDescription) {
    return {
      isValid: false,
      errors: { _general: ["At least one field (title, description) must be provided."] },
    };
  }

  const data: UpdateLearningPathInput = {};

  if (hasTitle) {
    if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
      errors.title = ["Title cannot be empty."];
    } else if (raw.title.trim().length > 255) {
      errors.title = ["Title must be 255 characters or fewer."];
    } else {
      data.title = raw.title.trim();
    }
  }

  if (hasDescription) {
    if (typeof raw.description !== "string") {
      errors.description = ["Description must be a string."];
    } else if (raw.description.length > 2000) {
      errors.description = ["Description must be 2000 characters or fewer."];
    } else {
      data.description = raw.description.trim();
    }
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

/**
 * Validates payload for adding an item to a learning path.
 */
export function validateAddPathItemInput(input: unknown): {
  isValid: boolean;
  bookmark_id?: string;
  error?: string;
} {
  if (!input || typeof input !== "object") {
    return { isValid: false, error: "Invalid request body." };
  }

  const raw = input as Partial<AddPathItemInput>;

  if (!raw.bookmark_id || !isValidUuid(raw.bookmark_id)) {
    return { isValid: false, error: "bookmark_id must be a valid bookmark UUID." };
  }

  return { isValid: true, bookmark_id: raw.bookmark_id };
}

/**
 * Computes progress stats given a list of path items.
 * Overall Learning Path progress = arithmetic mean of resource percentages, truncated to an integer.
 * Supports items with either progress_percentage or boolean is_completed (backward compatibility).
 */
export function calculateProgress(
  items:
    | Array<{ is_completed?: boolean; progress_percentage?: number | null }>
    | null
    | undefined
): {
  total_items: number;
  completed_items: number;
  progress_percentage: number;
} {
  if (!items || items.length === 0) {
    return {
      total_items: 0,
      completed_items: 0,
      progress_percentage: 0,
    };
  }

  const total = items.length;

  let sum = 0;
  let completedCount = 0;

  for (const item of items) {
    let itemPct: number;
    if (typeof item.progress_percentage === "number") {
      itemPct = Math.trunc(item.progress_percentage);
    } else {
      itemPct = item.is_completed ? 100 : 0;
    }

    if (itemPct >= 100) {
      completedCount++;
    }
    sum += itemPct;
  }

  // Arithmetic mean truncated to an integer
  const meanPercentage = Math.trunc(sum / total);

  return {
    total_items: total,
    completed_items: completedCount,
    progress_percentage: meanPercentage,
  };
}

/**
 * Reorders a list of items deterministically up or down by 1 position.
 */
export function reorderItems<T extends { id: string; position: number }>(
  items: T[],
  itemId: string,
  direction: "up" | "down"
): { updated: boolean; items: T[] } {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((item) => item.id === itemId);

  if (index === -1) {
    return { updated: false, items };
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= sorted.length) {
    return { updated: false, items };
  }

  // Swap positions
  const temp = sorted[index];
  sorted[index] = sorted[targetIndex];
  sorted[targetIndex] = temp;

  // Re-normalize 0-based positions
  const reindexed = sorted.map((item, idx) => ({
    ...item,
    position: idx,
  }));

  return { updated: true, items: reindexed };
}

/**
 * Extracts a clean, readable domain/hostname from a URL string for display context.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

