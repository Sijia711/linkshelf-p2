# LinkShelf — AI Development Rules

These instructions apply to the entire repository. Read this file, `LinkShelf_PRD.md`, and the design references before changing code. Keep changes small and tied to a GitHub Issue.

## 1. Product and scope

LinkShelf is a small web app for saving and organizing bookmarks. Users can sign up, sign in, add/edit/delete their own bookmarks, tag them, search/filter them, and bulk-delete with a one-step undo. An authenticated REST API supports bookmark management.

**In scope:** GitHub Issues #1–#10. **Out of scope:** AI features, webpage scraping, browser extensions, real-time collaboration, payments, and a separate backend service. Do not add features without an Issue.

## 2. Stack and versions

Use these planned major versions (record exact installed versions in `package.json` and commit the lockfile):

- Node.js 24 LTS; npm
- Next.js 16.4.x (App Router) and React 19.x
- TypeScript 5.x with strict type checking
- Tailwind CSS 4.x
- Supabase PostgreSQL + Supabase Auth (JWT); `@supabase/supabase-js` 2.x and `@supabase/ssr` for cookie-based authentication
- Vitest 5.x for unit/integration tests; Playwright 1.x for a small number of E2E tests
- GitHub Actions for CI; Vercel for deployment

Use a single Next.js codebase with Route Handlers. Do **not** add Express, Prisma, Redux, WebSockets, or other dependencies without a clear need and an Issue.

## 3. Project references (read first)

- Product requirements and acceptance criteria: [`LinkShelf_PRD.md`](./LinkShelf_PRD.md)
- Dashboard mockup: [`LinkShelf_Dashboard.png`](./LinkShelf_Dashboard.png)
- Add-bookmark modal mockup: [`LinkShelf_AddBookmark.png`](./LinkShelf_AddBookmark.png)
- Interactive prototype: https://claude.ai/artifact/TXT6Hbmupq57UNwnZVyKKG
- Issue backlog: https://github.com/Sijia711/linkshelf-p2/issues
- Scrum board: see **LinkShelf P2 Scrum** in the repository's GitHub Projects

Follow the PRD for feature behavior and the mockups for layout. If they conflict, describe the mismatch in the PR before making a choice. Do not invent extra product requirements.

### UI and user flows

- **Dashboard:** white/light gray layout, LinkShelf header, search input, tag filter chips, Add Bookmark button, bookmark cards in a responsive grid.
- **Bookmark card:** checkbox, title, URL, tags, Edit and Delete actions. A URL opens the saved site in a new tab with safe link attributes.
- **Add:** click Add Bookmark -> open modal -> enter title and valid `http:`/`https:` URL -> Save -> display the new card, or show an inline validation error. Cancel closes without saving.
- **Edit:** open a pre-filled form -> change title/URL -> Save -> update the card.
- **Delete:** ask for confirmation before deleting one bookmark.
- **Search/filter:** search by title and filter by tag; show a clear empty/no-results state.
- **Bulk actions:** select multiple cards -> show bulk action bar -> confirm bulk delete -> show Undo for the most recent bulk deletion. Use a `deleted_at` field (soft delete) so Undo restores the records. Do not build a full undo-history system.
- **Auth:** logged-out users go to sign-in; users may only see and edit their own records.

## 4. Architecture (target layout)

This is the intended layout, not a claim that these files already exist. Create files only when the relevant Issue requires them.

```text
app/
  page.tsx                  # dashboard
  login/page.tsx            # sign-in / registration
  api/bookmarks/route.ts    # list / create
  api/bookmarks/[id]/route.ts # update / delete
components/                # reusable UI (BookmarkCard, BookmarkForm, filters)
lib/
  supabase/client.ts        # browser client
  supabase/server.ts        # server client
  bookmarks.ts              # validation and pure helpers
supabase/migrations/        # schema and RLS policies
__tests__/                  # Vitest tests
e2e/                      # Playwright tests (at repository root)
docs/API.md                 # REST endpoint documentation
.github/workflows/          # CI
```

