# LinkShelf — Production Deployment Guide

This guide provides reproducible, step-by-step instructions for deploying LinkShelf to [Vercel](https://vercel.com) with a [Supabase](https://supabase.com) backend.

---

## 1. Architecture Overview

LinkShelf is built on Next.js 16 (App Router) and deployed as a hybrid serverless web application:
- **Frontend & Route Handlers:** Hosted on Vercel with automatic Edge Middleware and Serverless Functions.
- **Database & Authentication:** Hosted on Supabase (PostgreSQL 15+ with pgvector support and Supabase Auth).
- **Session Management:** Cookie-based session tokens handled via `@supabase/ssr` with PKCE authorization exchange.
- **Data Access:** All client operations interact with Supabase using Row Level Security (RLS) under the `anon` publishable key; service-role keys are never exposed.

---

## 2. Prerequisites

Before beginning deployment, ensure you have:
1. A GitHub account with access to the [LinkShelf repository](https://github.com/Sijia711/linkshelf-p2).
2. A free or pro account on [Supabase](https://supabase.com).
3. A free or pro account on [Vercel](https://vercel.com).
4. Node.js 24 LTS and npm installed locally (for testing migrations or running local smoke tests).

---

## 3. Step 1: Create and Configure Supabase Project

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project**.
3. Choose an Organization, enter a project name (e.g., `linkshelf-prod`), and generate a secure database password.
4. Select the geographic region closest to your target users (e.g., `US East (N. Virginia)`).
5. Click **Create new project** and wait for database provisioning to complete (typically 1–2 minutes).
6. In the left navigation, go to **Project Settings** -> **API**:
   - Copy **Project URL** (e.g., `https://abcdefghijklm.supabase.co`).
   - Copy **Project API keys** -> `anon` / `public` key.
   *(Save these for the Vercel configuration step).*

---

## 4. Step 2: Apply Database Schema & Migrations

LinkShelf uses SQL migrations located under `supabase/migrations/`. These must be executed in numerical sequence using the Supabase SQL Editor.

### 4.1 Apply Migration 001 (Bookmarks Table & RLS)
1. In the Supabase Dashboard, click **SQL Editor** in the left sidebar.
2. Click **+ New query**.
3. Copy and paste the entire contents of [`supabase/migrations/001_create_bookmarks.sql`](../supabase/migrations/001_create_bookmarks.sql).
4. Click **Run** (or press `Cmd + Enter`).
5. Verify output: `Success. No rows returned`.

### 4.2 Apply Migration 002 (Learning Paths & Items)
1. Click **+ New query**.
2. Copy and paste the entire contents of [`supabase/migrations/002_create_learning_paths.sql`](../supabase/migrations/002_create_learning_paths.sql).
3. Click **Run**.
4. Verify output: `Success. No rows returned`.

### 4.3 Verify Schema and Security
Run the following SQL query in the SQL Editor to ensure all three tables have Row Level Security enabled:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('bookmarks', 'learning_paths', 'learning_path_items');
```

**Expected Result:**
| tablename | rowsecurity |
| :--- | :---: |
| `bookmarks` | `true` |
| `learning_paths` | `true` |
| `learning_path_items` | `true` |

*(For in-depth verification queries, see [docs/DATABASE_SETUP.md](./DATABASE_SETUP.md) and [docs/LEARNING_PATHS_SETUP.md](./LEARNING_PATHS_SETUP.md)).*

---

## 5. Step 3: Configure Supabase Authentication

Supabase Auth handles user registration, password hashing, and PKCE callback redirects.

1. In the Supabase Dashboard, navigate to **Authentication** -> **URL Configuration**.
2. Set **Site URL** to your production domain:
   ```text
   https://linkshelf-p2.vercel.app
   ```
3. Under **Redirect URLs**, click **Add URL** and add the following entries:
   ```text
   https://linkshelf-p2.vercel.app/**
   https://linkshelf-p2.vercel.app/auth/callback
   http://localhost:3000/**
   http://localhost:3000/auth/callback
   ```
4. Click **Save**.
5. Navigate to **Authentication** -> **Providers** -> **Email**:
   - Ensure **Enable Email provider** is toggled **ON**.
   - Under **Confirm email**:
     - For production environments with email delivery configured: Toggle **ON**.
     - For development / smoke-testing environments: If you wish to allow immediate sign-ins without waiting for verification emails, toggle **OFF**.
6. Under **Authentication** -> **Email Templates** -> **Confirm signup**:
   - Ensure the template links to `{{ .ConfirmationURL }}`. LinkShelf's server action automatically attaches `?next=/dashboard` to the redirect target.

---

## 6. Step 4: Configure Vercel Project

1. Log into the [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository: `Sijia711/linkshelf-p2`.
4. In the **Configure Project** screen:
   - **Framework Preset:** `Next.js` (automatically detected).
   - **Root Directory:** `./`
   - **Build Command:** `next build` (default).
   - **Output Directory:** `.next` (default).
   - **Install Command:** `npm ci` (default).
5. Expand **Environment Variables** and add the following two variables:

| Key | Value | Target Environments |
| :--- | :--- | :---: |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `your-supabase-publishable-anon-key` | Production, Preview, Development |

> **IMPORTANT:** Do NOT add Supabase service-role keys. The application does not require elevated database privileges.

6. Click **Deploy**.

---

## 7. Step 5: Verify Deployment & Domain Configuration

1. Vercel will install dependencies using `npm ci`, run TypeScript compilation, and build the Next.js App Router application.
2. Confirm the build logs complete with:
   ```text
   ✓ Compiled successfully
   ✓ Collecting page data
   ✓ Generating static pages
   ✓ Finalizing page optimization
   ```
3. Visit the assigned deployment URL (e.g., `https://linkshelf-p2.vercel.app`).
4. In Vercel under **Settings** -> **Domains**, verify that your production domain is active with a valid SSL certificate.

---

## 8. Step 6: Post-Deployment Smoke Testing Runbook

Execute this manual verification runbook after every production deployment:

### 8.1 Public Routes & Protected Redirects
- [ ] Visit `https://linkshelf-p2.vercel.app/`. Confirm it redirects unauthenticated visitors to `/login`.
- [ ] Visit `https://linkshelf-p2.vercel.app/dashboard`. Confirm it immediately redirects to `/login`.
- [ ] Visit `https://linkshelf-p2.vercel.app/learning-paths`. Confirm it immediately redirects to `/login`.
- [ ] Visit `https://linkshelf-p2.vercel.app/login`. Confirm the sign-in form renders with email and password inputs.
- [ ] Visit `https://linkshelf-p2.vercel.app/signup`. Confirm the registration form renders.

### 8.2 Authentication Flow
- [ ] Register a new test account on `/signup` with a unique email.
- [ ] If email confirmation is enabled, click the confirmation link in the received email; verify it redirects to `/dashboard`.
- [ ] If email confirmation is disabled, confirm registration directly logs into the protected session.
- [ ] On the dashboard, verify the user email is displayed in the navigation header.
- [ ] Click **Sign Out**. Confirm the session is cleared and the browser returns to `/login`.
- [ ] Sign back in using the credentials. Confirm login succeeds.

### 8.3 Learning Paths Feature Flow
- [ ] In the navigation, go to `/learning-paths`.
- [ ] Click **Create Learning Path**.
- [ ] Enter Title: `"Production Smoke Test Path"` and Description: `"Verifying live Supabase DB"`.
- [ ] Click **Create Path**. Confirm the path appears in the grid with `0%` progress.
- [ ] Click the created learning path to open `/learning-paths/[id]`.
- [ ] Edit the path title and description. Confirm changes persist upon page reload.
- [ ] Delete the test path. Confirm it is removed and the page redirects to `/learning-paths`.

### 8.4 REST API Verification
Verify API health by running an authenticated curl request with a valid Supabase JWT token:

```bash
curl -X GET "https://linkshelf-p2.vercel.app/api/bookmarks" \
  -H "Authorization: Bearer <user_jwt_token>"
```

**Expected Response (HTTP 200):**
```json
{
  "data": {
    "bookmarks": [],
    "total": 0
  },
  "error": null
}
```

Verify that unauthenticated calls are rejected:
```bash
curl -X GET "https://linkshelf-p2.vercel.app/api/bookmarks"
```

**Expected Response (HTTP 401):**
```json
{
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please sign in."
  }
}
```

---

## 9. Troubleshooting & Common Issues

### 9.1 Build Failure: Missing Environment Variables
- **Symptom:** Vercel build fails during page data collection with: `TypeError: Invalid URL: ...` or Supabase client initialization errors.
- **Cause:** `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing from the Vercel Project Environment Variables.
- **Fix:** In Vercel Settings -> Environment Variables, ensure both variables are defined for the **Production** environment, then trigger a redeploy (**Deployments** -> **Redeploy**).

### 9.2 Auth Callback Error: `redirect_uri_mismatch`
- **Symptom:** Clicking email verification links or completing OAuth redirects results in an error page or loops back to `/login`.
- **Cause:** The Vercel URL has not been added to Supabase **Redirect URLs**.
- **Fix:** In Supabase Dashboard -> **Authentication** -> **URL Configuration**, add `https://your-domain.vercel.app/auth/callback` and `https://your-domain.vercel.app/**` to the Redirect URLs list and save.

### 9.3 Row Level Security Denial (`new row violates row-level security policy`)
- **Symptom:** API returns 500 or PostgreSQL error: `42501 permission denied`.
- **Cause:** Client attempted an insert or update without an authenticated user session, or attempted to set `user_id` to a value other than `auth.uid()`.
- **Fix:** Ensure the client request passes the user session cookie (in browser) or `Authorization: Bearer <token>` header. Verify that the route handler extracts `user.id` from `supabase.auth.getUser()`.

### 9.4 Turbopack Worker Thread Warning during Next.js Build
- **Symptom:** Warning during build:
  `⚠ experimental.turbopackPluginRuntimeStrategy = 'forceWorkerThreads' is enabled, bypassing protection against a known potential crash in Node.js >=24.13.1.`
- **Status:** Benign. This is a known upstream Next.js / Node.js 24 compatibility advisory. It does not affect application runtime or deployment stability.

### 9.5 GitHub Actions Billing Lock
- **Symptom:** GitHub Actions workflows show queued or failed status with an account billing error.
- **Context:** An account-level billing lock on the repository owner's GitHub account currently prevents GitHub-hosted Actions runners from initiating.
- **Status:** All linting, TypeScript type checking, unit tests (144 tests), coverage (89.01%), and production builds pass locally. Vercel deployment operates independently of GitHub Actions through direct GitHub webhook integration.
