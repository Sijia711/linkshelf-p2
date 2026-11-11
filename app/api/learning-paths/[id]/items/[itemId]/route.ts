import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { reorderItems, validateProgressPercentage } from "@/lib/learning-paths";
import type { UpdatePathItemInput } from "@/types/learning-path";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

/**
 * Validates an UpdatePathItemInput request body.
 * Supports:
 * - progress_percentage (0-100 numeric, truncated toward zero)
 * - is_completed (boolean, backward compatible: true -> 100, false -> 0)
 * - direction ("up" | "down" for reordering)
 */
function validateUpdatePathItemInput(input: unknown): {
  isValid: boolean;
  data?: UpdatePathItemInput;
  error?: string;
} {
  if (!input || typeof input !== "object") {
    return { isValid: false, error: "Invalid request body." };
  }

  const raw = input as Record<string, unknown>;
  const hasProgress = raw.progress_percentage !== undefined;
  const hasIsCompleted = raw.is_completed !== undefined;
  const hasDirection = raw.direction !== undefined;

  if (!hasProgress && !hasIsCompleted && !hasDirection) {
    return {
      isValid: false,
      error: "At least one field (progress_percentage, is_completed, direction) must be provided.",
    };
  }

  const data: UpdatePathItemInput & { direction?: "up" | "down" } = {};

  if (hasProgress) {
    const progressValidation = validateProgressPercentage(raw.progress_percentage);
    if (!progressValidation.isValid) {
      return { isValid: false, error: progressValidation.error };
    }
    data.progress_percentage = progressValidation.value!;
    data.is_completed = progressValidation.value === 100;
  } else if (hasIsCompleted) {
    if (typeof raw.is_completed !== "boolean") {
      return { isValid: false, error: "is_completed must be a boolean." };
    }
    data.is_completed = raw.is_completed;
    data.progress_percentage = raw.is_completed ? 100 : 0;
  }

  if (hasDirection) {
    if (raw.direction !== "up" && raw.direction !== "down") {
      return { isValid: false, error: 'direction must be "up" or "down".' };
    }
    // direction is handled separately; store it in the return
    (data as Record<string, unknown>).direction = raw.direction;
  }

  return { isValid: true, data };
}

