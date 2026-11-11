-- LinkShelf — Migration 004: Percentage-based Learning Progress
-- Version: 004
-- Description: Adds progress_percentage column (0-100) to learning_path_items,
--              backfills existing completed rows to 100 and uncompleted to 0,
--              enforces check constraints, and grants column-level update privilege.

-- -----------------------------------------------------------------------------
-- 1. Add progress_percentage Column with Constraints
-- -----------------------------------------------------------------------------
ALTER TABLE public.learning_path_items
    ADD COLUMN IF NOT EXISTS progress_percentage INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'learning_path_items_progress_percentage_check'
    ) THEN
        ALTER TABLE public.learning_path_items
            ADD CONSTRAINT learning_path_items_progress_percentage_check
            CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
    END IF;
END $$;

COMMENT ON COLUMN public.learning_path_items.progress_percentage IS 'Resource completion progress as an integer percentage from 0 through 100';

-- -----------------------------------------------------------------------------
-- 2. Backfill Existing Data
-- -----------------------------------------------------------------------------
UPDATE public.learning_path_items
SET progress_percentage = CASE
    WHEN is_completed = true THEN 100
    ELSE 0
END
WHERE progress_percentage = 0 AND is_completed = true;

-- -----------------------------------------------------------------------------
-- 3. Column Privileges
-- -----------------------------------------------------------------------------
-- Extend column-level UPDATE grant to progress_percentage for authenticated users
GRANT UPDATE (progress_percentage) ON TABLE public.learning_path_items TO authenticated;
