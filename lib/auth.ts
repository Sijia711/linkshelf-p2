/**
 * LinkShelf — Authentication Validation and Security Helpers
 * 
 * Provides pure validation, sanitization against open redirect exploits,
 * and user-friendly error mapping for Supabase Auth flows.
 */

export interface AuthFieldValidationResult<T> {
  isValid: boolean;
  value?: T;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address format and trims whitespace.
 */
export function validateEmail(email: unknown): AuthFieldValidationResult<string> {
  if (typeof email !== "string") {
    return { isValid: false, error: "Email is required." };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "Email is required." };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  return { isValid: true, value: trimmed };
}

/**
 * Validates a user password.
 * Supabase default minimum is 6 characters.
 */
export function validatePassword(password: unknown): AuthFieldValidationResult<string> {
  if (typeof password !== "string") {
    return { isValid: false, error: "Password is required." };
  }

  const trimmed = password.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "Password is required." };
  }

  if (trimmed.length < 6) {
    return { isValid: false, error: "Password must be at least 6 characters." };
  }

  return { isValid: true, value: password };
}

/**
 * Prevents open redirect attacks by ensuring the target URL is a safe, relative path.
 * 
 * Rules:
 * - Must start with a single `/`.
 * - Cannot start with `//` or `/\\` (protocol-relative or Windows path exploit).
 * - Cannot contain a protocol scheme (e.g., `javascript:`, `https:`).
 */
export function sanitizeRedirectUrl(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  if (trimmed.length === 0) {
    return fallback;
  }

  // Must begin with a single forward slash and not double slashes or backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Prevent schemes embedded after slash or encoded schemes
  if (trimmed.includes("://") || trimmed.startsWith("/%2f") || trimmed.startsWith("/%5c")) {
    return fallback;
  }

  return trimmed;
}

/**
 * Maps raw Supabase Auth errors to secure, friendly user-facing messages.
 */
export function mapAuthError(error: unknown): string | null {
  if (!error) {
    return null;
  }

  const rawMessage = typeof error === "string" 
    ? error 
    : error instanceof Error 
      ? error.message 
      : (error as { message?: string; code?: string }).message || "";

  const lower = rawMessage.toLowerCase();

  if (lower.includes("invalid login credentials") || lower.includes("invalid_grant")) {
    return "Invalid email or password. Please try again.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please check your email and confirm your account before logging in.";
  }

  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try signing in.";
  }

  if (lower.includes("password should be at least 6") || lower.includes("weak_password")) {
    return "Password must be at least 6 characters.";
  }

  if (lower.includes("confirmation_failed") || lower.includes("otp_expired") || lower.includes("token has expired")) {
    return "Your email confirmation link is invalid or has expired. Please request a new one.";
  }

  return "An unexpected error occurred. Please try again.";
}
