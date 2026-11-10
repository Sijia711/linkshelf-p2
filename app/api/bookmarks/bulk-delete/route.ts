import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { validateBulkInput } from "@/lib/bookmarks";

/**
 * POST /api/bookmarks/bulk-delete
 * 
 * Soft-deletes a list of bookmarks owned by the authenticated user.
 * Records are marked with deleted_at = NOW() to support one-step Undo.
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

  const now = new Date().toISOString();
  const { data: updated, error: dbError } = await supabase
    .from("bookmarks")
    .update({ deleted_at: now })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .in("id", bulkResult.ids!)
    .select("id");

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to execute bulk deletion.", 500);
  }

  const affectedIds = (updated ?? []).map((row: { id: string }) => row.id);

  return jsonSuccess({
    affectedCount: affectedIds.length,
    ids: affectedIds,
  });
}
