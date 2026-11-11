# LinkShelf — Sprint Documentation

This record is built from the repository's GitHub milestones, Issues #1–#10, pull requests, reviews, and commit history. It reports what actually happened, including what was late or missing. Standups, estimates, and TDD steps that were not recorded at the time are **not** reconstructed.

Data snapshot: 2026-11-10, about 22:00 PT. Times below are Pacific Time. **Update §2.3, §5, and §6 before final submission.**

## 1. Team, roles, and process

| Developer | GitHub | Role |
|---|---|---|
| Developer A — Sijia Chen | `Sijia711` (repo owner) | Project setup, database and RLS, auth, REST API, Learning Paths, Playwright E2E, test infrastructure, CI/CD and security scanning, OpenAPI, README and deployment, dashboard API integration |
| Developer B — Haoran Lyu | `CharlieRK` | Bookmark workspace UI module (`features/bookmark-ui`) and its tests, AGENTS.md frontend rules, architecture and ERD diagrams, sprint documentation |

**Workflow.** Issues with acceptance criteria are tracked on the **LinkShelf P2 Scrum** board (Backlog → Sprint Todo → In Progress → In Review → Done) and grouped into milestones **Sprint 1** and **Sprint 2**. Work happens on one branch per task and reaches `main` through pull requests.

**What the process did and did not include (honest summary).**
- **Planning.** Developer A created Issues #1–#10 with acceptance criteria and both milestones on 2026-10-30, before Developer B was involved. Developer B received a written handoff (dated 2026-11-05) defining an isolated UI module and started implementation on 2026-11-10. The remaining Sprint 2 work was planned jointly on 2026-11-10 (task split and PR/review plan).
- **Estimation.** No estimates were recorded on Issues #1–#10.
- **Standups.** No written standups exist for Sprint 1. Written standups start on 2026-11-10 (§5).
- **Reviews.** PRs #11–#13 were merged by Developer A without a partner review. From PR #14 on, every PR is reviewed by the other developer (§6.2).
- **TDD.** Tests exist for validation, API routes, auth, the proxy, learning paths, and the bookmark UI, but the git history does not consistently show failing tests committed before implementation.

## 2. Sprints

### 2.1 Sprint 1 — milestone due 2026-11-06

