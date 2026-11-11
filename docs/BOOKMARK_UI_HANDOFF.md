# Bookmark UI — Handoff to Developer A

**Author:** Developer B · **Branch:** `feature/6-8-bookmark-ui` · **Refs:** #3, #4, #5, #6, #7, #8 (tests toward #9)

This branch adds a backend-agnostic bookmark workspace UI. It renders the dashboard contents (search, tag filter, card grid, add/edit dialog, delete confirmation, bulk delete, one-step Undo) and reports every change through callback props. It does not call the API, import Supabase, read env vars, or depend on a session. Persistence and production wiring remain A-owned.

## 1. Files added (B-owned paths only)

```text
features/bookmark-ui/
  index.ts                    public exports
  types.ts                    locked UI contract (handoff §9.1, unchanged)
  validation.ts               form validation; reuses lib/bookmarks.ts rules
  selectors.ts                pure search / tag filter / empty-state / selection helpers
  BookmarkWorkspace.tsx       main component ("use client")
  BookmarkCard.tsx
  BookmarkFormModal.tsx       shared Add / Edit dialog
  DeleteConfirmDialog.tsx     shared single / bulk confirmation
  Dialog.tsx                  accessible modal shell (focus, Tab trap, Escape)
  TagFilter.tsx
  BulkActionBar.tsx           selection bar + UndoNotice
  __tests__/                  5 test files, 70 tests
app/bookmark-ui-preview/page.tsx   temporary mock-data preview
docs/BOOKMARK_UI_HANDOFF.md        this file
```

No A-owned file was edited: no changes to `app/dashboard`, `app/page.tsx`, `lib/**`, `types/**`, API routes, Supabase files, `package.json`, the lockfile, root configs, `.github/**`, or `AGENTS.md`. `SearchBar.tsx` from the original handoff tree was folded into `BookmarkWorkspace.tsx` (it was a single input), and `Dialog.tsx` was added to share modal behavior.

## 2. Public API

```ts
import { BookmarkWorkspace } from "@/features/bookmark-ui";
import type { BookmarkInput, BookmarkRecord, BookmarkWorkspaceProps } from "@/features/bookmark-ui";
```

`BookmarkWorkspaceProps` is exactly the contract from handoff §9.1:

| Prop | Type | Notes |
|---|---|---|
| `bookmarks` | `BookmarkRecord[]` | Canonical data, camelCase, owned by the parent. Treated as immutable. |
| `isLoading?` | `boolean` | Shows "Loading bookmarks…" only when `bookmarks` is empty. |
| `errorMessage?` | `string \| null` | Shown as an alert banner; suppresses the empty state. |
| `onCreate` | `(input) => Promise<void>` | Called once per Save; resolve only after the API accepted it. |
| `onUpdate` | `(id, input) => Promise<void>` | Full `{ title, url, tags }` is always sent (valid for the PATCH route). |
| `onDelete` | `(id) => Promise<void>` | Single delete. UI copy says "permanently deleted" to match `DELETE /api/bookmarks/:id`. |
| `onBulkDelete` | `(ids) => Promise<void>` | One call per confirmed bulk delete. |
| `onRestore` | `(ids) => Promise<void>` | Undo; receives exactly the IDs of the last successful bulk delete. |

Every callback must **reject** on failure (e.g. throw on a non-2xx response). On rejection the UI keeps the dialog open / keeps the selection / keeps Undo available and shows an error; it never shows success first. After a callback resolves, the parent should refresh `bookmarks`; the UI does not insert or remove records itself.

## 3. Behavior decisions (please review)

1. **Validation reuses `lib/bookmarks.ts`** (`validateTitle`, `validateUrl`, `normalizeTags`), so the form shows the same messages and limits as the server: title required and ≤ 255 chars, `http:`/`https:` only, tags trimmed, lowercased, and de-duplicated. The original handoff said to keep the first-typed tag casing; this was changed to lowercase to match the API (`docs/API_CONTRACT.md`) and avoid tags changing case after a reload.
2. **Bulk limit:** more than 100 selected disables Delete Selected with a message, matching `validateBulkInput`.
3. **Tags input:** comma-separated text field (smallest testable option). Removing a tag = deleting it from the text.
4. **Selection:** cleared whenever the search text or tag filter changes; only visible bookmarks count as selected; IDs that disappear from `bookmarks` are dropped automatically.
5. **Undo:** shown after a successful bulk delete until Undo succeeds, the user dismisses it, or a newer bulk delete replaces it. No timer and no multi-level history. Not preserved across reloads.
6. **No page header** inside the workspace — `app/dashboard/page.tsx` already renders LinkShelf, the user email, and Sign Out.
7. The Add/Edit dialog includes a Tags field although `LinkShelf_AddBookmark.png` shows only Title and URL; the PRD lists tags in the form.

## 4. What A needs to do before merging

