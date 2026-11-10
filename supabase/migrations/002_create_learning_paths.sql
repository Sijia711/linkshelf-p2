-- LinkShelf — Migration 002: Learning Paths & Progress Tracking
-- Version: 002
-- Description: Creates learning_paths and learning_path_items tables, RLS policies,
--              progress tracking columns, and cross-user link prevention.

-- -----------------------------------------------------------------------------
-- 1. Table Definitions
-- -----------------------------------------------------------------------------

-- Learning Paths parent table
CREATE TABLE IF NOT EXISTS public.learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT learning_paths_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT learning_paths_title_max_length CHECK (char_length(title) <= 255),
    CONSTRAINT learning_paths_desc_max_length CHECK (char_length(description) <= 2000)
);

COMMENT ON TABLE public.learning_paths IS 'Curated sequences of bookmarks organizing learning topics';
COMMENT ON COLUMN public.learning_paths.id IS 'Unique identifier for learning path';
COMMENT ON COLUMN public.learning_paths.user_id IS 'Owner UUID referencing auth.users(id)';
COMMENT ON COLUMN public.learning_paths.title IS 'Title of the learning path (1-255 characters)';
COMMENT ON COLUMN public.learning_paths.description IS 'Optional overview description of the path';

-- Learning Path Items (ordered junction linking bookmarks to paths)
CREATE TABLE IF NOT EXISTS public.learning_path_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
    bookmark_id UUID NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Prevent duplicate bookmarks within the same learning path
    CONSTRAINT learning_path_items_unique_bookmark UNIQUE (learning_path_id, bookmark_id),
    -- NOTE: position >= 0 is intentionally omitted to allow the two-phase swap
    --       algorithm to use a large sentinel value during reorder.
    --       The API enforces non-negative positions at the application layer.
    CONSTRAINT learning_path_items_position_non_negative CHECK (position >= 0)
);

-- -----------------------------------------------------------------------------
-- 2a. Remove position >= 0 constraint to allow swap sentinel value
-- -----------------------------------------------------------------------------
-- RATIONALE: The reorder algorithm temporarily sets position to a sentinel
-- (max_position + 1 + offset) before assigning the final position. Because
-- the sentinel is always >= 0 we can KEEP the check; the original code used
-- -1 which WOULD violate it, so we fix the API instead (see section 6 below).
-- The constraint is therefore valid as written and no change is needed here.

COMMENT ON TABLE public.learning_path_items IS 'Ordered steps in a learning path pointing to bookmarks';
COMMENT ON COLUMN public.learning_path_items.position IS 'Deterministic sequential position (0-based); maintained by application layer';
COMMENT ON COLUMN public.learning_path_items.is_completed IS 'Tracks completion progress of the step';
COMMENT ON COLUMN public.learning_path_items.completed_at IS 'Timestamp when marked as completed';

-- -----------------------------------------------------------------------------
-- 2b. Indexes for Query Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS learning_paths_user_id_idx
    ON public.learning_paths (user_id);

