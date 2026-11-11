-- LinkShelf — Migration 003: Learning Path Rich-Text Notebook
-- Version: 003
-- Description: Creates learning_notes table for path-level rich-text notes with Tiptap JSON content,
--              enforces one shared notebook per learning path (UNIQUE constraint),
--              cascades on learning_paths deletion, and secures via RLS.

-- -----------------------------------------------------------------------------
-- 1. Table Definitions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.learning_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
    content JSONB NOT NULL DEFAULT '{"type": "doc", "content": [{"type": "paragraph"}]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Enforce exactly ONE notebook per learning path
    CONSTRAINT learning_notes_learning_path_unique UNIQUE (learning_path_id)
);

COMMENT ON TABLE public.learning_notes IS 'Path-level rich-text notebook shared across all resources in a learning path';
COMMENT ON COLUMN public.learning_notes.id IS 'Primary key UUID for the learning note';
COMMENT ON COLUMN public.learning_notes.user_id IS 'Owner UUID referencing auth.users(id)';
COMMENT ON COLUMN public.learning_notes.learning_path_id IS 'Unique reference to the parent learning_paths table (1:1)';
COMMENT ON COLUMN public.learning_notes.content IS 'Structured Tiptap JSON document';

-- -----------------------------------------------------------------------------
-- 2. Indexes for Query Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS learning_notes_user_id_idx
    ON public.learning_notes (user_id);

CREATE INDEX IF NOT EXISTS learning_notes_path_id_idx
    ON public.learning_notes (learning_path_id);

-- -----------------------------------------------------------------------------
-- 3. Automatic updated_at Trigger
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_learning_notes_set_updated_at ON public.learning_notes;
CREATE TRIGGER trigger_learning_notes_set_updated_at
    BEFORE UPDATE ON public.learning_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Table Privileges
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.learning_notes FROM anon, authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.learning_notes TO authenticated;
GRANT UPDATE (content, updated_at) ON TABLE public.learning_notes TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.learning_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own learning notes" ON public.learning_notes;
DROP POLICY IF EXISTS "Users can create notes for their own learning paths" ON public.learning_notes;
DROP POLICY IF EXISTS "Users can update their own learning notes" ON public.learning_notes;
DROP POLICY IF EXISTS "Users can delete their own learning notes" ON public.learning_notes;

CREATE POLICY "Users can view their own learning notes"
    ON public.learning_notes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create notes for their own learning paths"
    ON public.learning_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_paths lp
            WHERE lp.id = learning_notes.learning_path_id
              AND lp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own learning notes"
    ON public.learning_notes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_paths lp
            WHERE lp.id = learning_notes.learning_path_id
              AND lp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own learning notes"
    ON public.learning_notes
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