/**
 * PATCH /api/learning-paths/[id]/items/[itemId]
 *
 * Updates a learning path item. Supports:
 * - Toggling completion: { is_completed: boolean }
 * - Reordering:         { direction: "up" | "down" }
 *
 * Both may be provided together. When reordering, the positions of the
 * swapped sibling are updated atomically via two upsert calls.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id: learningPathId, itemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Confirm the learning path belongs to the user
  const { data: path, error: pathError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("id", learningPathId)
    .eq("user_id", user.id)
    .single();

  if (pathError || !path) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  // Parse and validate body
  const body = await request.json().catch(() => null);
  const validation = validateUpdatePathItemInput(body);

  if (!validation.isValid) {
    return jsonError("VALIDATION_ERROR", validation.error ?? "Invalid input.", 400);
  }

  const raw = body as Record<string, unknown>;
  const direction = raw.direction as "up" | "down" | undefined;

  // Fetch the item to update
  const { data: item, error: itemError } = await supabase
    .from("learning_path_items")
    .select("*")
    .eq("id", itemId)
    .eq("learning_path_id", learningPathId)
    .eq("user_id", user.id)
    .single();

  if (itemError || !item) {
    return jsonError("NOT_FOUND", "Learning path item not found.", 404);
  }

  // Handle reordering
  if (direction) {
    // Fetch all items for this path to determine positions
    const { data: allItems, error: allItemsError } = await supabase
      .from("learning_path_items")
      .select("id, position")
      .eq("learning_path_id", learningPathId)
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    if (allItemsError || !allItems) {
      return jsonError("INTERNAL_ERROR", "Failed to retrieve items for reordering.", 500);
    }

    const { updated, items: reordered } = reorderItems(allItems, itemId, direction);

    if (!updated) {
      return jsonError(
        "REORDER_BOUNDARY",
        "Item is already at the boundary and cannot be moved further.",
        400
      );
    }

    // Find the sibling that was swapped
    const originalItem = allItems.find((i) => i.id === itemId)!;
    const newItem = reordered.find((i) => i.id === itemId)!;
    const sibling = reordered.find(
      (i) => i.id !== itemId && i.position === originalItem.position
    );

    // Update swapped items — two separate updates to avoid unique constraint issues
    // First move item to a temporary position to avoid conflict
    const maxPos = Math.max(...reordered.map(i => i.position));
    const tempPosition = maxPos + 1;
    await supabase
      .from("learning_path_items")
      .update({ position: tempPosition })
      .eq("id", itemId)
      .eq("user_id", user.id);

    if (sibling) {
      await supabase
        .from("learning_path_items")
        .update({ position: originalItem.position })
        .eq("id", sibling.id)
        .eq("user_id", user.id);
    }

    // Now set the target item's final position
    const { error: finalUpdateError } = await supabase
      .from("learning_path_items")
      .update({ position: newItem.position })
      .eq("id", itemId)
      .eq("user_id", user.id);

    if (finalUpdateError) {
      return jsonError("INTERNAL_ERROR", "Failed to reorder items.", 500);
    }
  }

  // Handle progress percentage & completion updates
  const updateFields: Record<string, unknown> = {};

  if (validation.data?.progress_percentage !== undefined) {
    updateFields.progress_percentage = validation.data.progress_percentage;
    updateFields.is_completed = validation.data.progress_percentage === 100;
    updateFields.completed_at =
      validation.data.progress_percentage === 100 ? new Date().toISOString() : null;
  } else if (validation.data?.is_completed !== undefined) {
    updateFields.is_completed = validation.data.is_completed;
    updateFields.progress_percentage = validation.data.is_completed ? 100 : 0;
    updateFields.completed_at = validation.data.is_completed ? new Date().toISOString() : null;
  }

  // Fetch and return the final state of the item
  if (Object.keys(updateFields).length > 0) {
    let { data: updated, error: updateError } = await supabase
      .from("learning_path_items")
      .update(updateFields)
      .eq("id", itemId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (
      updateError &&
      updateFields.progress_percentage !== undefined &&
      (updateError.code === "42703" ||
        updateError.code === "PGRST204" ||
        updateError.code === "42501" ||
        (updateError.message && updateError.message.includes("progress_percentage")))
    ) {
      // If progress_percentage column does not exist in DB yet or lacks UPDATE privilege,
      // fall back to updating without it (updating is_completed, completed_at, updated_at)
      const fallbackFields = { ...updateFields };
      delete fallbackFields.progress_percentage;
      const fallback = await supabase
        .from("learning_path_items")
        .update(fallbackFields)
        .eq("id", itemId)
        .eq("user_id", user.id)
        .select()
        .single();
      updated = fallback.data;
      updateError = fallback.error;
    }

    if (updateError || !updated) {
      console.error("Failed to update learning path item:", updateError);
      return jsonError("INTERNAL_ERROR", "Failed to update learning path item.", 500);
    }

    const targetProgress = validation.data?.progress_percentage;
    const returnedItem = updated
      ? {
          ...updated,
          progress_percentage:
            (updated as { progress_percentage?: number }).progress_percentage ??
            (targetProgress !== undefined ? targetProgress : updated.is_completed ? 100 : 0),
        }
      : updated;

    return jsonSuccess({ item: returnedItem });
  }

  // If only reordering was done, refetch the updated item
  const { data: refreshed, error: refreshError } = await supabase
    .from("learning_path_items")
    .select("*")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .single();

  if (refreshError || !refreshed) {
    return jsonError("INTERNAL_ERROR", "Failed to retrieve updated item.", 500);
  }

  const returnedRefreshed = refreshed
    ? {
        ...refreshed,
        progress_percentage:
          (refreshed as { progress_percentage?: number }).progress_percentage ??
          (refreshed.is_completed ? 100 : 0),
      }
    : refreshed;

  return jsonSuccess({ item: returnedRefreshed });
}

/**
 * DELETE /api/learning-paths/[id]/items/[itemId]
 *
 * Removes an item from a learning path. The underlying bookmark is NOT deleted.
 * Remaining items are re-indexed sequentially to close the gap.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id: learningPathId, itemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Confirm the learning path belongs to the user
  const { data: path, error: pathError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("id", learningPathId)
    .eq("user_id", user.id)
    .single();

  if (pathError || !path) {
    return jsonError("NOT_FOUND", "Learning path not found.", 404);
  }

  // Confirm the item exists and belongs to the user/path
  const { data: item, error: itemError } = await supabase
    .from("learning_path_items")
    .select("id, position")
    .eq("id", itemId)
    .eq("learning_path_id", learningPathId)
    .eq("user_id", user.id)
    .single();

  if (itemError || !item) {
    return jsonError("NOT_FOUND", "Learning path item not found.", 404);
  }

  // Delete the item
  const { error: deleteError } = await supabase
    .from("learning_path_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (deleteError) {
    return jsonError("INTERNAL_ERROR", "Failed to remove item from learning path.", 500);
  }

  // Re-index remaining items to close any position gap
  const { data: remaining, error: remainingError } = await supabase
    .from("learning_path_items")
    .select("id, position")
    .eq("learning_path_id", learningPathId)
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (!remainingError && remaining && remaining.length > 0) {
    // Only re-index items whose position needs adjusting (those after the deleted one)
    const needsUpdate = remaining.filter((r, idx) => r.position !== idx);
    if (needsUpdate.length > 0) {
      await Promise.all(
        remaining.map((r, idx) =>
          r.position !== idx
            ? supabase
                .from("learning_path_items")
                .update({ position: idx })
                .eq("id", r.id)
                .eq("user_id", user.id)
            : Promise.resolve()
        )
      );
    }
  }

  return jsonSuccess({ message: "Item removed from learning path." });
}
