# LinkShelf — Product Requirements Document

## Overview

Useful links often end up scattered across browser bookmarks, notes, and messages. LinkShelf gives people one place to save, organize, and find them.

**Target users:** Students, researchers, and anyone who saves online resources regularly.

## Features

### 1. Accounts (Issue #2)
Users can create an account and sign in to access their own bookmarks.

**Acceptance criteria**
- Sign up, sign in, and sign out with email and password.
- Show a clear message when login fails.
- Redirect signed-out users to the login page.
- Keep each user's bookmarks private.

### 2. Bookmark management (Issues #3, #4, #5)
Users can add, view, edit, and delete bookmarks.

**Acceptance criteria**
- Add a bookmark with a title and a valid `http://` or `https://` URL.
- Show saved bookmarks with clickable links.
- Edit a bookmark's title or URL.
- Ask for confirmation before deleting a bookmark.
- Show a helpful message when the list is empty or an input is invalid.

### 3. Tags (Issue #6)
Users can add or remove tags to group related links.

**Acceptance criteria**
- Add and remove text tags on a bookmark.
- Save tags and show them in the bookmark list.

### 4. Search and filter (Issue #7)
Users can find bookmarks by title or tag.

**Acceptance criteria**
- Search titles without case sensitivity.
- Filter by a selected tag.
- Update results when the search or filter changes.
- Show a message when nothing matches.

### 5. Bulk actions (Issue #8)
Users can select several bookmarks, delete them together, and undo the last bulk deletion.

**Acceptance criteria**
- Select multiple bookmarks and see how many are selected.
- Delete selected bookmarks in one action.
- Restore the last deleted batch with Undo.
- Keep selections and results up to date after each action.

### 6. REST API (Issue #10)
Provide documented endpoints for bookmark operations.

**Acceptance criteria**
- Document endpoints and sample requests in `docs/API.md`.
- Require authentication for personal bookmark data.
- Return clear errors for invalid or unauthorized requests.

## Pages and user flows

**Design reference:** `docs/mockup.html`.

- **Login page:** Email and password fields, sign-in and sign-up buttons, error messages.
- **Dashboard:** Bookmark list, search field, tag filter, add button, selection checkboxes, and bulk-delete action.
- **Add/Edit form:** Title, URL, tags, Save, and Cancel.
- **Delete and Undo:** Confirmation for single deletes; an Undo message after bulk deletion.

**Main flow:** Sign in → open dashboard → add a bookmark → find it with search or tags → edit or delete it.

**Bulk flow:** Select bookmarks → delete selected → click Undo to restore them.

## Technology

- **Frontend and API:** Next.js (App Router), TypeScript, Tailwind CSS, Next.js Route Handlers.
- **Database and login:** Supabase PostgreSQL and Supabase Auth.
- **Testing:** Vitest for unit tests; Playwright for the main user flow.
- **CI and deployment:** GitHub Actions and Vercel.

Each bookmark stores `id`, `user_id`, `title`, `url`, `tags`, `created_at`, `updated_at`, and an optional `deleted_at` value for Undo. Supabase Row Level Security and server-side checks prevent users from accessing someone else's bookmarks.

## Development plan

- **Sprint 1:** Project setup (#1), login (#2), add bookmarks (#3), display bookmarks (#4), edit and delete (#5).
- **Sprint 2:** Tags (#6), search and filter (#7), bulk actions (#8), tests (#9), API documentation and deployment (#10).

The app should work on desktop and mobile. Forms need clear labels and error messages, and buttons should be usable with a keyboard. Secrets belong in environment variables, not in GitHub.

Browser extensions, automatic link scraping, real-time collaboration, and paid integrations are not part of this project.
