import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import {
  validateUpdateLearningPathInput,
  calculateProgress,
} from "@/lib/learning-paths";
import type { LearningPathDetail, LearningPathItem } from "@/types/learning-path";
import type { Bookmark } from "@/types/bookmark";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/learning-paths/[id]
 *
 * Returns a single learning path with ordered items + joined bookmark data
 * and computed progress statistics.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Fetch path (RLS enforces ownership)
  const { data: path, error: pathError } = await supabase
    .from("learning_paths")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (pathError || !path) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  // Fetch items ordered by position, with left-joined bookmark data.
  // Gracefully handles environments before migration 004 is applied (error 42703: column does not exist).
  let { data: rawItems, error: itemsError } = await supabase
    .from("learning_path_items")
    .select(
      "id, learning_path_id, bookmark_id, user_id, position, is_completed, progress_percentage, completed_at, created_at, updated_at, bookmarks(id, user_id, title, url, tags, created_at, updated_at, deleted_at)"
    )
    .eq("learning_path_id", id)
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (
    itemsError &&
    ((itemsError as { code?: string }).code === "42703" ||
      (itemsError as { code?: string }).code === "PGRST204" ||
      (itemsError.message && itemsError.message.includes("progress_percentage")))
  ) {
    const fallback = await supabase
      .from("learning_path_items")
      .select(
        "id, learning_path_id, bookmark_id, user_id, position, is_completed, completed_at, created_at, updated_at, bookmarks(id, user_id, title, url, tags, created_at, updated_at, deleted_at)"
      )
      .eq("learning_path_id", id)
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    rawItems = (fallback.data ?? []).map((item) => ({
      ...item,
      progress_percentage: item.is_completed ? 100 : 0,
    }));
    itemsError = fallback.error;
  }

  if (itemsError) {
    return jsonError("INTERNAL_ERROR", "Failed to retrieve learning path items.", 500);
  }

  const items: LearningPathItem[] = (rawItems ?? []).map((row) => {
    const bookmarkRaw = row.bookmarks as unknown as Bookmark | null;
    // If bookmark is soft-deleted or missing, return null
    const bookmark: Bookmark | null =
      bookmarkRaw && bookmarkRaw.deleted_at === null ? bookmarkRaw : null;
    const progressPercentage =
      typeof (row as { progress_percentage?: number | null }).progress_percentage === "number"
        ? (row as { progress_percentage: number }).progress_percentage
        : row.is_completed
        ? 100
        : 0;

    return {
      id: row.id,
      learning_path_id: row.learning_path_id,
      bookmark_id: row.bookmark_id,
      user_id: row.user_id,
      position: row.position,
      is_completed: row.is_completed,
      progress_percentage: progressPercentage,
      completed_at: row.completed_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      bookmark,
    };
  });

  const progress = calculateProgress(items);

  const detail: LearningPathDetail = {
    ...path,
    items,
    ...progress,
  };

  return jsonSuccess({ learning_path: detail });
}

/**
 * PATCH /api/learning-paths/[id]
 *
 * Updates a learning path's title and/or description.
 * Body: { title?: string, description?: string }
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Confirm the path exists and belongs to the user
  const { data: existing, error: fetchError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  const body = await request.json().catch(() => null);
  const validation = validateUpdateLearningPathInput(body);

  if (!validation.isValid) {
    return jsonError("VALIDATION_ERROR", "Invalid update input.", 400, validation.errors);
  }

  const { data: updated, error: dbError } = await supabase
    .from("learning_paths")
    .update(validation.data!)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (dbError || !updated) {
    return jsonError("INTERNAL_ERROR", "Failed to update learning path.", 500);
  }

  return jsonSuccess({ learning_path: updated });
}

/**
 * DELETE /api/learning-paths/[id]
 *
 * Deletes a learning path (cascade deletes items). Original bookmarks are NOT affected.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Confirm the path exists and belongs to the user
  const { data: existing, error: fetchError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  const { error: dbError } = await supabase
    .from("learning_paths")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to delete learning path.", 500);
  }

  return jsonSuccess({ message: "Learning path deleted successfully." });
}
