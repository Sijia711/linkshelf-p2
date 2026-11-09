import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { validateCreateBookmarkInput } from "@/lib/bookmarks";
import type { Bookmark } from "@/types/bookmark";

/**
 * GET /api/bookmarks
 * 
 * Returns the authenticated user's active bookmarks sorted by created_at DESC.
 * Query Parameters:
 * - q: case-insensitive title search
 * - tag: exact tag filter (case-insensitive)
 * - include_deleted: if "true", includes soft-deleted items
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");
  const includeDeleted = searchParams.get("include_deleted");

  let query = supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", user.id);

  if (includeDeleted !== "true") {
    query = query.is("deleted_at", null);
  }

  if (tag && tag.trim()) {
    query = query.contains("tags", [tag.trim().toLowerCase()]);
  }

  if (q && q.trim()) {
    query = query.ilike("title", `%${q.trim()}%`);
  }

  query = query.order("created_at", { ascending: false });

  const { data: bookmarks, error: dbError } = await query;

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to retrieve bookmarks.", 500);
  }

  const list = (bookmarks ?? []) as Bookmark[];

  return jsonSuccess({
    bookmarks: list,
    total: list.length,
  });
}

/**
 * POST /api/bookmarks
 * 
 * Creates a new bookmark for the authenticated user.
 * Validates title, URL, and tags. Enforces user_id = auth.uid().
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
  const validation = validateCreateBookmarkInput(body);

  if (!validation.isValid) {
    return jsonError("VALIDATION_ERROR", "Invalid bookmark input.", 400, validation.errors);
  }

  const { data: bookmark, error: dbError } = await supabase
    .from("bookmarks")
    .insert({
      user_id: user.id,
      title: validation.data!.title,
      url: validation.data!.url,
      tags: validation.data!.tags,
    })
    .select()
    .single();

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to create bookmark.", 500);
  }

  return jsonSuccess(bookmark as Bookmark, 201);
}