CREATE INDEX IF NOT EXISTS learning_paths_user_created_idx
    ON public.learning_paths (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS learning_path_items_path_pos_idx
    ON public.learning_path_items (learning_path_id, position ASC);

CREATE INDEX IF NOT EXISTS learning_path_items_bookmark_idx
    ON public.learning_path_items (bookmark_id);

CREATE INDEX IF NOT EXISTS learning_path_items_user_idx
    ON public.learning_path_items (user_id);

-- -----------------------------------------------------------------------------
-- 3. Automatic updated_at Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_learning_paths_set_updated_at ON public.learning_paths;
CREATE TRIGGER trigger_learning_paths_set_updated_at
    BEFORE UPDATE ON public.learning_paths
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_learning_path_items_set_updated_at ON public.learning_path_items;
CREATE TRIGGER trigger_learning_path_items_set_updated_at
    BEFORE UPDATE ON public.learning_path_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Table Privileges — column-level UPDATE restrictions (defense-in-depth)
-- -----------------------------------------------------------------------------

-- Revoke all first, then grant SELECT/INSERT/DELETE
REVOKE ALL ON TABLE public.learning_paths, public.learning_path_items FROM anon, authenticated;

-- learning_paths: authenticated users may INSERT, DELETE, SELECT freely.
-- UPDATE is restricted to mutable columns only (title, description, updated_at).
-- user_id, id, created_at are immutable; updated_at is managed by trigger.
GRANT SELECT, INSERT, DELETE ON TABLE public.learning_paths TO authenticated;
GRANT UPDATE (title, description, updated_at) ON TABLE public.learning_paths TO authenticated;

-- learning_path_items: authenticated users may INSERT, DELETE, SELECT freely.
-- UPDATE is restricted to mutable columns only (position, is_completed, completed_at, updated_at).
-- user_id, learning_path_id, bookmark_id, id, created_at are immutable after creation.
GRANT SELECT, INSERT, DELETE ON TABLE public.learning_path_items TO authenticated;
GRANT UPDATE (position, is_completed, completed_at, updated_at) ON TABLE public.learning_path_items TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_path_items ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Users can view their own learning paths" ON public.learning_paths;
DROP POLICY IF EXISTS "Users can create their own learning paths" ON public.learning_paths;
DROP POLICY IF EXISTS "Users can update their own learning paths" ON public.learning_paths;
DROP POLICY IF EXISTS "Users can delete their own learning paths" ON public.learning_paths;

DROP POLICY IF EXISTS "Users can view their own learning path items" ON public.learning_path_items;
DROP POLICY IF EXISTS "Users can create items in their own learning paths" ON public.learning_path_items;
DROP POLICY IF EXISTS "Users can update their own learning path items" ON public.learning_path_items;
DROP POLICY IF EXISTS "Users can delete their own learning path items" ON public.learning_path_items;

-- ── learning_paths policies ───────────────────────────────────────────────────

CREATE POLICY "Users can view their own learning paths"
    ON public.learning_paths
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own learning paths"
    ON public.learning_paths
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- WITH CHECK also verifies user_id cannot be changed (column grant already blocks
-- updating user_id via privilege, but belt-and-suspenders at policy level too).
CREATE POLICY "Users can update their own learning paths"
    ON public.learning_paths
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning paths"
    ON public.learning_paths
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ── learning_path_items policies ─────────────────────────────────────────────

CREATE POLICY "Users can view their own learning path items"
    ON public.learning_path_items
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- INSERT: defense-in-depth —
--   • user_id on the new row must match the caller
--   • the target learning path must belong to the caller
--   • the referenced bookmark must belong to the caller AND must NOT be soft-deleted
--     (soft-deleted bookmarks cannot be enrolled in new paths)
CREATE POLICY "Users can create items in their own learning paths"
    ON public.learning_path_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_paths lp
            WHERE lp.id = learning_path_id AND lp.user_id = auth.uid()
        ) AND
        EXISTS (
            SELECT 1 FROM public.bookmarks b
            WHERE b.id = bookmark_id
              AND b.user_id = auth.uid()
              AND b.deleted_at IS NULL   -- reject soft-deleted bookmarks at INSERT time
        )
    );

