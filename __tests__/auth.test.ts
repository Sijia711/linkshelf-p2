import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  sanitizeRedirectUrl,
  mapAuthError,
} from "@/lib/auth";

describe("Authentication Helpers & Security Rules", () => {
  describe("validateEmail", () => {
    it("should accept valid email addresses and trim whitespace", () => {
      const result = validateEmail("  developer@example.com  ");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("developer@example.com");
    });

    it("should reject empty or missing email", () => {
      expect(validateEmail("").isValid).toBe(false);
      expect(validateEmail("   ").isValid).toBe(false);
      expect(validateEmail(null).isValid).toBe(false);
    });

    it("should reject malformed email strings", () => {
      expect(validateEmail("plainaddress").isValid).toBe(false);
      expect(validateEmail("@missinguser.com").isValid).toBe(false);
      expect(validateEmail("user@.com").isValid).toBe(false);
      expect(validateEmail("user@domain").isValid).toBe(false);
    });
  });

  describe("validatePassword", () => {
    it("should accept passwords with 6 or more characters", () => {
      const result = validatePassword("securePass123");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("securePass123");
    });

    it("should reject passwords shorter than 6 characters", () => {
      const result = validatePassword("12345");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Password must be at least 6 characters.");
    });

    it("should reject empty or whitespace-only passwords", () => {
      expect(validatePassword("").isValid).toBe(false);
      expect(validatePassword("     ").isValid).toBe(false);
    });
  });

  describe("sanitizeRedirectUrl (Open Redirect Prevention)", () => {
    it("should allow safe relative paths", () => {
      expect(sanitizeRedirectUrl("/dashboard")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("/dashboard/bookmarks?q=react")).toBe("/dashboard/bookmarks?q=react");
      expect(sanitizeRedirectUrl("/")).toBe("/");
    });

    it("should reject external URLs and return default fallback", () => {
      expect(sanitizeRedirectUrl("https://evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("http://evil.com/phishing")).toBe("/dashboard");
    });

    it("should reject protocol-relative and bypass patterns", () => {
      expect(sanitizeRedirectUrl("//evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("///evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("/\\evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("javascript:alert(1)")).toBe("/dashboard");
      expect(sanitizeRedirectUrl("data:text/html,evil")).toBe("/dashboard");
    });

    it("should fall back to custom fallback if provided", () => {
      expect(sanitizeRedirectUrl("https://evil.com", "/login")).toBe("/login");
      expect(sanitizeRedirectUrl(null, "/settings")).toBe("/settings");
      expect(sanitizeRedirectUrl("", "/home")).toBe("/home");
    });
  });

  describe("mapAuthError", () => {
    it("should map invalid credentials error to user-friendly text", () => {
      expect(mapAuthError("Invalid login credentials")).toBe("Invalid email or password. Please try again.");
      expect(mapAuthError("invalid_grant")).toBe("Invalid email or password. Please try again.");
    });

    it("should map email not confirmed error", () => {
      expect(mapAuthError("Email not confirmed")).toBe("Please check your email and confirm your account before logging in.");
    });

    it("should map duplicate user registration error", () => {
      expect(mapAuthError("User already registered")).toBe("An account with this email already exists. Try signing in.");
    });

    it("should map weak password error", () => {
      expect(mapAuthError("Password should be at least 6 characters")).toBe("Password must be at least 6 characters.");
    });

    it("should map confirmation code errors", () => {
      expect(mapAuthError("confirmation_failed")).toBe("Your email confirmation link is invalid or has expired. Please request a new one.");
    });

    it("should provide a safe default message for unknown errors", () => {
      expect(mapAuthError("Some unexpected DB error")).toBe("An unexpected error occurred. Please try again.");
      expect(mapAuthError(null)).toBeNull();
    });
  });
});