**CI will fail on this branch until steps 1–2 are done**, because `tsc --noEmit` type-checks the `.tsx` tests, which import Testing Library.

1. Add dev dependencies (versions B ran with):
   ```bash
   npm install -D jsdom@^29.1.1 @testing-library/react@^16.3.3 @testing-library/dom@^10.4.2 @testing-library/user-event@^14.6.9
   ```
2. In `vitest.config.mts`, extend `test.include` so `npm test` runs B's tests:
   ```ts
   include: ["__tests__/**/*.test.ts", "features/**/*.test.{ts,tsx}"],
   ```
   Keep `environment: "node"`: each `.tsx` test opts into jsdom with a `// @vitest-environment jsdom` comment, and each calls `cleanup` explicitly. Optionally add `"features/**/*.{ts,tsx}"` to `coverage.include`.
3. Mount the workspace in the dashboard through a small A-owned client component (sketch in §5).
4. Remove `app/bookmark-ui-preview/` or keep it out of production. It contains only mock data and makes no requests, but it is a public demo page.

## 5. Integration sketch (A-owned, untested)

`app/dashboard/page.tsx` is a server component, so wrap the workspace in a client component and render `<BookmarkDashboardClient />` inside its `<main>`. This is an outline built on `types/bookmark.ts` and `docs/API_CONTRACT.md`, not compiled code.

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { BookmarkWorkspace, type BookmarkInput, type BookmarkRecord } from "@/features/bookmark-ui";
import type { ApiResult, Bookmark, BookmarkListPayload } from "@/types/bookmark";

const toRecord = (b: Bookmark): BookmarkRecord => ({
  id: b.id, title: b.title, url: b.url, tags: b.tags,
  createdAt: b.created_at, updatedAt: b.updated_at,
});

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
  if (!res.ok || !json || json.error !== null) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data;
}

export function BookmarkDashboardClient() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<BookmarkListPayload>("/api/bookmarks");
      setBookmarks(data.bookmarks.map(toRecord));
      setLoadError(null);
    } catch {
      setLoadError("Could not load bookmarks.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <BookmarkWorkspace
      bookmarks={bookmarks}
      isLoading={isLoading}
      errorMessage={loadError}
      onCreate={async (input: BookmarkInput) => { await api("/api/bookmarks", "POST", input); await refresh(); }}
      onUpdate={async (id, input) => { await api(`/api/bookmarks/${id}`, "PATCH", input); await refresh(); }}
      onDelete={async (id) => { await api(`/api/bookmarks/${id}`, "DELETE"); await refresh(); }}
      onBulkDelete={async (ids) => { await api("/api/bookmarks/bulk-delete", "POST", { ids }); await refresh(); }}
      onRestore={async (ids) => { await api("/api/bookmarks/bulk-restore", "POST", { ids }); await refresh(); }}
    />
  );
}
```

## 6. Verification actually run (macOS, Node 24.14.0, npm 11.9.0)

| Check | Command | Result |
|---|---|---|
| B module tests | `npx vitest run --config <local config>` | **70 passed** (5 files: validation 21, selectors 14, BookmarkCard 5, BookmarkFormModal 7, BookmarkWorkspace 23) |
| Lint | `npm run lint` | passed, no output |
| Type-check | `npm run type-check` | passed — with the test packages installed locally via `npm install --no-save` |
| A's tests | `npm test` | 144 passed (unchanged; it does not include `features/**` yet) |
| Build | `npm run build` | passed; `/bookmark-ui-preview` listed as a static route |
| Manual | `npm run dev` → `/bookmark-ui-preview` | add, validation errors, edit, single delete, search, tag filter, bulk delete, Undo, and simulated failures checked in the browser; screenshots in the PR |

The local Vitest config only widened `include`; it was never committed (`.git/info/exclude`).

**Not verified by B:** real API/Supabase calls, auth, RLS, persistence after reload, Playwright E2E, and CI on GitHub (expected to fail until §4 steps 1–2).

## 7. Preview

```bash
npm run dev
# open http://localhost:3000/bookmark-ui-preview
```

Six mock bookmarks, about 400 ms simulated latency, and a **Simulate failures** checkbox that makes every callback reject. No env vars needed; the proxy passes this route through.

## 8. Known limitations

- Tag editing is a comma-separated text field, not chip-style add/remove buttons.
- Search and filter run client-side on the loaded list (the API's `q`/`tag` params are unused).
- Selection is cleared on every search keystroke; this is the documented, tested rule.
- Undo is UI-session scoped.
- Error copy is generic; server error messages are not shown in the dialog.

## 9. Remaining A-owned work

Merge and review; test dependencies and Vitest include (§4); dashboard wiring (§5); persistence and ownership verification after reload; preview route removal; Playwright E2E; CI; Vercel deployment; moving #3–#8 to Done once production acceptance criteria pass.
