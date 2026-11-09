"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validatePassword, sanitizeRedirectUrl } from "@/lib/auth";

/**
 * Handles user sign in with email and password.
 */
export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const rawRedirectTo = formData.get("redirectTo") as string | null;
  const safeRedirect = sanitizeRedirectUrl(rawRedirectTo, "/dashboard");

  const emailResult = validateEmail(email);
  if (!emailResult.isValid) {
    redirect(`/login?error=${encodeURIComponent(emailResult.error!)}&redirectTo=${encodeURIComponent(safeRedirect)}`);
  }

  const passwordResult = validatePassword(password);
  if (!passwordResult.isValid) {
    redirect(`/login?error=${encodeURIComponent(passwordResult.error!)}&redirectTo=${encodeURIComponent(safeRedirect)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailResult.value!,
    password: passwordResult.value!,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(safeRedirect)}`);
  }

  redirect(safeRedirect);
}

/**
 * Handles user registration with email and password.
 */
export async function signUpAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const emailResult = validateEmail(email);
  if (!emailResult.isValid) {
    redirect(`/signup?error=${encodeURIComponent(emailResult.error!)}`);
  }

  const passwordResult = validatePassword(password);
  if (!passwordResult.isValid) {
    redirect(`/signup?error=${encodeURIComponent(passwordResult.error!)}`);
  }

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || "http";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: emailResult.value!,
    password: passwordResult.value!,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // If Supabase requires email confirmation, session will be null
  if (data.user && !data.session) {
    redirect(`/login?message=check-email`);
  }

  redirect("/dashboard");
}

/**
 * Handles user sign out.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
