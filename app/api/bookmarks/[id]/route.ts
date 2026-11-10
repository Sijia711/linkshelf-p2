import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { validateUpdateBookmarkInput, isValidUuid } from "@/lib/bookmarks";
import type { Bookmark } from "@/types/bookmark";

/**
 * PATCH /api/bookmarks/[id]
 * 
 * Updates a bookmark owned by the authenticated user.
 * Prohibits updating user_id or modifying soft-deleted bookmarks.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!isValidUuid(id)) {
    return jsonError("BAD_REQUEST", "Invalid bookmark ID format.", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  const body = await request.json().catch(() => null);
  const validation = validateUpdateBookmarkInput(body);

  if (!validation.isValid) {
    return jsonError("VALIDATION_ERROR", "Invalid bookmark update input.", 400, validation.errors);
  }

  // validation.data only contains title, url, tags (never user_id)
  const { data: updated, error: dbError } = await supabase
    .from("bookmarks")
    .update(validation.data!)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .maybeSingle();

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to update bookmark.", 500);
  }

  if (!updated) {
    return jsonError("NOT_FOUND", "Bookmark not found or you do not have permission to edit it.", 404);
  }

  return jsonSuccess(updated as Bookmark);
}

/**
 * DELETE /api/bookmarks/[id]
 * 
 * Soft-deletes a single bookmark by setting deleted_at to current timestamp.
 * Physical deletions are prohibited.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!isValidUuid(id)) {
    return jsonError("BAD_REQUEST", "Invalid bookmark ID format.", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  const { data: deleted, error: dbError } = await supabase
    .from("bookmarks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to delete bookmark.", 500);
  }

  if (!deleted) {
    return jsonError("NOT_FOUND", "Bookmark not found or you do not have permission to delete it.", 404);
  }

  return jsonSuccess({ id: deleted.id, deleted: true });
}
