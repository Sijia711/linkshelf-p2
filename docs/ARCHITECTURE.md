# LinkShelf — Architecture and Database Schema

This document describes the system as it exists in the repository. Every box, arrow, table, and column below was checked against the code on `main` (sources listed in §5). Parts that are still in open pull requests are labelled **(PR pending)**.

## 1. System architecture

```mermaid
flowchart LR
    subgraph Browser["Browser"]
        AuthPages["Sign-in and sign-up pages<br/>/login, /signup"]
        Workspace["BookmarkWorkspace<br/>features/bookmark-ui<br/>mounted on /dashboard (PR pending)"]
        LPUI["Learning Paths UI<br/>/learning-paths, /learning-paths/[id]<br/>client components"]
    end

    subgraph Vercel["Vercel: Next.js 16 App Router"]
        Proxy["proxy.ts + lib/supabase/proxy.ts<br/>refreshes session cookie,<br/>redirects / and /dashboard"]
        Dashboard["Server Component<br/>app/dashboard/page.tsx<br/>getUser, else redirect to /login"]
        Actions["Server Actions<br/>app/auth/actions.ts<br/>sign in, sign up, sign out"]
        AuthRoutes["Route Handlers<br/>/auth/callback, /auth/signout"]
        API["REST Route Handlers app/api/**<br/>getUser, validate with lib/*,<br/>query, return data/error envelope"]
        ServerClient["lib/supabase/server.ts<br/>@supabase/ssr cookie-based client"]
    end

    subgraph Supabase["Supabase"]
        Auth["Supabase Auth<br/>auth.users"]
        DB[("PostgreSQL<br/>bookmarks, learning_paths,<br/>learning_path_items<br/>RLS: auth.uid() = user_id")]
    end

    Browser -->|"every request passes through"| Proxy
    AuthPages -->|"form submit"| Actions
    Workspace -->|"fetch /api/bookmarks/*"| API
    LPUI -->|"fetch /api/learning-paths/*<br/>and /api/bookmarks"| API
    Dashboard -.->|"renders (PR pending)"| Workspace

    Proxy -->|"getUser, cookie refresh"| Auth
    Dashboard --> ServerClient
    Actions --> ServerClient
    AuthRoutes --> ServerClient
    API --> ServerClient

    ServerClient -->|"auth calls"| Auth
    ServerClient -->|"queries as the signed-in user<br/>publishable key + session JWT"| DB
```

### 1.1 Request flows

