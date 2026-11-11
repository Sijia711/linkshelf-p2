# LinkShelf

> A secure, full-stack bookmark manager and learning path curator built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and Supabase PostgreSQL with Row Level Security.

[![Production Deployment](https://img.shields.io/badge/Production-Live-success?style=flat-square)](https://linkshelf-p2.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_Auth-3ecf8e?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-5.1.0-yellow?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.65.0-red?style=flat-square&logo=playwright)](https://playwright.dev/)

---

## 1. Project Overview & Problem Statement

Modern web browsing leads to sprawling, unorganized link hoarding across multiple devices, browser windows, and ephemeral chat channels. Users lose critical technical articles, reference documentation, and guides due to the lack of:
1. Fast, tag-based categorization and instant substring search.
2. Safe batch operations with a reliable single-step **Undo** to recover from accidental deletions.
3. Structured curriculum curation—turning random bookmarks into organized, step-by-step **Learning Paths** with completion tracking.
4. Strict multi-tenant security ensuring complete user privacy and data isolation.

**LinkShelf** solves these problems with a responsive, modern web application and an authenticated REST API backed by PostgreSQL Row Level Security (RLS).

---

## 2. Main Product Features

- **Authentication & Multi-Tenant Security:**
  - Secure email-and-password sign up and sign in using Supabase Auth.
  - HTTP-only cookie session management powered by `@supabase/ssr` with PKCE callback exchange.
  - Defense-in-depth: PostgreSQL Row Level Security (RLS) ensures users can access, query, modify, or delete *only their own records*.
- **Bookmark Library:**
  - Save links with title validation (1–255 characters) and strict URL protocol enforcement (`http://` and `https://` only; non-HTTP protocols like `javascript:` are blocked).
  - Categorize bookmarks with case-insensitive, deduplicated tags.
  - Search links by title substring and filter by exact tag containment.
- **Safe Soft-Deletion & One-Step Undo:**
  - Single and bulk deletions mark records with `deleted_at = NOW()` rather than destroying them immediately.
  - Single-step bulk restoration (`deleted_at = NULL`) powers an instantaneous **Undo** action.
- **Guided Learning Paths:**
  - Organize bookmarks into sequential, goal-oriented learning curricula.
  - Add bookmarks to paths with duplicate prevention (HTTP 409 Conflict).
  - Track progress with dynamic completion toggles and real-time completion percentage (`0%` to `100%`).
  - Reorder curriculum items sequentially with automatic position re-indexing.
  - Cascade deletion: deleting a learning path safely removes path mappings while preserving the original bookmarks in the user's library.
- **Developer-Friendly REST API:**
  - Fully authenticated endpoints with standardized JSON response envelopes (`{ data, error }`).
  - OpenAPI 3.0.3 specification and formal frontend-backend API contracts.

---

## 3. Tech Stack & Architecture

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.4.3 (App Router) | Server Components, Route Handlers, Turbopack, and Server Actions |
| **UI Library** | React 19.3.0 | Modern declarative component model |
| **Styling** | Tailwind CSS 4.x | Utility-first CSS with modern engine configuration |
| **Language** | TypeScript 5.x | Strict type checking enabled throughout (`noImplicitAny`, strict nulls) |
| **Database** | Supabase PostgreSQL | Relational storage with triggers, indexes, and Row Level Security |
| **Authentication** | Supabase Auth + `@supabase/ssr` | Cookie-based session handling, PKCE verification, and JWT validation |
| **Unit Testing** | Vitest 5.1.0 + v8 Coverage | Fast unit and integration tests with mocked Supabase clients |
| **E2E Testing** | Playwright 1.65.0 | End-to-end browser automation covering login, redirects, and learning paths |
| **Deployment** | Vercel | Production hosting with automated continuous deployment |
| **CI / Security** | GitHub Actions & Dependabot | Automated linting, type-checking, testing, builds, and `npm audit` scanning |

---

## 4. Live Deployment

The production application is continuously deployed on Vercel:
- **Production URL:** [https://linkshelf-p2.vercel.app](https://linkshelf-p2.vercel.app)
- **Deployment Platform:** Vercel (connected to GitHub repository `main` branch)
- **Backend Database:** Supabase Hosted PostgreSQL (AWS us-east-1)

---

## 5. Repository Structure

```text
linkshelf-p2/
├── app/                              # Next.js App Router
│   ├── api/                          # REST Route Handlers
│   │   ├── bookmarks/                # Bookmark collection & search endpoints
│   │   │   ├── [id]/                 # Single bookmark PATCH & DELETE
│   │   │   ├── bulk-delete/          # Bulk soft-delete endpoint
│   │   │   └── bulk-restore/         # Bulk restore (Undo) endpoint
│   │   └── learning-paths/           # Learning path collection endpoints
│   │       └── [id]/                 # Path detail, update, delete
│   │           └── items/            # Path item addition
│   │               └── [itemId]/     # Item completion & reordering
│   ├── auth/                         # Auth route handlers & server actions
│   │   ├── callback/                 # PKCE code exchange handler
│   │   └── signout/                  # Sign-out route handler
│   ├── dashboard/                    # Authenticated dashboard page
│   ├── learning-paths/               # Learning paths UI
│   │   └── [id]/                     # Learning path detail & curriculum view
│   ├── login/                        # Sign-in page
│   ├── signup/                       # Registration page
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Root landing page (redirects to /dashboard or /login)
├── docs/                             # Architecture & Setup Documentation
│   ├── API.md                        # Full REST API endpoint documentation
│   ├── API_CONTRACT.md               # Frontend-backend integration contract
│   ├── AUTH_SETUP.md                 # Supabase authentication dashboard guide
│   ├── DATABASE_SETUP.md             # Migration 001 verification guide
│   ├── DEPLOYMENT.md                 # Step-by-step production deployment guide
│   ├── LEARNING_PATHS_SETUP.md       # Migration 002 verification guide
│   └── openapi.yaml                  # OpenAPI 3.0.3 specification (in PR #17)
├── e2e/                              # Playwright End-to-End Test Suite
│   ├── auth.spec.ts                  # Login, registration, protected redirects, logout
│   └── learning-paths.spec.ts        # Full Learning Paths lifecycle testing
├── lib/                              # Shared Business Logic & Helpers
│   ├── api-response.ts               # Standardized JSON response envelope utilities
│   ├── auth.ts                       # Server-side auth verification helpers
│   ├── bookmarks.ts                  # Pure bookmark validators & URL normalizers
│   ├── learning-paths.ts             # Learning path validation & progress calculation
│   └── supabase/                     # Supabase client factories
│       ├── client.ts                 # Browser client (for Client Components)
│       ├── server.ts                 # Server client (for Server Components & Route Handlers)
│       └── proxy.ts                  # Middleware session refresher
├── supabase/                         # Database Migrations
│   └── migrations/
│       ├── 001_create_bookmarks.sql  # Schema, RLS, indexes, and triggers for bookmarks
│       └── 002_create_learning_paths.sql # Schema, RLS, triggers for learning paths & items
├── types/                            # TypeScript Type Definitions
│   ├── bookmark.ts                   # Bookmark models, inputs, and API responses
│   └── learning-path.ts              # Learning path models, items, and progress types
├── __tests__/                        # Vitest Unit & Integration Test Suite
│   ├── api-bookmarks.test.ts         # Route handler integration tests
│   ├── api-learning-paths.test.ts    # Learning path route handler tests
│   ├── auth.test.ts                  # Authentication helper tests
│   ├── auth-callback.test.ts         # PKCE callback handler tests
│   ├── bookmarks.test.ts             # Bookmark validation logic tests
│   ├── learning-paths.test.ts        # Progress calculation & validation tests
│   ├── proxy.test.ts                 # Middleware session proxy tests
│   └── supabase-clients.test.ts      # Client factory tests
├── .env.example                      # Template for local environment variables
├── package.json                      # Project dependencies and npm scripts
├── playwright.config.ts              # Playwright configuration
├── vitest.config.mts                 # Vitest configuration with v8 coverage
└── README.md                         # Project documentation
```

---

## 6. Team Contributions

Development was executed following a structured Scrum workflow with two developer roles working asynchronously across isolated feature branches and GitHub Pull Requests:

### Developer A (Backend, Infrastructure, Learning Paths & E2E)
- **Architecture & Setup:** Initialized Next.js 16 App Router repository, TypeScript configuration, and Tailwind CSS 4 setup (PR #11).
- **Database Engineering:** Authored and verified Supabase PostgreSQL migrations (`001_create_bookmarks.sql` and `002_create_learning_paths.sql`) with Row Level Security, automatic timestamps triggers, and compound indexes.
- **REST API Route Handlers:** Implemented all 8 route handlers covering Bookmarks, Bulk Soft-Delete/Undo, and Learning Paths with standardized envelope responses (`{ data, error }`).
- **Learning Paths Feature:** Built the complete full-stack Learning Paths feature including database models, validation helpers, API routes, and responsive UI under `/learning-paths` (PR #12).
- **Playwright E2E Suite:** Designed and automated 9 end-to-end browser tests in Playwright verifying public pages, protected redirects, login/logout, and learning path lifecycle (PR #13).
- **Test Infrastructure:** Configured Vitest with jsdom and Testing Library for React component testing (PR #15).
- **API Dashboard Integration:** Connected the Bookmark UI to live Supabase backend route handlers (PR #16).
- **API Specification:** Authored full OpenAPI 3.0.3 specification in `docs/openapi.yaml` (PR #17).
- **Security Scanning:** Integrated automated `npm audit` dependency scanning and Dependabot into GitHub Actions (PR #18).
- **Deployment & Documentation:** Created comprehensive production deployment guide (`docs/DEPLOYMENT.md`) and project README (PR #19).

### Developer B (Frontend UI & Workspace Components)
- **Bookmark Workspace UI:** Designed and developed the modular Bookmark UI components in `features/bookmark-ui` (PR #14):
  - `BookmarkCard`: Card view with external link safety attributes (`rel="noopener noreferrer"`), tag pills, and action menus.
  - `BookmarkFormModal`: Accessible modal with title/URL validation and tag input.
  - `BulkActionBar`: Bulk selection bar with selected count and bulk delete action.
  - `SearchBar` & `TagFilterBar`: Instant client-side search and tag filtering chips.
- **Component Testing:** Authored 70 React component unit tests validating render states, form submissions, and user interactions.
- **Peer Reviews:** Conducted code reviews and verification across feature branches in the GitHub Projects board.

---

## 7. Local Installation & Development

### 7.1 Prerequisites
- **Node.js:** `v24.x LTS` (Node 24.19+ recommended)
- **npm:** `v10.x` or higher
- **Supabase Account:** Free account on [supabase.com](https://supabase.com)

### 7.2 Clone & Install
```bash
# Clone the repository
git clone https://github.com/Sijia711/linkshelf-p2.git
cd linkshelf-p2

# Install dependencies exactly as recorded in package-lock.json
npm ci
```

### 7.3 Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Edit `.env.local` with your Supabase project credentials (obtain from **Project Settings** -> **API** in the Supabase Dashboard):
```env
# Required for Supabase Client and Auth
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-anon-key

# Optional: E2E Playwright Testing Credentials (for npm run test:e2e)
# TEST_USER_EMAIL=test@example.com
# TEST_USER_PASSWORD=your-secure-test-password
# PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
```
> **Security Note:** Never commit `.env.local` or service-role keys. LinkShelf exclusively utilizes the publishable anonymous key on the client.

### 7.4 Apply Database Migrations
In your Supabase project's **SQL Editor**, run the SQL migration files in exact numerical order:
1. `supabase/migrations/001_create_bookmarks.sql`
2. `supabase/migrations/002_create_learning_paths.sql`

*(See [docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md) and [docs/LEARNING_PATHS_SETUP.md](./docs/LEARNING_PATHS_SETUP.md) for verification queries).*

### 7.5 Configure Supabase Authentication
In the Supabase Dashboard under **Authentication** -> **URL Configuration**:
- **Site URL:** `http://localhost:3000`
- **Redirect URLs:**
  - `http://localhost:3000/**`
  - `http://localhost:3000/auth/callback`

### 7.6 Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. Running Quality Checks & Test Suites

LinkShelf features rigorous test coverage across pure business logic, API route handlers, and end-to-end browser flows:

```bash
# 1. Run ESLint static analysis
npm run lint

# 2. Run TypeScript strict type-check
npm run type-check

# 3. Run Vitest unit & integration test suite (144 tests)
npm run test

# 4. Run Vitest with code coverage report
npm run test:coverage

# 5. Run Playwright End-to-End tests (requires local server and test credentials)
npm run test:e2e

# 6. Verify dependency security policy (zero high or critical vulnerabilities)
npm audit --audit-level=high

# 7. Run Next.js production build
npm run build
```

---

## 9. API Documentation & OpenAPI Specification

LinkShelf provides complete documentation of all 8 route handlers (14 HTTP operations):

- **REST API Reference:** [`docs/API.md`](./docs/API.md) — Comprehensive reference detailing request bodies, query parameters, validation rules, and error codes.
- **Frontend Contract:** [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — Formal data contract establishing schemas, envelope structures, and soft-delete semantics between backend and frontend.
- **OpenAPI 3.0.3 Specification:** [`docs/openapi.yaml`](./docs/openapi.yaml) *(submitted in PR #17)* — Machine-readable OpenAPI specification compatible with Swagger Editor and Redocly CLI.

---

## 10. Security Architecture & Data Isolation

1. **Row Level Security (RLS):**
   - RLS is enabled on all tables: `public.bookmarks`, `public.learning_paths`, and `public.learning_path_items`.
   - Access policies strictly enforce `auth.uid() = user_id`.
   - Users cannot read, insert, update, or delete records belonging to any other user, regardless of client-side parameters.
2. **Input Validation & Link Safety:**
   - Server-side validation via `lib/bookmarks.ts` rejects non-HTTP URLs (blocking `javascript:`, `data:`, `file:`, etc.).
   - Titles are sanitized and enforced to 1–255 characters.
   - All external bookmark links are rendered with `target="_blank"` and `rel="noopener noreferrer"` to prevent tab-nabbing vulnerabilities.
3. **Soft Deletion & Privilege Control:**
   - Database privileges intentionally omit SQL `DELETE` permissions for the `authenticated` role on the `bookmarks` table.
   - Deletions are performed strictly via SQL `UPDATE` setting `deleted_at = NOW()`, ensuring single-step Undo reliability and preventing permanent data destruction.

---

## 11. Current Status & Known Limitations

### What is Live on `main` Today (Commit `460479a`):
- Full Supabase Authentication flow (Sign Up, Sign In, Sign Out, protected routes).
- Complete REST API Route Handlers under `/api/bookmarks/` and `/api/learning-paths/`.
- Full-stack **Learning Paths** feature with UI at `/learning-paths` and `/learning-paths/[id]`.
- Playwright E2E automated test suite.
- 144 passing Vitest unit & integration tests.
- Live deployment active on Vercel at `https://linkshelf-p2.vercel.app`.
- Authenticated `/dashboard` currently renders the verified placeholder view while Developer B's UI integration completes the review cycle.

### Ready in Active Pull Requests:
- **PR #14:** Developer B's Bookmark Workspace UI components (`features/bookmark-ui`) and 70 React component tests.
- **PR #15:** Vitest UI testing infrastructure with jsdom and React Testing Library.
- **PR #16:** Bookmark Dashboard API Adapter connecting `BookmarkWorkspace` to live Supabase endpoints on `/dashboard`.
- **PR #17:** OpenAPI 3.0.3 specification (`docs/openapi.yaml`).
- **PR #18:** CI/CD automated security scanning (`security.yml`, `dependabot.yml`).
- **PR #19:** Complete project README and production deployment guide (`docs/DEPLOYMENT.md`).

### Known External Limitations:
- **GitHub Actions Billing Lock:** GitHub Actions execution on GitHub-hosted runners is currently blocked at the account level due to an administrative billing restriction. All test suites, linters, coverage reports, and production builds have been verified passing locally.
