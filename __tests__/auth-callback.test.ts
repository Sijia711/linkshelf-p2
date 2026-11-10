import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as handleCallback } from "@/app/auth/callback/route";
import { POST as handleSignOutPost, GET as handleSignOutGet } from "@/app/auth/signout/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Auth Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /auth/callback (PKCE Exchange)", () => {
    it("should exchange valid code for session and redirect to safe next url", async () => {
      const mockExchange = vi.fn().mockResolvedValue({ error: null });
      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { exchangeCodeForSession: mockExchange },
      });

      const request = new Request("http://localhost:3000/auth/callback?code=valid-pkce-code&next=/dashboard");
      const response = await handleCallback(request);

      expect(mockExchange).toHaveBeenCalledWith("valid-pkce-code");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("should sanitize the next parameter to block open redirects", async () => {
      const mockExchange = vi.fn().mockResolvedValue({ error: null });
      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { exchangeCodeForSession: mockExchange },
      });

      const request = new Request("http://localhost:3000/auth/callback?code=valid-pkce-code&next=https://evil.com");
      const response = await handleCallback(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("should redirect to /login?error=confirmation_failed when exchange fails", async () => {
      const mockExchange = vi.fn().mockResolvedValue({ error: new Error("Invalid code") });
      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { exchangeCodeForSession: mockExchange },
      });

      const request = new Request("http://localhost:3000/auth/callback?code=expired-code");
      const response = await handleCallback(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=confirmation_failed");
    });

    it("should redirect to /login?error=confirmation_failed when code is missing", async () => {
      const request = new Request("http://localhost:3000/auth/callback");
      const response = await handleCallback(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=confirmation_failed");
    });
  });

  describe("/auth/signout", () => {
    it("should sign out on POST and redirect to /login with 303 status", async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { signOut: mockSignOut },
      });

      const request = new Request("http://localhost:3000/auth/signout", { method: "POST" });
      const response = await handleSignOutPost(request);

      expect(mockSignOut).toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("should sign out on GET and redirect to /login with 303 status", async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { signOut: mockSignOut },
      });

      const request = new Request("http://localhost:3000/auth/signout", { method: "GET" });
      const response = await handleSignOutGet(request);

      expect(mockSignOut).toHaveBeenCalled();
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    });
  });
});
