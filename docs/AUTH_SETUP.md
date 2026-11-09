# LinkShelf — Supabase Authentication Setup & Testing Guide

This guide covers the manual configuration required in the [Supabase Dashboard](https://supabase.com/dashboard) and how to test the authentication flow for LinkShelf.

---

## 1. Supabase Dashboard URL Configuration

To ensure PKCE authentication callbacks and email confirmation links resolve properly on your local environment:

1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. In the left navigation, navigate to **Authentication** -> **URL Configuration**.
3. Set **Site URL** to:
   ```text
   http://localhost:3000
   ```
4. Under **Redirect URLs**, click **Add URL** and add:
   ```text
   http://localhost:3000/**
   http://localhost:3000/auth/callback
   ```
5. Click **Save**.

---

## 2. Email Provider Configuration

1. In the left navigation, navigate to **Authentication** -> **Providers** -> **Email**.
2. Ensure **Enable Email provider** is toggled **ON**.
3. Under **Confirm email**:
   - For **Production & Full Testing:** Toggle **ON** (default). Supabase will require users to confirm their email before logging in.
   - For **Rapid Local Development:** If you want instant sign-ins without email verification during development, you can toggle **OFF** ("Confirm email").
4. Click **Save**.

---

## 3. Email Template (Confirmation Flow)

If email confirmation is enabled, Supabase sends a confirmation email containing a link:
1. In the left navigation, navigate to **Authentication** -> **Email Templates**.
2. Select **Confirm signup**.
3. The confirmation link in the template should be:
   ```html
   <h2>Confirm your signup</h2>
   <p>Follow this link to confirm your account:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
   ```
   *Note: Our application passes `emailRedirectTo: `${origin}/auth/callback?next=/dashboard`` in `signUpAction`. Supabase automatically appends the PKCE code parameter to this redirect URL.*

---

## 4. Testing the Authentication Flow

### Local URL Endpoints
- **Home:** `http://localhost:3000/` (redirects unauthenticated users to `/login`)
- **Login:** `http://localhost:3000/login`
- **Sign Up:** `http://localhost:3000/signup`
- **Dashboard:** `http://localhost:3000/dashboard` (protected)
- **Auth Callback:** `http://localhost:3000/auth/callback` (exchanges PKCE code)
- **Sign Out:** `http://localhost:3000/auth/signout`

---

### Step-by-Step Verification Procedure

#### Step A: Sign Up
1. Start your local dev server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:3000/signup`.
3. Enter a valid email (e.g., `student@example.com`) and a password (at least 6 characters).
4. Click **Sign Up**.
5. If email confirmation is enabled:
   - You will be redirected to `/login?message=check-email`.
   - A blue informational banner will read: *"Check your email for a confirmation link to activate your account."*
   - In your inbox (or Supabase Dashboard -> **Authentication** -> **Users**), click the confirmation link.
   - The link will redirect through `/auth/callback` and immediately deposit you on `/dashboard`.

#### Step B: Sign In
1. If email confirmation is already completed (or disabled):
2. Navigate to `http://localhost:3000/login`.
3. Enter your credentials and click **Sign In**.
4. You should be securely redirected to `/dashboard`.
5. The dashboard header should display your email and a **Sign Out** button.

#### Step C: Protected Route Boundaries (`proxy.ts`)
1. While logged in:
   - Try navigating to `http://localhost:3000/login` or `http://localhost:3000/signup`.
   - You should be automatically redirected back to `http://localhost:3000/dashboard`.
2. Click **Sign Out**:
   - Your session will be terminated and you will be redirected to `/login`.
3. While logged out:
   - Try navigating to `http://localhost:3000/dashboard`.
   - You should be redirected to `/login?redirectTo=%2Fdashboard`.
   - Notice the query parameter preserves where you wanted to go safely.
   - Sign in again, and you will be routed directly to `/dashboard`.

#### Step D: Error Handling
- **Wrong Password:** Try signing in with an incorrect password. Confirm that a red error alert displays: *"Invalid email or password. Please try again."*
- **Short Password:** Try signing up with `12345`. Confirm that validation displays: *"Password must be at least 6 characters."*
- **Duplicate Account:** Try registering an account with an existing email. Confirm the alert displays: *"An account with this email already exists. Try signing in."*
- **Open Redirect Protection:** Try accessing `/login?redirectTo=https://evil.com`. Upon login, verify that you are redirected to `/dashboard` rather than the external site.