- **Every request** (except static assets) passes through `proxy.ts`, which calls `updateSession` in `lib/supabase/proxy.ts`. It verifies the user with `supabase.auth.getUser()`, refreshes session cookies, sends signed-out visitors on `/` or `/dashboard` to `/login`, and sends signed-in visitors on `/login`, `/signup`, or `/` to `/dashboard`. If the Supabase environment variables are missing, it passes requests through.
- **Authentication** never goes through `/api`. The sign-in and sign-up pages submit to Server Actions in `app/auth/actions.ts`, which validate input with `lib/auth.ts` and call `signInWithPassword`, `signUp`, or `signOut`. Email confirmation links land on `/auth/callback`, which calls `exchangeCodeForSession`.
- **Data** goes through the REST Route Handlers in `app/api/**`. Each handler creates the cookie-based server client, rejects requests without a user (401), validates input with `lib/bookmarks.ts` or `lib/learning-paths.ts`, runs the query, and returns the `{ data, error }` envelope from `lib/api-response.ts`. The Learning Paths pages and (after PR #16) the bookmark dashboard are client components that call these routes with `fetch`.
- **Authorization** is enforced twice: handlers filter by `user.id`, and PostgreSQL Row Level Security restricts every table to `auth.uid() = user_id` (§4.3). The server uses only the publishable key; no service-role key exists in the app.
- **Session transport** is cookies only. The server reads the session from cookies through `@supabase/ssr`; no route reads an `Authorization: Bearer` header.

### 1.2 Bookmark operation example

```mermaid
sequenceDiagram
    actor User
    participant WS as BookmarkWorkspace (browser)
    participant DC as Dashboard client wrapper (PR pending)
    participant API as POST /api/bookmarks
    participant DB as Supabase PostgreSQL

    User->>WS: Fill form, click Save
    WS->>WS: validateBookmarkForm (reuses lib/bookmarks.ts rules)
    WS->>DC: onCreate(input)
    DC->>API: fetch with session cookie
    API->>API: getUser, validate again on the server
    API->>DB: insert with user_id = signed-in user
    DB-->>API: row (RLS WITH CHECK auth.uid() = user_id)
    API-->>DC: 201 { data, error: null }
    DC->>API: GET /api/bookmarks (refresh)
    DC-->>WS: resolve, new bookmarks prop
    WS-->>User: Close dialog, show new card
```

If any step fails, the wrapper throws, `onCreate` rejects, and the workspace keeps the dialog open with an error message.

## 2. CI/CD and deployment

```mermaid
flowchart LR
    Branch["Feature branch"] -->|"push (main, feat/*, chore/*, fix/*)<br/>or PR to main"| CI["GitHub Actions: ci.yml<br/>npm ci, lint, type-check,<br/>test:coverage, build"]
    Branch -->|"PR to main"| Security["security.yml + Dependabot<br/>npm audit (PR pending)"]
    Branch -->|"PR"| Preview["Vercel preview deployment"]
    CI --> Review["Partner review"]
    Review -->|"merge"| Main["main"]
    Main -->|"Vercel GitHub integration"| Prod["Production<br/>linkshelf-p2.vercel.app"]
```

- `ci.yml` builds with placeholder Supabase variables, so CI never needs real secrets.
- Playwright E2E tests (`e2e/`) are not part of `ci.yml`; they run locally with `npm run test:e2e` against `npm run start` on port 3001 and need test-account credentials.
- GitHub Actions runs are currently blocked by a billing lock on the repository owner's account; checks have been run locally instead.

## 3. Database ERD

```mermaid
erDiagram
    auth_users ||--o{ bookmarks : "owns"
    auth_users ||--o{ learning_paths : "owns"
    auth_users ||--o{ learning_path_items : "owns"
    learning_paths ||--o{ learning_path_items : "contains"
    bookmarks ||--o{ learning_path_items : "is a step in"

    auth_users {
        uuid id PK "managed by Supabase Auth"
    }

    bookmarks {
        uuid id PK "default gen_random_uuid()"
        uuid user_id FK "auth.users.id, on delete cascade"
        text title "not null, trimmed length 1 to 255"
        text url "not null, must match ^https?://"
        text_array tags "text[], not null, default empty"
        timestamptz created_at "not null, default now (UTC)"
        timestamptz updated_at "not null, set by trigger"
        timestamptz deleted_at "null = active, set = soft-deleted"
    }

    learning_paths {
        uuid id PK "default gen_random_uuid()"
        uuid user_id FK "auth.users.id, on delete cascade"
        text title "not null, trimmed length 1 to 255"
        text description "not null, default empty, max 2000"
        timestamptz created_at "not null, default now (UTC)"
        timestamptz updated_at "not null, set by trigger"
    }

    learning_path_items {
        uuid id PK "default gen_random_uuid()"
        uuid learning_path_id FK, UK "learning_paths.id, on delete cascade"
        uuid bookmark_id FK, UK "bookmarks.id, on delete cascade"
        uuid user_id FK "auth.users.id, on delete cascade"
        integer position "not null, default 0, check >= 0"
        boolean is_completed "not null, default false"
        timestamptz completed_at "nullable"
        timestamptz created_at "not null, default now (UTC)"
        timestamptz updated_at "not null, set by trigger"
    }
```

`auth.users` is Supabase's built-in table (shown as `auth_users` because Mermaid entity names cannot contain dots). Only its `id` is referenced by this project, so no other columns are shown.

### 3.1 Relationships and constraints

| Relationship / constraint | Definition | Effect |
|---|---|---|
| `bookmarks.user_id → auth.users.id` | FK, `ON DELETE CASCADE` | A user's bookmarks are removed if the auth user is deleted. |
| `learning_paths.user_id → auth.users.id` | FK, `ON DELETE CASCADE` | Same for learning paths. |
| `learning_path_items.learning_path_id → learning_paths.id` | FK, `ON DELETE CASCADE` | Deleting a path deletes its items but not the bookmarks. |
| `learning_path_items.bookmark_id → bookmarks.id` | FK, `ON DELETE CASCADE` | Only applies to physical deletes; clients can only soft-delete bookmarks. |
| `learning_path_items.user_id → auth.users.id` | FK, `ON DELETE CASCADE` | Stored on each item so RLS can check ownership directly. |
| `learning_path_items_unique_bookmark` | `UNIQUE (learning_path_id, bookmark_id)` | A bookmark appears at most once per path (API returns 409). |
| `bookmarks_title_not_empty`, `bookmarks_title_max_length` | `CHECK` | Title is 1–255 characters after trimming. |
| `bookmarks_url_valid_protocol` | `CHECK (url ~* '^https?://')` | Rejects `javascript:`, `data:`, and other schemes at the database level. |
| `learning_paths_*` checks | `CHECK` | Title 1–255 characters; description at most 2000. |
| `learning_path_items_position_non_negative` | `CHECK (position >= 0)` | Positions are 0-based. |

### 3.2 Indexes and triggers

| Table | Indexes | Trigger |
|---|---|---|
| `bookmarks` | `user_id`; `(user_id, created_at DESC) WHERE deleted_at IS NULL`; `(user_id, deleted_at) WHERE deleted_at IS NOT NULL`; GIN on `tags`; `(user_id, lower(title))` | `set_updated_at` before update |
| `learning_paths` | `user_id`; `(user_id, created_at DESC)` | `set_updated_at` before update |
| `learning_path_items` | `(learning_path_id, position)`; `bookmark_id`; `user_id` | `set_updated_at` before update |

## 4. Access control

### 4.1 Table privileges for the `authenticated` role (final state after migration 002)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `bookmarks` | yes | yes | yes (all columns) | **no**: soft delete via `deleted_at` only |
| `learning_paths` | yes | yes | `title`, `description` only | yes |
| `learning_path_items` | yes | yes | `position`, `is_completed`, `completed_at` only | yes |

All privileges are revoked from `anon`.

### 4.2 Soft delete

Single delete (`DELETE /api/bookmarks/[id]`) and bulk delete both set `deleted_at`; bulk restore sets it back to `NULL`, which powers Undo. Because the `authenticated` role has no `DELETE` privilege on `bookmarks`, physical deletion is impossible from the app.

### 4.3 Row Level Security policies

| Table | Policy checks |
|---|---|
| `bookmarks` | SELECT, INSERT, UPDATE: `auth.uid() = user_id` (UPDATE also in `WITH CHECK`, so ownership can't be transferred). No DELETE policy. |
| `learning_paths` | SELECT, INSERT, UPDATE, DELETE: `auth.uid() = user_id`. |
| `learning_path_items` | SELECT, DELETE: `auth.uid() = user_id`. INSERT: the caller owns the item, the target path, and the bookmark, and the bookmark is not soft-deleted. UPDATE: the caller still owns the item, path, and bookmark; soft-deleted bookmarks are allowed so completion can still be toggled. |

## 5. Sources checked

- `supabase/migrations/001_create_bookmarks.sql`, `supabase/migrations/002_create_learning_paths.sql`
- `proxy.ts`, `lib/supabase/proxy.ts`, `lib/supabase/server.ts`
- `app/auth/actions.ts`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`
- `app/dashboard/page.tsx`, `app/learning-paths/page.tsx`, `app/learning-paths/[id]/page.tsx`, `app/api/bookmarks/[id]/route.ts`
- `.github/workflows/ci.yml`, `playwright.config.ts`
- Open PRs referenced: #16 (dashboard integration), #18 (security scanning)

Not covered here: Vercel and Supabase dashboard settings, which live outside the repository (see `docs/DEPLOYMENT.md`).
