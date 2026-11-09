import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectUrl } from "@/lib/auth";

/**
 * PKCE Email Confirmation & Auth Callback Route Handler
 * 
 * Supabase Auth confirmation links point to /auth/callback?code=...&next=/dashboard
 * This endpoint exchanges the single-use auth code for an active session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const safeNext = sanitizeRedirectUrl(rawNext, "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // If exchange fails or no code is provided, redirect to login with explicit error
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
