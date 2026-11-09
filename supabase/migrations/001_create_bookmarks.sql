-- LinkShelf — Migration 001: Create Bookmarks Table & Row Level Security (RLS)
-- Version: 001
-- Description: Creates the bookmarks table, RLS policies, indexes, updated_at trigger,
--              and enforces soft deletion by revoking DELETE privileges.

-- Ensure UUID generation functions are available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Table Definition
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ DEFAULT NULL,

    -- Database-level defense-in-depth constraints
    CONSTRAINT bookmarks_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT bookmarks_title_max_length CHECK (char_length(title) <= 255),
    CONSTRAINT bookmarks_url_valid_protocol CHECK (url ~* '^https?://')
);

COMMENT ON TABLE public.bookmarks IS 'Stores user bookmarks with tags, timestamps, and soft-delete support for Undo.';
COMMENT ON COLUMN public.bookmarks.id IS 'Unique UUID identifier generated with gen_random_uuid().';
COMMENT ON COLUMN public.bookmarks.user_id IS 'Owner UUID referencing auth.users(id).';
COMMENT ON COLUMN public.bookmarks.title IS 'Bookmark title (1-255 characters, trimmed).';
COMMENT ON COLUMN public.bookmarks.url IS 'Target URL, strictly starting with http:// or https://.';
COMMENT ON COLUMN public.bookmarks.tags IS 'Normalized array of string tags.';
COMMENT ON COLUMN public.bookmarks.created_at IS 'Timestamp of creation in UTC.';
COMMENT ON COLUMN public.bookmarks.updated_at IS 'Timestamp of last modification in UTC (managed via trigger).';
COMMENT ON COLUMN public.bookmarks.deleted_at IS 'Timestamp of soft deletion; NULL for active bookmarks.';

-- -----------------------------------------------------------------------------
-- 2. Indexes for Query Performance
-- -----------------------------------------------------------------------------
-- Foreign key index on user_id
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx
    ON public.bookmarks (user_id);

-- Primary dashboard query: Active bookmarks for a user ordered newest first
CREATE INDEX IF NOT EXISTS bookmarks_user_active_idx
    ON public.bookmarks (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Soft-deleted bookmarks index for Undo restoration & cleanup queries
CREATE INDEX IF NOT EXISTS bookmarks_user_deleted_idx
    ON public.bookmarks (user_id, deleted_at)
    WHERE deleted_at IS NOT NULL;

-- GIN index for tag containment filtering: tags @> ARRAY['tag']
CREATE INDEX IF NOT EXISTS bookmarks_tags_gin_idx
    ON public.bookmarks USING GIN (tags);

-- Case-insensitive title search index per user
CREATE INDEX IF NOT EXISTS bookmarks_user_title_lower_idx
    ON public.bookmarks (user_id, lower(title));

-- -----------------------------------------------------------------------------
-- 3. Automatic updated_at Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bookmarks_set_updated_at ON public.bookmarks;

CREATE TRIGGER trigger_bookmarks_set_updated_at
    BEFORE UPDATE ON public.bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Table Privileges & Permissions
-- -----------------------------------------------------------------------------
-- Soft-deletion enforcement: Revoke all privileges from anon and authenticated,
-- and grant only SELECT, INSERT, and UPDATE to authenticated users.
-- Physical DELETE operations are explicitly forbidden for client roles.
REVOKE ALL ON TABLE public.bookmarks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bookmarks TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy or previously defined policies
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can create their own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.bookmarks;

-- SELECT Policy: Users can only read their own bookmarks
CREATE POLICY "Users can view their own bookmarks"
    ON public.bookmarks
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- INSERT Policy: Users can only create bookmarks assigned to themselves
CREATE POLICY "Users can create their own bookmarks"
    ON public.bookmarks
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE Policy: Users can only update their own bookmarks and cannot transfer ownership
CREATE POLICY "Users can update their own bookmarks"
    ON public.bookmarks
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
