# LinkShelf — Supabase Database Setup & Verification Guide

This guide walks through applying and verifying Migration 001 (`supabase/migrations/001_create_bookmarks.sql`) in your Supabase project.

---

## 1. Prerequisites

1. Access to your project dashboard on [Supabase](https://supabase.com/dashboard).
2. The project URL configured in `.env.local`.

---

## 2. Applying the Migration via Supabase SQL Editor

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your LinkShelf project.
3. In the left navigation sidebar, click **SQL Editor** (icon with `>_`).
4. Click **+ New query**.
5. Copy and paste the entire contents of [`supabase/migrations/001_create_bookmarks.sql`](../supabase/migrations/001_create_bookmarks.sql) into the query editor.
6. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
7. Confirm that the editor displays: `Success. No rows returned`.

---

## 3. Verification Queries

Run each of the following queries in the Supabase SQL Editor to confirm that the schema, security privileges, policies, triggers, and indexes were applied properly.

### 3.1 Verify Table Structure & Constraints
```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'bookmarks'
ORDER BY ordinal_position;
```
**Expected Columns:**
- `id`: `uuid`, NOT NULL, default `gen_random_uuid()`
- `user_id`: `uuid`, NOT NULL (references `auth.users(id)`)
- `title`: `text`, NOT NULL (check: 1–255 chars, non-empty)
- `url`: `text`, NOT NULL (check: regex `^https?://`)
- `tags`: `ARRAY`, NOT NULL, default `'{}'::text[]`
- `created_at`: `timestamp with time zone`, NOT NULL, default `timezone('utc'::text, now())`
- `updated_at`: `timestamp with time zone`, NOT NULL, default `timezone('utc'::text, now())`
- `deleted_at`: `timestamp with time zone`, nullable (for soft delete / Undo)

---

### 3.2 Verify Table Privileges (Soft-Delete Enforcement)
```sql
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
  AND table_name = 'bookmarks' 
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
```
**Expected Output:**
- `anon`: **No privileges returned** (all revoked).
- `authenticated`: Strictly **`INSERT`**, **`SELECT`**, and **`UPDATE`**.
- Notice: **`DELETE` is NOT granted**, preventing any regular user from physically destroying bookmark records.

---

### 3.3 Verify Row Level Security (RLS) Status
```sql
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'bookmarks';
```
**Expected Output:**
`rowsecurity` must be `true`.

---

### 3.4 Verify RLS Policies
```sql
SELECT 
    policyname, 
    cmd, 
    roles, 
    qual AS using_expression, 
    with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'bookmarks'
ORDER BY policyname;
```
**Expected Output (Strictly 3 Policies):**
1. `Users can create their own bookmarks` (INSERT): `check_expression` = `(auth.uid() = user_id)`
2. `Users can update their own bookmarks` (UPDATE): both `using_expression` and `check_expression` = `(auth.uid() = user_id)`
3. `Users can view their own bookmarks` (SELECT): `using_expression` = `(auth.uid() = user_id)`
*(No DELETE policy exists because table-level DELETE privileges are revoked)*

---

### 3.5 Verify Indexes
```sql
SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'bookmarks'
ORDER BY indexname;
```
**Expected Indexes:**
- `bookmarks_pkey`: PRIMARY KEY (`id`)
- `bookmarks_user_id_idx`: B-Tree on `(user_id)`
- `bookmarks_user_active_idx`: Partial index on `(user_id, created_at DESC)` WHERE `deleted_at IS NULL`
- `bookmarks_user_deleted_idx`: Partial index on `(user_id, deleted_at)` WHERE `deleted_at IS NOT NULL`
- `bookmarks_tags_gin_idx`: GIN index on `(tags)`
- `bookmarks_user_title_lower_idx`: B-Tree on `(user_id, lower(title))`

---

### 3.6 Verify `updated_at` Trigger
```sql
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'bookmarks';
```
**Expected Output:**
`trigger_bookmarks_set_updated_at` on `UPDATE` executing `EXECUTE FUNCTION public.set_updated_at()`.

---

## 4. Functional Testing Queries (Interactive Validation)

### 4.1 Test Physical Deletion Block (Should Fail)
```sql
-- Attempting physical deletion as an authenticated user:
DELETE FROM public.bookmarks WHERE id = 'SOME_BOOKMARK_ID';
-- ERROR: permission denied for table bookmarks
```

### 4.2 Test Constraints (Should Fail)
```sql
-- 1. Fails: Empty title check
INSERT INTO public.bookmarks (user_id, title, url)
VALUES (gen_random_uuid(), '   ', 'https://example.com');
-- ERROR: new row for relation "bookmarks" violates check constraint "bookmarks_title_not_empty"

-- 2. Fails: Malicious/unsupported protocol
INSERT INTO public.bookmarks (user_id, title, url)
VALUES (gen_random_uuid(), 'Malicious Link', 'javascript:alert(1)');
-- ERROR: new row for relation "bookmarks" violates check constraint "bookmarks_url_valid_protocol"
```

### 4.3 Test Soft-Delete & Undo Semantics
```sql
-- Soft delete (sets deleted_at timestamp)
UPDATE public.bookmarks
SET deleted_at = timezone('utc'::text, now())
WHERE id = 'SOME_BOOKMARK_ID';

-- Active bookmarks query excludes deleted items
SELECT * FROM public.bookmarks
WHERE deleted_at IS NULL;

-- Undo (resets deleted_at to NULL)
UPDATE public.bookmarks
SET deleted_at = NULL
WHERE id = 'SOME_BOOKMARK_ID';
```

---

## 5. Security Invariants Enforced

1. **Physical Deletion Forbidden:** Revoking `DELETE` on `public.bookmarks` prevents accidental or malicious data loss and guarantees that Undo functionality works reliably.
2. **Strict User Isolation:** All `SELECT`, `INSERT`, and `UPDATE` operations require `auth.uid() = user_id`.
3. **Ownership Immutability:** The `UPDATE` policy enforces `WITH CHECK (auth.uid() = user_id)`. Any attempt to update `user_id` to another user's UUID is blocked by PostgreSQL.
4. **No Anonymous Access:** All permissions are revoked from `anon`. Unauthenticated clients cannot read or write any rows.
