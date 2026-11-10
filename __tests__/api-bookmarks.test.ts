import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getBookmarks, POST as createBookmark } from "@/app/api/bookmarks/route";
import { PATCH as updateBookmark, DELETE as deleteBookmark } from "@/app/api/bookmarks/[id]/route";
import { POST as bulkDelete } from "@/app/api/bookmarks/bulk-delete/route";
import { POST as bulkRestore } from "@/app/api/bookmarks/bulk-restore/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Bookmark REST API Route Handlers", () => {
  const mockUser = { id: "11111111-1111-4111-8111-111111111111", email: "user@example.com" };
  const validId = "22222222-2222-4222-8222-222222222222";
  const otherId = "33333333-3333-4333-8333-333333333333";

  let mockSupabase: {
    auth: {
      getUser: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(),
    };

    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);
  });

  const setUnauthenticated = () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });
  };

  describe("GET /api/bookmarks", () => {
    it("should return 401 when unauthenticated", async () => {
      setUnauthenticated();
      const request = new Request("http://localhost:3000/api/bookmarks");
      const response = await getBookmarks(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
      expect(json.data).toBeNull();
    });

    it("should return 200 with list of active bookmarks for authenticated user", async () => {
      const mockBookmarks = [
        {
          id: validId,
          user_id: mockUser.id,
          title: "Next.js Docs",
          url: "https://nextjs.org",
          tags: ["docs", "react"],
          created_at: "2026-11-09T00:00:00Z",
          updated_at: "2026-11-09T00:00:00Z",
          deleted_at: null,
        },
      ];

      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockBookmarks, error: null }),
      };
      mockSupabase.from.mockReturnValue(queryBuilder);

      const request = new Request("http://localhost:3000/api/bookmarks");
      const response = await getBookmarks(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.bookmarks).toEqual(mockBookmarks);
      expect(json.data.total).toBe(1);
      expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(queryBuilder.is).toHaveBeenCalledWith("deleted_at", null);
      expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("should apply search query and tag filtering when provided", async () => {
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabase.from.mockReturnValue(queryBuilder);

      const request = new Request("http://localhost:3000/api/bookmarks?q=Next&tag=react");
      const response = await getBookmarks(request);
      expect(response.status).toBe(200);

      expect(queryBuilder.ilike).toHaveBeenCalledWith("title", "%Next%");
      expect(queryBuilder.contains).toHaveBeenCalledWith("tags", ["react"]);
    });

    it("should return 500 when database query fails", async () => {
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error("DB Query Error") }),
      };
      mockSupabase.from.mockReturnValue(queryBuilder);

      const request = new Request("http://localhost:3000/api/bookmarks");
      const response = await getBookmarks(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("POST /api/bookmarks", () => {
    it("should return 401 when unauthenticated", async () => {
      setUnauthenticated();
      const request = new Request("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ title: "Test", url: "https://test.com" }),
      });
      const response = await createBookmark(request);
      expect(response.status).toBe(401);
    });

    it("should return 400 when payload is invalid (missing title or invalid protocol)", async () => {
      const request = new Request("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ title: "", url: "javascript:alert(1)" }),
      });
      const response = await createBookmark(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.details.title).toBeDefined();
      expect(json.error.details.url).toBeDefined();
    });

    it("should return 201 on valid input and assign authenticated user_id", async () => {
      const newBookmark = {
        id: validId,
        user_id: mockUser.id,
        title: "Tailwind CSS",
        url: "https://tailwindcss.com",
        tags: ["css", "design"],
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T00:00:00Z",
        deleted_at: null,
      };

      const insertBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: newBookmark, error: null }),
      };
      mockSupabase.from.mockReturnValue(insertBuilder);

      const request = new Request("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          title: "  Tailwind CSS  ",
          url: "https://tailwindcss.com",
          tags: ["CSS", "Design"],
          user_id: "attacker-injected-id", // should be ignored
        }),
      });

      const response = await createBookmark(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.data).toEqual(newBookmark);
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        title: "Tailwind CSS",
        url: "https://tailwindcss.com",
        tags: ["css", "design"],
      });
    });

    it("should return 500 when insert fails", async () => {
      const insertBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("Insert Failed") }),
      };
      mockSupabase.from.mockReturnValue(insertBuilder);

      const request = new Request("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ title: "Valid", url: "https://valid.com" }),
      });
      const response = await createBookmark(request);
      expect(response.status).toBe(500);
    });
  });

  describe("PATCH /api/bookmarks/[id]", () => {
    const params = Promise.resolve({ id: validId });

    it("should return 401 when unauthenticated", async () => {
      setUnauthenticated();
      const request = new Request(`http://localhost:3000/api/bookmarks/${validId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      });
      const response = await updateBookmark(request, { params });
      expect(response.status).toBe(401);
    });

    it("should return 400 if id is not a valid UUID", async () => {
      const invalidParams = Promise.resolve({ id: "invalid-uuid" });
      const request = new Request("http://localhost:3000/api/bookmarks/invalid-uuid", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      });
      const response = await updateBookmark(request, { params: invalidParams });
      expect(response.status).toBe(400);
    });

    it("should return 400 when update payload has no valid fields", async () => {
      const request = new Request(`http://localhost:3000/api/bookmarks/${validId}`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      const response = await updateBookmark(request, { params });
      expect(response.status).toBe(400);
    });

    it("should return 404 if bookmark is not found or owned by another user", async () => {
      const updateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder);

      const request = new Request(`http://localhost:3000/api/bookmarks/${validId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "New Title" }),
      });
      const response = await updateBookmark(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("should return 200 on successful update and not allow changing user_id", async () => {
      const updatedBookmark = {
        id: validId,
        user_id: mockUser.id,
        title: "Updated Title",
        url: "https://example.com",
        tags: ["new"],
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T01:00:00Z",
        deleted_at: null,
      };

      const updateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: updatedBookmark, error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder);

      const request = new Request(`http://localhost:3000/api/bookmarks/${validId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "Updated Title",
          tags: ["NEW"],
          user_id: "attempt-to-steal-user-id",
        }),
      });

      const response = await updateBookmark(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toEqual(updatedBookmark);
      expect(updateBuilder.update).toHaveBeenCalledWith({
        title: "Updated Title",
        tags: ["new"],
      });
      expect(updateBuilder.eq).toHaveBeenCalledWith("id", validId);
      expect(updateBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(updateBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    });
  });

  describe("DELETE /api/bookmarks/[id]", () => {
    const params = Promise.resolve({ id: validId });

    it("should return 401 when unauthenticated", async () => {
      setUnauthenticated();
      const request = new Request(`http://localhost:3000/api/bookmarks/${validId}`, {
        method: "DELETE",
      });
      const response = await deleteBookmark(request, { params });
      expect(response.status).toBe(401);
    });

    it("should return 400 when ID is invalid", async () => {
      const invalidParams = Promise.resolve({ id: "invalid-uuid" });
      const request = new Request("http://localhost:3000/api/bookmarks/invalid-uuid", {
        method: "DELETE",
      });
      const response = await deleteBookmark(request, { params: invalidParams });
      expect(response.status).toBe(400);
    });

    it("should soft-delete only and return 200", async () => {
      const updateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: validId }, error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder);

      const request = new Request(`http://localhost:3000/api/bookmarks/${validId}`, {
        method: "DELETE",
      });
      const response = await deleteBookmark(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toEqual({ id: validId, deleted: true });
      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        deleted_at: expect.any(String),
      }));
      expect(updateBuilder.eq).toHaveBeenCalledWith("id", validId);
      expect(updateBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(updateBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("should return 404 when bookmark is not found or already deleted", async () => {
      const updateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder);

      const request = new Request(`http://localhost:3000/api/bookmarks/${validId}`, {
        method: "DELETE",
      });
      const response = await deleteBookmark(request, { params });
      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/bookmarks/bulk-delete", () => {
    it("should return 401 when unauthenticated", async () => {
      setUnauthenticated();
      const request = new Request("http://localhost:3000/api/bookmarks/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: [validId] }),
      });
      const response = await bulkDelete(request);
      expect(response.status).toBe(401);
    });

    it("should return 400 when ids array is empty or malformed", async () => {
      const request = new Request("http://localhost:3000/api/bookmarks/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: [] }),
      });
      const response = await bulkDelete(request);
      expect(response.status).toBe(400);
    });

    it("should soft-delete matching owned records and return affected count", async () => {
      const updateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: validId }, { id: otherId }], error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder);

      const request = new Request("http://localhost:3000/api/bookmarks/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: [validId, otherId] }),
      });
      const response = await bulkDelete(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.affectedCount).toBe(2);
      expect(json.data.ids).toEqual([validId, otherId]);
      expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        deleted_at: expect.any(String),
      }));
      expect(updateBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(updateBuilder.is).toHaveBeenCalledWith("deleted_at", null);
      expect(updateBuilder.in).toHaveBeenCalledWith("id", [validId, otherId]);
    });
  });

  describe("POST /api/bookmarks/bulk-restore", () => {
    it("should return 401 when unauthenticated", async () => {
      setUnauthenticated();
      const request = new Request("http://localhost:3000/api/bookmarks/bulk-restore", {
        method: "POST",
        body: JSON.stringify({ ids: [validId] }),
      });
      const response = await bulkRestore(request);
      expect(response.status).toBe(401);
    });

    it("should return 400 when ids array is empty or malformed", async () => {
      const request = new Request("http://localhost:3000/api/bookmarks/bulk-restore", {
        method: "POST",
        body: JSON.stringify({ ids: ["invalid-id"] }),
      });
      const response = await bulkRestore(request);
      expect(response.status).toBe(400);
    });

    it("should restore soft-deleted records by resetting deleted_at to null", async () => {
      const updateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: validId }], error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder);

      const request = new Request("http://localhost:3000/api/bookmarks/bulk-restore", {
        method: "POST",
        body: JSON.stringify({ ids: [validId] }),
      });
      const response = await bulkRestore(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.affectedCount).toBe(1);
      expect(json.data.ids).toEqual([validId]);
      expect(updateBuilder.update).toHaveBeenCalledWith({ deleted_at: null });
      expect(updateBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(updateBuilder.not).toHaveBeenCalledWith("deleted_at", "is", null);
      expect(updateBuilder.in).toHaveBeenCalledWith("id", [validId]);
    });
  });
});
