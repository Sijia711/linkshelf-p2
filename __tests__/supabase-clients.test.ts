import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient as createBrowserClientHelper } from "@/lib/supabase/client";
import { createClient as createServerClientHelper } from "@/lib/supabase/server";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("Supabase Client Factories", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    };
  });

  describe("Browser Client (lib/supabase/client.ts)", () => {
    it("should instantiate createBrowserClient with environment variables", () => {
      const mockClient = { auth: {} };
      (createBrowserClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

      const client = createBrowserClientHelper();
      expect(client).toBe(mockClient);
      expect(createBrowserClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key"
      );
    });

    it("should throw error if NEXT_PUBLIC_SUPABASE_URL is missing", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(() => createBrowserClientHelper()).toThrow(/Missing Supabase public environment variables/);
    });

    it("should throw error if NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      expect(() => createBrowserClientHelper()).toThrow(/Missing Supabase public environment variables/);
    });
  });

  describe("Server Client (lib/supabase/server.ts)", () => {
    it("should instantiate createServerClient with cookie handlers", async () => {
      const mockCookieStore = {
        getAll: vi.fn().mockReturnValue([{ name: "sb-token", value: "xyz" }]),
        set: vi.fn(),
      };
      (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCookieStore);

      const mockClient = { auth: {} };
      (createServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

      const client = await createServerClientHelper();
      expect(client).toBe(mockClient);

      expect(createServerClient).toHaveBeenCalled();
      const config = (createServerClient as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2];

      // Test cookie getAll handler
      expect(config.cookies.getAll()).toEqual([{ name: "sb-token", value: "xyz" }]);

      // Test cookie setAll handler
      config.cookies.setAll([{ name: "session", value: "abc", options: { path: "/" } }]);
      expect(mockCookieStore.set).toHaveBeenCalledWith("session", "abc", { path: "/" });

      // Test setAll error safety (e.g., in Server Component context where set throws)
      mockCookieStore.set.mockImplementationOnce(() => {
        throw new Error("Cannot set cookies in Server Component");
      });
      expect(() =>
        config.cookies.setAll([{ name: "test", value: "1", options: {} }])
      ).not.toThrow();
    });

    it("should throw error if Supabase credentials are not configured", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      await expect(createServerClientHelper()).rejects.toThrow(/Missing Supabase public environment variables/);
    });
  });

  describe("Proxy Cookie Handlers (lib/supabase/proxy.ts)", () => {
    it("should exercise getAll and setAll cookie callbacks during updateSession", async () => {
      let registeredCookieOptions: {
        cookies: {
          getAll: () => unknown[];
          setAll: (cookies: unknown[]) => void;
        };
      } | null = null;
      (createServerClient as unknown as ReturnType<typeof vi.fn>).mockImplementation((_url, _key, options) => {
        registeredCookieOptions = options;
        return {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "u1", email: "test@example.com" } },
              error: null,
            }),
          },
        };
      });

      const request = new NextRequest("http://localhost:3000/dashboard");
      await updateSession(request);

      expect(registeredCookieOptions).not.toBeNull();
      const options = registeredCookieOptions!;

      // Exercise getAll()
      const allCookies = options.cookies.getAll();
      expect(Array.isArray(allCookies)).toBe(true);

      // Exercise setAll()
      options.cookies.setAll([
        { name: "refreshed-token", value: "new-val", options: { httpOnly: true } },
      ]);
    });
  });
});