Keep business logic out of UI components when practical. Use Route Handlers for REST operations. Use Supabase Auth instead of building custom JWT issuance. A minimal `bookmarks` table can hold `id`, `user_id`, `title`, `url`, `tags` (text array), `created_at`, `updated_at`, and nullable `deleted_at`. Avoid extra tables until needed.

## 5. Coding conventions

- TypeScript: use explicit types for API payloads and data models; avoid `any`.
- React: PascalCase components (`BookmarkCard.tsx`); camelCase functions/variables (`addBookmark`); kebab-case route folders and branch descriptions.
- Keep components focused and small; reuse styles/components rather than duplicating forms.
- Use async/await, clear error handling, and small, reviewable changes.
- Add loading, empty, success, and error states for user-facing operations.
- Meet basic accessibility needs: semantic buttons, accessible form labels, keyboard-operable modals, visible focus states, and confirmation for destructive actions.
- Do not refactor unrelated files to implement a feature.

## 6. Security and data handling

- Never commit `.env.local`, API secrets, or service-role keys. Commit only `.env.example` with placeholders.
- Use the Supabase publishable/anon key on the client; never expose service-role credentials.
- Enable Row Level Security (RLS) on user data. Policies must restrict reads and writes to `auth.uid() = user_id`.
- Validate required fields and URL protocols on the server, even if the form validates them in the browser. Reject `javascript:` and other non-HTTP(S) links.
- Validate the authenticated user in API handlers; return appropriate 401/403/400/404 responses. Never trust user-submitted `user_id`.
- Avoid exposing another user's data through search, bulk operations, or Undo.

## 7. Testing and quality

- Prefer test-first or a red/green/refactor loop for helpers and API logic.
- Use Vitest for URL validation, bookmark transformations, and key API behavior (including missing auth and unauthorized access). Mock external Supabase calls in unit tests.
- Use Playwright for at least one core flow such as sign in -> add bookmark -> view it. Use test accounts and disposable data.
- Target at least 80% coverage for pure validation/business helpers; report actual results rather than claiming coverage without a run.
- Before a PR, run the available commands for lint, type-check, tests, and build. If setup is incomplete, say which commands could not yet run.
- Do not write fake tests, skip failing tests without explanation, or claim unverified passes.

## 8. Scrum and GitHub workflow

- Sprint 1: Milestone **Sprint 1** (due Nov 6, 2026), Issues #1–#5. Start in **Sprint Todo**.
- Sprint 2: Milestone **Sprint 2** (due Nov 13, 2026), Issues #6–#10. Start in **Backlog**.
- Board columns: **Backlog -> Sprint Todo -> In Progress -> In Review -> Done**.
- Work on one Issue at a time. Move it to In Progress when starting, In Review when opening a PR, and Done only after merging and checking acceptance criteria.
- Branches: `feature/3-add-bookmark`, `chore/1-project-setup`, `docs/10-api-docs` (type/issue-number-short-description).
- Commits: `feat(bookmarks): add URL validation (#3)`; use `feat`, `fix`, `test`, `docs`, `chore`, or `refactor`.
- PR title: `[#3] Add bookmark form and API`. In the PR body include `Closes #3`, a brief change summary, screenshots for UI changes, and test results.
- Request the teammate's review when a teammate has joined. Until then, leave a clear self-review checklist and note that peer review is pending; never pretend a second person reviewed the PR.
- Mention related issues using `#3` in commits, comments, and PRs. Keep acceptance-criteria checkboxes updated with actual progress.

## 9. AI coding instructions

1. Identify the Issue and read its acceptance criteria, the relevant PRD section, and the relevant mockup.
2. Before coding, outline the smallest set of files to change and how the feature will be tested.
3. Implement only the requested feature using the architecture and conventions above.
4. Add or update useful tests; run checks when available; report results and limitations accurately.
5. Summarize changed files and which acceptance criteria are met, and suggest the matching commit and PR text.
6. If requirements are ambiguous, choose the simplest option consistent with the PRD and mockups; mention the assumption.

## 10. Rules maintenance

Update this file when the actual architecture, dependencies, design, or working agreement changes. After the HW3 without-rules / with-rules experiment, record one concrete change to these rules based on an observed failure or inconsistency; do not claim an improvement unless the comparison supports it.