**Goal:** project setup, authentication, and core bookmark CRUD (Issues #1–#5).

| Issue | Title | What was delivered | Status at snapshot |
|---|---|---|---|
| #1 | Set up Next.js project and Supabase | Next.js starter (2026-10-30, `fa2e1e5`); backend foundation, Supabase schema and RLS (2026-11-09, `f8550da`, `20962db`); merged in PR #11 | Open |
| #2 | Implement user registration and login | Supabase Auth sign-up/sign-in/sign-out, protected routes via `proxy.ts` (2026-11-09, `20962db`); merged in PR #11 | Open |
| #3 | Implement add bookmark feature | API: `POST /api/bookmarks` (PR #11). UI: add dialog with validation (PR #14, Sprint 2) | Open |
| #4 | Display saved bookmarks | API: `GET /api/bookmarks` (PR #11). UI: card grid and empty state (PR #14) | Open |
| #5 | Implement edit and delete bookmark features | API: `PATCH`/`DELETE /api/bookmarks/[id]`, soft delete (PR #11). UI: edit dialog and delete confirmation (PR #14) | Open |

**Sprint review.** The Sprint 1 goal was not met by the due date. The backend for #1–#5 was committed on 2026-11-09 and merged on 2026-11-10 (PR #11), after the milestone date. The bookmark UI for #3–#5 moved into Sprint 2. None of #1–#5 has been closed, because the UI is not yet merged and production acceptance has not been checked.

### 2.2 Sprint 2 — milestone due 2026-11-13

**Goal:** tags, search/filter, bulk actions with Undo, automated tests, API docs and CI/CD (Issues #6–#10), plus the Sprint 1 UI carried over.

| Issue | Title | Delivered in | Status at snapshot |
|---|---|---|---|
| #6 | Implement bookmark tags | Tags in API and schema (PR #11); tag input, chips, and tag filter in UI (PR #14) | Open |
| #7 | Implement bookmark search and filtering | Title search and tag filter (PR #14); API also supports `q`/`tag` (PR #11) | Open |
| #8 | Implement bulk bookmark management | `bulk-delete`/`bulk-restore` API (PR #11); multi-select, bulk delete, one-step Undo UI (PR #14) | Open |
| #9 | Add automated tests | Vitest unit/integration tests (PR #11, #12); Playwright E2E (PR #13); 70 bookmark UI tests (PR #14); component test setup (PR #15) | Open |
| #10 | Add API documentation and CI/CD | `ci.yml` (PR #11) and `docs/API.md` (PR #11–#12); OpenAPI (PR #17); security scanning (PR #18); README and deployment guide (PR #19) | Open |

**Work outside the original backlog.** The Learning Paths feature (PR #12) was added without its own Issue, although `AGENTS.md` asks for an Issue per feature. It supports the course requirement of three or more distinct features.

### 2.3 Pull requests

| PR | Title | Author | Partner review | State at snapshot | Issues |
|---|---|---|---|---|---|
| #11 | Supabase backend, auth and bookmark API | A | none | Merged 2026-11-10 | #1–#8, #10 |
| #12 | Learning paths with progress tracking | A | none | Merged 2026-11-10 | — |
| #13 | Playwright E2E for auth and learning paths | A | none | Merged 2026-11-10 | #9 |
| #14 | Bookmark workspace, tags, search, bulk actions | B | Approved by A | Open | #3–#8, #9 |
| #15 | Vitest configuration for React component tests | A | Approved by B | Open | #9 |
| #16 | Bookmark dashboard integrated with the API | A | Approved by B, with requested rebase | Open | #3–#8 |
| #17 | OpenAPI specification | A | Approved by B, with requested fixes | Open | #10 |
| #18 | Automated security scanning | A | Approved by B | Open | #10 |
| #19 | README and deployment guide | A | Approved by B, with requested fixes | Open | #10 |
| #20 | AGENTS.md frontend, testing, and PR rules | B | Requested | Open | — |
| #21 | Architecture and database ERD | B | Requested | Open | — |

Planned merge order for dependent PRs: #15 → #14 → #16 (rebased onto `main`).

## 3. Problems and solutions

| Problem | What we did |
|---|---|
| Developer B started late, while backend work was already in progress. | Defined a backend-agnostic UI module with a fixed props/callback contract and a written handoff, so UI and backend could be built in parallel and joined in one integration PR (#16). |
| Docs disagreed with code: `docs/API_CONTRACT.md` called single DELETE permanent and draft docs described Bearer-token auth, but the route soft-deletes and the server reads cookies only. | Checked the route handlers, corrected the UI copy (`cb68d9d` in PR #14), requested fixes in #17 and #19, and added a rule to `AGENTS.md` to check route code before documenting API behavior (PR #20). |
| Component tests needed jsdom and Testing Library, which weren't installed. | B ran the 70 tests locally with `npm install --no-save` and an uncommitted config; A then added the dependencies and Vitest include (PR #15). The combined suite was verified at 214 passing tests. |
| PR #16 contained copies of the files from PR #14 and #15, which would credit that code to the wrong commit. | Agreed merge order #15 → #14 → rebase #16; added a "don't copy files from another open PR" rule (PR #20). |
| GitHub Actions runs are blocked by a billing lock on the owner account. | Ran lint, type-check, tests, and build locally and reported results in each PR; A is handling it with GitHub Support. |
| Switching branches left stale `.next/types`, causing false type-check errors. | `rm -rf .next` before checks; documented in `AGENTS.md` §7.1. |
| Early PRs were merged without review. | Every PR from #14 on is reviewed by the partner, who runs the checks locally before approving. |

## 4. Retrospective

> Draft based on the records above. **Both developers must confirm or edit this section.**

**What went well**
- The isolated UI contract let the UI be built and tested without a running backend, and the integration PR only needed a thin wrapper.
- Reviews from PR #14 on were substantive: each reviewer ran the checks locally and caught real problems (stale docs, unsupported Bearer auth, duplicated files).
- Strong defense in depth in the database: RLS on every table, no client DELETE on bookmarks, and CHECK constraints that mirror server validation.

**What to improve**
- Start partner work and reviews earlier; Sprint 1 slipped past its due date.
- Record standups and estimates as we go.
- Commit failing tests before implementation so TDD is visible in the history.
- Keep `docs/API_CONTRACT.md`, `docs/API.md`, and `docs/openapi.yaml` in sync with the route code.

**Action items**
- [ ] Merge in the agreed order (#15 → #14 → #16) and verify the dashboard end to end in production.
- [ ] Close Issues #1–#10 only after their acceptance criteria are checked on the merged code.
- [ ] Post a written standup each working day until submission.
- [ ] Use failing-test-first commits for any remaining feature work.

## 5. Standups

### Sprint 1

No written standups were recorded.

### Sprint 2

**2026-11-10 — Haoran (Developer B)**
- Done: opened PR #14 (bookmark workspace UI with 70 tests) and corrected its delete copy; reviewed and locally verified #15, #16, #17, #18, #19; opened #20 (AGENTS.md rules) and #21 (architecture and ERD).
- Next: sprint documentation; UI polish and additional component tests using failing-test-first commits.
- Blockers: GitHub Actions blocked by the billing lock.

**2026-11-10 — Sijia (Developer A)**
- TODO (Sijia): add today's standup.

## 6. Partner feedback and contributions

### 6.1 Partner feedback

- **Haoran → Sijia:** TODO (Haoran)
- **Sijia → Haoran:** TODO (Sijia)

### 6.2 Contribution log (snapshot)

| | Developer A (Sijia) | Developer B (Haoran) |
|---|---|---|
| PRs authored | #11, #12, #13, #15, #16, #17, #18, #19 | #14, #20, #21 |
| Partner reviews given | #14 | #15, #16, #17, #18, #19 |
| Main areas | Setup, database and RLS, auth, REST API, Learning Paths, E2E, CI/CD, OpenAPI, README/deployment, dashboard integration | Bookmark workspace UI and tests, AGENTS.md frontend rules, architecture/ERD, sprint documentation |

Commit history: `git log --format='%h %ad %an %s' --date=short`.