-- UPDATE: defense-in-depth —
--   USING  — the existing row must belong to the caller
--   WITH CHECK — after update:
--     • user_id still matches caller (column grant already blocks changing it, belt-and-suspenders)
--     • learning_path_id still refers to a path owned by the caller (guards against
--       attempts to move an item to a path the user owns that belongs to someone else)
--
--   NOTE: We intentionally do NOT re-check bookmark ownership or deleted_at here.
--   Completion toggles (is_completed) must succeed even after a bookmark is soft-deleted,
--   because the item itself is still a valid record. The INSERT policy already blocked
--   linking soft-deleted bookmarks at creation time.
CREATE POLICY "Users can update their own learning path items"
    ON public.learning_path_items
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_paths lp
            WHERE lp.id = learning_path_id AND lp.user_id = auth.uid()
        ) AND
        EXISTS (
            SELECT 1 FROM public.bookmarks b
            WHERE b.id = bookmark_id AND b.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own learning path items"
    ON public.learning_path_items
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. RLS Policy Verification Queries
--    (Run these in the Supabase SQL Editor after applying the migration to verify
--     the policies are enforced. Replace the UUIDs with actual test values.)
-- -----------------------------------------------------------------------------

-- ✓ Cross-user INSERT on learning_path_items should be rejected by RLS:
--   (Execute as user B; lp_id must belong to user A)
--   INSERT INTO public.learning_path_items (learning_path_id, bookmark_id, user_id, position)
--   VALUES ('<user_a_path_id>', '<user_b_bookmark_id>', auth.uid(), 0);
--   → Should FAIL with RLS violation (EXISTS check on learning_paths fails).

-- ✓ Cross-user UPDATE on learning_path_items should be rejected:
--   (Execute as user B; item_id must belong to user A)
--   UPDATE public.learning_path_items SET is_completed = true WHERE id = '<user_a_item_id>';
--   → Should return 0 rows updated (USING clause filters it out for user B).

-- ✓ INSERT linking a soft-deleted bookmark should be rejected:
--   UPDATE public.bookmarks SET deleted_at = now() WHERE id = '<bm_id>';
--   INSERT INTO public.learning_path_items (learning_path_id, bookmark_id, user_id, position)
--   VALUES ('<own_path_id>', '<bm_id>', auth.uid(), 0);
--   → Should FAIL (deleted_at IS NULL check fails in INSERT WITH CHECK).

-- ✓ UPDATE (completion toggle) should succeed even when bookmark is soft-deleted:
--   -- item already exists in the path; now soft-delete the linked bookmark
--   UPDATE public.bookmarks SET deleted_at = now() WHERE id = '<bm_id>';
--   UPDATE public.learning_path_items SET is_completed = true WHERE id = '<item_id>';
--   → Should SUCCEED (UPDATE policy does not re-check bookmark deleted_at).

-- ✓ Normal ownership operations:
--   SELECT * FROM public.learning_paths;        -- returns only caller's paths
--   SELECT * FROM public.learning_path_items;   -- returns only caller's items
--   INSERT INTO public.learning_paths (user_id, title) VALUES (auth.uid(), 'My Path');
--   UPDATE public.learning_paths SET title = 'Renamed' WHERE id = '<own_path_id>';
--   DELETE FROM public.learning_paths WHERE id = '<own_path_id>';

-- Final security hardening for Migration 002

-- 1. Prevent attaching soft-deleted or foreign bookmarks
ALTER POLICY "Users can create items in their own learning paths"
ON public.learning_path_items
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.learning_paths lp
    WHERE lp.id = learning_path_id
      AND lp.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.bookmarks b
    WHERE b.id = bookmark_id
      AND b.user_id = auth.uid()
      AND b.deleted_at IS NULL
  )
);

-- 2. Protect both references during UPDATE
ALTER POLICY "Users can update their own learning path items"
ON public.learning_path_items
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.learning_paths lp
    WHERE lp.id = learning_path_id
      AND lp.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.bookmarks b
    WHERE b.id = bookmark_id
      AND b.user_id = auth.uid()
  )
);

-- 3. Prevent changes to ownership/reference columns
REVOKE UPDATE ON TABLE
  public.learning_paths,
  public.learning_path_items
FROM authenticated;

GRANT UPDATE (title, description)
ON TABLE public.learning_paths
TO authenticated;

GRANT UPDATE (position, is_completed, completed_at)
ON TABLE public.learning_path_items
TO authenticated;
