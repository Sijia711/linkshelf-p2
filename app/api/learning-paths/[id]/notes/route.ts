import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import {
  DEFAULT_EMPTY_NOTE_DOC,
  validateTiptapContent,
} from "@/lib/learning-notes";
import type { LearningNote } from "@/types/learning-path";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/learning-paths/[id]/notes
 *
 * Returns the rich-text notebook for the given learning path.
 * If no notebook has been saved yet, returns default empty Tiptap document.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id: pathId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Confirm the learning path exists and belongs to the authenticated user
  const { data: path, error: pathError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("id", pathId)
    .eq("user_id", user.id)
    .single();

  if (pathError || !path) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  // Fetch the single shared notebook for this learning path
  const { data: note, error: noteError } = await supabase
    .from("learning_notes")
    .select("*")
    .eq("learning_path_id", pathId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (noteError) {
    return jsonError("INTERNAL_ERROR", "Failed to retrieve learning path notebook.", 500);
  }

  if (!note) {
    const emptyNote: LearningNote = {
      id: "",
      user_id: user.id,
      learning_path_id: pathId,
      content: DEFAULT_EMPTY_NOTE_DOC,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return jsonSuccess({ note: emptyNote });
  }

  return jsonSuccess({ note: note as LearningNote });
}

/**
 * PUT /api/learning-paths/[id]/notes
 *
 * Saves (upserts) the single rich-text notebook for the given learning path.
 * Body: { content: TiptapNode }
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { id: pathId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Confirm the learning path exists and belongs to the authenticated user
  const { data: path, error: pathError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("id", pathId)
    .eq("user_id", user.id)
    .single();

  if (pathError || !path) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  const body = await request.json().catch(() => null);
  const rawContent = (body && typeof body === "object" && "content" in body)
    ? (body as { content: unknown }).content
    : body;

  const validation = validateTiptapContent(rawContent);

  if (!validation.isValid) {
    return jsonError(
      "VALIDATION_ERROR",
      validation.error ?? "Invalid Tiptap notebook document structure.",
      400
    );
  }

  // Save the single shared notebook for this learning path.
  // Design: Rather than table-level upsert (which requires broad UPDATE table privileges),
  // we first attempt to UPDATE the existing row (common path for autosave/editing).
  // If the note does not yet exist, we INSERT it.
  // If a concurrent request created the note in between, unique conflict 23505 retries UPDATE.
  // This preserves column-level least privilege: GRANT UPDATE (content, updated_at).
  const { data: updatedNote, error: updateError } = await supabase
    .from("learning_notes")
    .update({
      content: validation.data!,
      updated_at: new Date().toISOString(),
    })
    .eq("learning_path_id", pathId)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (updateError) {
    console.error("Failed to update learning note:", updateError);
    return jsonError("INTERNAL_ERROR", "Failed to save learning path notebook.", 500);
  }

  let note = updatedNote;

  // If no existing note was found to update, insert the initial note
  if (!note) {
    const { data: insertedNote, error: insertError } = await supabase
      .from("learning_notes")
      .insert({
        learning_path_id: pathId,
        user_id: user.id,
        content: validation.data!,
      })
      .select()
      .single();

    if (insertedNote) {
      note = insertedNote;
    } else if (
      insertError &&
      (insertError.code === "23505" || insertError.message?.includes("duplicate key"))
    ) {
      // Concurrency race: another request inserted the initial note simultaneously; retry update
      const { data: retriedNote, error: retryError } = await supabase
        .from("learning_notes")
        .update({
          content: validation.data!,
          updated_at: new Date().toISOString(),
        })
        .eq("learning_path_id", pathId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (retryError || !retriedNote) {
        console.error("Failed to update learning note after concurrency conflict:", retryError);
        return jsonError("INTERNAL_ERROR", "Failed to save learning path notebook.", 500);
      }

      note = retriedNote;
    } else {
      console.error("Failed to insert learning note:", insertError);
      return jsonError("INTERNAL_ERROR", "Failed to save learning path notebook.", 500);
    }
  }

  return jsonSuccess({ note: note as LearningNote }, 200);
}

/**
 * PATCH /api/learning-paths/[id]/notes
 *
 * Alias for PUT to support PATCH semantics.
 */
export async function PATCH(request: Request, context: RouteContext) {
  return PUT(request, context);
}
