import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { validateBulkInput } from "@/lib/bookmarks";

/**
 * POST /api/bookmarks/bulk-restore
 * 
 * Restores a list of soft-deleted bookmarks owned by the authenticated user.
 * Resets deleted_at to NULL, powering the single-step Undo feature.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  const body = await request.json().catch(() => null);
  const bulkResult = validateBulkInput(body);

  if (!bulkResult.isValid) {
    return jsonError("VALIDATION_ERROR", bulkResult.error!, 400);
  }

  const { data: restored, error: dbError } = await supabase
    .from("bookmarks")
    .update({ deleted_at: null })
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .in("id", bulkResult.ids!)
    .select("id");

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to execute bulk restore.", 500);
  }

  const affectedIds = (restored ?? []).map((row: { id: string }) => row.id);

  return jsonSuccess({
    affectedCount: affectedIds.length,
    ids: affectedIds,
  });
}
