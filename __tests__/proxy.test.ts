import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { createServerClient } from "@supabase/ssr";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

describe("Proxy Session & Route Protection (updateSession)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    };
  });

  const mockSupabaseUser = (user: { id: string; email: string } | null) => {
    (createServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : new Error("Not logged in"),
        }),
      },
    });
  };

  describe("Unauthenticated User Access", () => {
    beforeEach(() => {
      mockSupabaseUser(null);
    });

    it("should redirect unauthenticated access from /dashboard to /login with redirectTo param", async () => {
      const request = new NextRequest("http://localhost:3000/dashboard");
      const response = await updateSession(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("redirectTo=%2Fdashboard");
    });

    it("should preserve query parameters in redirectTo when redirecting from /dashboard/bookmarks?q=test", async () => {
      const request = new NextRequest("http://localhost:3000/dashboard/bookmarks?q=test");
      const response = await updateSession(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("redirectTo=%2Fdashboard%2Fbookmarks%3Fq%3Dtest");
    });

    it("should redirect unauthenticated access from root / to /login", async () => {
      const request = new NextRequest("http://localhost:3000/");
      const response = await updateSession(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("http://localhost:3000/login");
    });

    it("should allow unauthenticated access to /login without redirect", async () => {
      const request = new NextRequest("http://localhost:3000/login");
      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("should allow unauthenticated access to /signup without redirect", async () => {
      const request = new NextRequest("http://localhost:3000/signup");
      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("should allow access to auth callback routes without redirecting to login", async () => {
      const request = new NextRequest("http://localhost:3000/auth/callback?code=12345");
      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });
  });

  describe("Authenticated User Access", () => {
    beforeEach(() => {
      mockSupabaseUser({ id: "user-123", email: "user@example.com" });
    });

    it("should allow authenticated access to /dashboard without redirect", async () => {
      const request = new NextRequest("http://localhost:3000/dashboard");
      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("should redirect authenticated user from /login to /dashboard", async () => {
      const request = new NextRequest("http://localhost:3000/login");
      const response = await updateSession(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("should redirect authenticated user from /signup to /dashboard", async () => {
      const request = new NextRequest("http://localhost:3000/signup");
      const response = await updateSession(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("should redirect authenticated user from root / to /dashboard", async () => {
      const request = new NextRequest("http://localhost:3000/");
      const response = await updateSession(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });
  });

  describe("Missing Environment Variables Fallback", () => {
    it("should pass through safely if Supabase credentials are missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      const request = new NextRequest("http://localhost:3000/dashboard");
      const response = await updateSession(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });
  });
});
