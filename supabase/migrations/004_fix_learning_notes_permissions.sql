-- LinkShelf — Migration 004: Grant Table-Level UPDATE on learning_notes
-- Version: 004
-- Description: Grants table-level UPDATE on public.learning_notes to authenticated role.
--              In PostgreSQL, INSERT ... ON CONFLICT DO UPDATE (upsert) requires table-level UPDATE
--              privileges even when only specific columns are modified.
--              Row Level Security (RLS) policies strictly enforce that users can only update
--              notes belonging to their own learning paths.

GRANT UPDATE ON TABLE public.learning_notes TO authenticated;
