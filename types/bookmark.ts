/**
 * LinkShelf — Bookmark API & Data Model Contracts
 * 
 * Shared TypeScript definitions between Backend (Developer A) and Frontend (Developer B).
 * 
 * Response Conventions for Developer B:
 * 1. Unified Envelope: All API routes return either:
 *    - Success: `{ data: T, error: null }` with HTTP 200 (or 201 for creation)
 *    - Failure: `{ data: null, error: { code: string, message: string, details?: ... } }` with HTTP 4xx/5xx
 * 2. Identifiers & Timestamps:
 *    - IDs are RFC 4122 v4 UUID strings.
 *    - Timestamps (`created_at`, `updated_at`, `deleted_at`) are ISO 8601 strings (e.g. "2026-11-09T00:00:00.000Z").
 * 3. Soft-Delete & Undo:
 *    - Deletion via bulk-delete sets `deleted_at` to a timestamp.
 *    - Active bookmarks have `deleted_at: null`.
 *    - Restoring via bulk-restore resets `deleted_at` to null.
 * 4. URLs:
 *    - Must begin with `http://` or `https://`.
 */

export interface Bookmark {
  /** Unique UUID identifier */
  id: string;
  /** Supabase Auth user UUID who owns this bookmark */
  user_id: string;
  /** Display title of the bookmark */
  title: string;
  /** Absolute URL with http:// or https:// protocol */
  url: string;
  /** List of normalized tags associated with the bookmark */
  tags: string[];
  /** Creation timestamp in ISO 8601 format */
  created_at: string;
  /** Last update timestamp in ISO 8601 format */
  updated_at: string;
  /** Soft-delete timestamp in ISO 8601 format; null if active */
  deleted_at: string | null;
}

/**
 * Payload for creating a new bookmark (POST /api/bookmarks).
 */
export interface CreateBookmarkInput {
  title: string;
  url: string;
  tags?: string[];
}

/**
 * Payload for updating an existing bookmark (PATCH /api/bookmarks/:id).
 * At least one field should be supplied.
 */
export interface UpdateBookmarkInput {
  title?: string;
  url?: string;
  tags?: string[];
}

/**
 * Payload for bulk deleting bookmarks (POST /api/bookmarks/bulk-delete).
 */
export interface BulkDeleteInput {
  /** Non-empty array of bookmark UUIDs to soft-delete */
  ids: string[];
}

/**
 * Payload for bulk restoring soft-deleted bookmarks (POST /api/bookmarks/bulk-restore).
 */
export interface BulkRestoreInput {
  /** Non-empty array of bookmark UUIDs to restore */
  ids: string[];
}

/**
 * Query parameters for listing bookmarks (GET /api/bookmarks).
 */
export interface BookmarkQueryParams {
  /** Case-insensitive title search term */
  q?: string;
  /** Filter by exact tag */
  tag?: string;
  /** Include soft-deleted bookmarks (default: false) */
  include_deleted?: boolean;
}

/**
 * Structured error details returned by API endpoints.
 */
export interface ApiError {
  /** Machine-readable error code (e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED', 'NOT_FOUND') */
  code: string;
  /** Human-readable explanation of the error suitable for display */
  message: string;
  /** Optional field-level error messages (e.g. { url: ["Must begin with http:// or https://"] }) */
  details?: Record<string, string[]>;
}

/**
 * Successful API response envelope.
 */
export interface ApiResponse<T> {
  data: T;
  error: null;
}

/**
 * Error API response envelope.
 */
export interface ApiErrorResponse {
  data: null;
  error: ApiError;
}

/**
 * Union response type for any API route handler.
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

/**
 * Response payload for GET /api/bookmarks.
 */
export interface BookmarkListPayload {
  bookmarks: Bookmark[];
  total: number;
}

/**
 * Response payload for bulk actions (bulk-delete / bulk-restore).
 */
export interface BulkOperationPayload {
  affectedCount: number;
  ids: string[];
}
