import { createClient } from "@/lib/supabase/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import {
  validateCreateLearningPathInput,
  calculateProgress,
} from "@/lib/learning-paths";
import type { LearningPathWithStats } from "@/types/learning-path";

/**
 * GET /api/learning-paths
 *
 * Returns all learning paths belonging to the authenticated user,
 * ordered by created_at DESC, with computed progress stats.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("UNAUTHORIZED", "Authentication required. Please sign in.", 401);
  }

  // Fetch paths with their items (for progress calculation)
  const { data: paths, error: dbError } = await supabase
    .from("learning_paths")
    .select("*, learning_path_items(id, is_completed)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to retrieve learning paths.", 500);
  }

  const result: LearningPathWithStats[] = (paths ?? []).map((path) => {
    const items = (path.learning_path_items ?? []) as { id: string; is_completed: boolean }[];
    const progress = calculateProgress(items);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { learning_path_items: _items, ...pathFields } = path;
    return {
      ...pathFields,
      ...progress,
    };
  });

  return jsonSuccess({ learning_paths: result, total: result.length });
}

/**
 * POST /api/learning-paths
 *
 * Creates a new learning path for the authenticated user.
 * Body: { title: string, description?: string }
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
  const validation = validateCreateLearningPathInput(body);

  if (!validation.isValid) {
    return jsonError("VALIDATION_ERROR", "Invalid learning path input.", 400, validation.errors);
  }

  const { data: path, error: dbError } = await supabase
    .from("learning_paths")
    .insert({
      user_id: user.id,
      title: validation.data!.title,
      description: validation.data!.description ?? "",
    })
    .select()
    .single();

  if (dbError) {
    return jsonError("INTERNAL_ERROR", "Failed to create learning path.", 500);
  }

  return jsonSuccess(
    {
      learning_path: {
        ...path,
        total_items: 0,
        completed_items: 0,
        progress_percentage: 0,
      },
    },
    201
  );
}
