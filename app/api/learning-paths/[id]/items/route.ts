import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { validateAddPathItemInput } from "@/lib/learning-paths";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/learning-paths/[id]/items
 *
 * Adds an existing bookmark to a learning path.
 * - The learning path must belong to the authenticated user.
 * - The bookmark must belong to the authenticated user and not be soft-deleted.
 * - Duplicate bookmarks within the same path are rejected (409).
 * - New items are appended at the end (position = current max + 1).
 *
 * Body: { bookmark_id: string }
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id: learningPathId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Confirm the learning path exists and belongs to the user
  const { data: path, error: pathError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("id", learningPathId)
    .eq("user_id", user.id)
    .single();

  if (pathError || !path) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  // Parse and validate request body
  const body = await request.json().catch(() => null);
  const validation = validateAddPathItemInput(body);

  if (!validation.isValid) {
    return jsonError("VALIDATION_ERROR", validation.error ?? "Invalid input.", 400);
  }

  const bookmarkId = validation.bookmark_id!;

  // Confirm the bookmark exists, belongs to the user, and is not soft-deleted
  const { data: bookmark, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("id, deleted_at")
    .eq("id", bookmarkId)
    .eq("user_id", user.id)
    .single();

  if (bookmarkError || !bookmark) {
    return jsonError("NOT_FOUND", "Bookmark not found.", 404);
  }

  if (bookmark.deleted_at !== null) {
    return jsonError(
      "BOOKMARK_DELETED",
      "Cannot add a soft-deleted bookmark to a learning path.",
      400
    );
  }

  // Check for duplicate (belt-and-suspenders in addition to DB unique constraint)
  const { data: existing } = await supabase
    .from("learning_path_items")
    .select("id")
    .eq("learning_path_id", learningPathId)
    .eq("bookmark_id", bookmarkId)
    .maybeSingle();

  if (existing) {
    return jsonError(
      "DUPLICATE_BOOKMARK",
      "This bookmark is already in the learning path.",
      409
    );
  }

  // Compute next position (max current position + 1, or 0 for empty path)
  const { data: maxRow } = await supabase
    .from("learning_path_items")
    .select("position")
    .eq("learning_path_id", learningPathId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = maxRow ? maxRow.position + 1 : 0;

  // Insert the new item.
  // Gracefully handles environments before migration 004 is applied (error 42703: column does not exist).
  let { data: item, error: insertError } = await supabase
    .from("learning_path_items")
    .insert({
      learning_path_id: learningPathId,
      bookmark_id: bookmarkId,
      user_id: user.id,
      position: nextPosition,
      is_completed: false,
      progress_percentage: 0,
    })
    .select()
    .single();

  if (
    insertError &&
    (insertError.code === "42703" ||
      insertError.code === "PGRST204" ||
      (insertError.message && insertError.message.includes("progress_percentage")))
  ) {
    const fallback = await supabase
      .from("learning_path_items")
      .insert({
        learning_path_id: learningPathId,
        bookmark_id: bookmarkId,
        user_id: user.id,
        position: nextPosition,
        is_completed: false,
      })
      .select()
      .single();
    item = fallback.data;
    insertError = fallback.error;
  }

  if (insertError) {
    // Handle unique constraint violation from DB (race condition safety)
    if (insertError.code === "23505") {
      return jsonError(
        "DUPLICATE_BOOKMARK",
        "This bookmark is already in the learning path.",
        409
      );
    }
    return jsonError("INTERNAL_ERROR", "Failed to add bookmark to learning path.", 500);
  }

  const returnedItem = item
    ? {
        ...item,
        progress_percentage:
          (item as { progress_percentage?: number }).progress_percentage ??
          (item.is_completed ? 100 : 0),
      }
    : item;

  return jsonSuccess({ item: returnedItem }, 201);
}
