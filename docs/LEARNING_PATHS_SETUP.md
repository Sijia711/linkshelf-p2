# LinkShelf — Learning Paths Database Setup & Verification Guide

This guide walks through applying and verifying Migration 002 (`supabase/migrations/002_create_learning_paths.sql`) in your Supabase project.

---

## 1. Prerequisites

1. Access to your project dashboard on [Supabase](https://supabase.com/dashboard).
2. Migration 001 (`public.bookmarks`) must already be applied.

---

## 2. Applying Migration 002 via Supabase SQL Editor

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your LinkShelf project and navigate to **SQL Editor**.
3. Click **+ New query**.
4. Copy and paste the entire contents of [`supabase/migrations/002_create_learning_paths.sql`](../supabase/migrations/002_create_learning_paths.sql) into the query editor.
5. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
6. Confirm that the editor displays: `Success. No rows returned`.

---

## 3. Verification Queries

Run the following queries in the Supabase SQL Editor to confirm that both tables, security policies, triggers, and indexes were applied properly.

### 3.1 Verify Tables Structure
```sql
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('learning_paths', 'learning_path_items')
ORDER BY table_name, ordinal_position;
```

---

### 3.2 Verify Row Level Security (RLS) Status
```sql
SELECT 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('learning_paths', 'learning_path_items');
```
**Expected Output:** Both tables must have `rowsecurity = true`.

---

### 3.3 Verify RLS Policies (Cross-User Defense)
```sql
SELECT 
    tablename,
    policyname, 
    cmd, 
    roles, 
    qual AS using_expression, 
    with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('learning_paths', 'learning_path_items')
ORDER BY tablename, policyname;
```
**Expected Output:**
- `learning_paths`: 4 policies (SELECT, INSERT, UPDATE, DELETE) enforcing `auth.uid() = user_id`.
- `learning_path_items`: 4 policies, with the INSERT policy explicitly verifying:
  1. `auth.uid() = user_id`
  2. `EXISTS (SELECT 1 FROM learning_paths lp WHERE lp.id = learning_path_id AND lp.user_id = auth.uid())`
  3. `EXISTS (SELECT 1 FROM bookmarks b WHERE b.id = bookmark_id AND b.user_id = auth.uid())`

---

### 3.4 Verify Foreign Key Behaviors
- Deleting a `learning_path` deletes its `learning_path_items` (via `ON DELETE CASCADE`).
- Deleting a `learning_path` **does not** delete the underlying `bookmarks`.
- Deleting a `learning_path_item` **does not** delete the underlying `bookmark`.

---

## 4. Functional Testing Queries (Interactive Validation)

```sql
-- 1. Test duplicate bookmark prevention in the same path (should fail)
-- Inserting item with same learning_path_id and bookmark_id violates unique constraint:
-- ERROR: duplicate key value violates unique constraint "learning_path_items_unique_bookmark"

-- 2. Test cross-user bookmark injection (should fail under RLS)
-- Attempting to add another user's bookmark into your path will be rejected by RLS policy.
```
