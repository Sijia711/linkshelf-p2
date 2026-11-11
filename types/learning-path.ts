import type { Bookmark } from "./bookmark";

/**
 * Core Learning Path model.
 */
export interface LearningPath {
  id: string;
  user_id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * Learning Path with computed progress statistics.
 */
export interface LearningPathWithStats extends LearningPath {
  total_items: number;
  completed_items: number;
  progress_percentage: number;
}

/**
 * Ordered item in a Learning Path linking to a Bookmark.
 */
export interface LearningPathItem {
  id: string;
  learning_path_id: string;
  bookmark_id: string;
  user_id: string;
  position: number;
  is_completed: boolean;
  /** Completion progress as an integer percentage (0 through 100) */
  progress_percentage: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Joined bookmark information if active */
  bookmark?: Bookmark | null;
}

/**
 * Complete Learning Path detail with ordered items and progress.
 */
export interface LearningPathDetail extends LearningPath {
  items: LearningPathItem[];
  total_items: number;
  completed_items: number;
  progress_percentage: number;
}

/**
 * Input for creating a new learning path (POST /api/learning-paths).
 */
export interface CreateLearningPathInput {
  title: string;
  description?: string;
}

/**
 * Input for updating a learning path (PATCH /api/learning-paths/:id).
 */
export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
}

/**
 * Input for adding a bookmark item to a path (POST /api/learning-paths/:id/items).
 */
export interface AddPathItemInput {
  bookmark_id: string;
}

/**
 * Input for updating a path item (PATCH /api/learning-paths/:id/items/:itemId).
 */
export interface UpdatePathItemInput {
  is_completed?: boolean;
  progress_percentage?: number;
  position?: number;
}

/**
 * Status of an individual resource based on progress percentage.
 * 0 = not_started, 1-99 = in_progress, 100 = completed
 */
export type ResourceStatus = "not_started" | "in_progress" | "completed";

/**
 * Tiptap structured JSON document node representation.
 */
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  text?: string;
  [key: string]: unknown;
};

/**
 * Rich-text notebook model for a Learning Path (1:1 relation).
 */
export interface LearningNote {
  id: string;
  user_id: string;
  learning_path_id: string;
  content: TiptapNode;
  created_at: string;
  updated_at: string;
}

/**
 * Input for updating or creating a path notebook (PUT /api/learning-paths/:id/notes).
 */
export interface UpdateLearningNoteInput {
  content: TiptapNode;
}

