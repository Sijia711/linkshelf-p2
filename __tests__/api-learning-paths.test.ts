import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GET as getLearningPaths,
  POST as createLearningPath,
} from "@/app/api/learning-paths/route";
import {
  GET as getLearningPath,
  PATCH as updateLearningPath,
  DELETE as deleteLearningPath,
} from "@/app/api/learning-paths/[id]/route";
import { POST as addItem } from "@/app/api/learning-paths/[id]/items/route";
import {
  PATCH as updateItem,
  DELETE as deleteItem,
} from "@/app/api/learning-paths/[id]/items/[itemId]/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATH_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BM_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OTHER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const mockUser = { id: USER_ID, email: "user@example.com" };

function makeRequest(method: string, body?: unknown, url = "http://localhost:3000") {
  if (body !== undefined) {
    return new Request(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new Request(url, { method });
}

type MockSupabase = {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

describe("Learning Paths REST API Route Handlers", () => {
  let mockSupabase: MockSupabase;

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

  // ─── GET /api/learning-paths ──────────────────────────────────────────────

  describe("GET /api/learning-paths", () => {
    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await getLearningPaths();
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 200 with list and progress stats", async () => {
      const rawPaths = [
        {
          id: PATH_ID,
          user_id: USER_ID,
          title: "JS Fundamentals",
          description: "",
          created_at: "2026-11-09T00:00:00Z",
          updated_at: "2026-11-09T00:00:00Z",
          learning_path_items: [
            { id: ITEM_ID, is_completed: true },
            { id: OTHER_ID, is_completed: false },
          ],
        },
      ];

      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: rawPaths, error: null }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await getLearningPaths();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.total).toBe(1);
      const path = json.data.learning_paths[0];
      expect(path.id).toBe(PATH_ID);
      expect(path.total_items).toBe(2);
      expect(path.completed_items).toBe(1);
      expect(path.progress_percentage).toBe(50);
      // learning_path_items should not be in the response
      expect(path.learning_path_items).toBeUndefined();
    });

    it("returns 500 on database error", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error("db fail") }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await getLearningPaths();
      expect(res.status).toBe(500);
    });
  });

  // ─── POST /api/learning-paths ─────────────────────────────────────────────

  describe("POST /api/learning-paths", () => {
    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await createLearningPath(
        makeRequest("POST", { title: "New Path" })
      );
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 on missing title", async () => {
      const res = await createLearningPath(makeRequest("POST", {}));
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when title exceeds 255 chars", async () => {
      const res = await createLearningPath(
        makeRequest("POST", { title: "a".repeat(256) })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when description exceeds 2000 chars", async () => {
      const res = await createLearningPath(
        makeRequest("POST", { title: "Valid", description: "x".repeat(2001) })
      );
      expect(res.status).toBe(400);
    });

    it("returns 201 and creates learning path", async () => {
      const created = {
        id: PATH_ID,
        user_id: USER_ID,
        title: "JS Path",
        description: "Learn JS",
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T00:00:00Z",
      };

      const qb = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await createLearningPath(
        makeRequest("POST", { title: "JS Path", description: "Learn JS" })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.learning_path.id).toBe(PATH_ID);
      expect(json.data.learning_path.total_items).toBe(0);
      expect(json.data.learning_path.progress_percentage).toBe(0);
      // Verify user_id was set from auth, not body
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: USER_ID, title: "JS Path" })
      );
    });

    it("returns 500 on database error", async () => {
      const qb = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("db") }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await createLearningPath(makeRequest("POST", { title: "Fail" }));
      expect(res.status).toBe(500);
    });
  });

  // ─── GET /api/learning-paths/[id] ────────────────────────────────────────

  describe("GET /api/learning-paths/[id]", () => {
    const params = Promise.resolve({ id: PATH_ID });

    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await getLearningPath(makeRequest("GET"), { params });
      expect(res.status).toBe(401);
    });

    it("returns 404 when path not found", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
      };
      mockSupabase.from.mockReturnValue(pathQb);

      const res = await getLearningPath(makeRequest("GET"), { params });
      expect(res.status).toBe(404);
    });

    it("returns 200 with detail, items, and progress", async () => {
      const pathData = {
        id: PATH_ID,
        user_id: USER_ID,
        title: "JS Path",
        description: "",
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T00:00:00Z",
      };
      const itemsData = [
        {
          id: ITEM_ID,
          learning_path_id: PATH_ID,
          bookmark_id: BM_ID,
          user_id: USER_ID,
          position: 0,
          is_completed: false,
          completed_at: null,
          created_at: "2026-11-09T00:00:00Z",
          updated_at: "2026-11-09T00:00:00Z",
          bookmarks: {
            id: BM_ID,
            user_id: USER_ID,
            title: "Test BM",
            url: "https://test.com",
            tags: [],
            created_at: "2026-11-09T00:00:00Z",
            updated_at: "2026-11-09T00:00:00Z",
            deleted_at: null,
          },
        },
      ];

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // first call: fetch path
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: pathData, error: null }),
          };
        }
        // second call: fetch items
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: itemsData, error: null }),
        };
      });

      const res = await getLearningPath(makeRequest("GET"), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      const lp = json.data.learning_path;
      expect(lp.id).toBe(PATH_ID);
      expect(lp.items).toHaveLength(1);
      expect(lp.total_items).toBe(1);
      expect(lp.completed_items).toBe(0);
      expect(lp.progress_percentage).toBe(0);
      expect(lp.items[0].bookmark).not.toBeNull();
    });

    it("returns null bookmark for soft-deleted bookmark", async () => {
      const pathData = {
        id: PATH_ID,
        user_id: USER_ID,
        title: "Path",
        description: "",
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T00:00:00Z",
      };
      const itemsData = [
        {
          id: ITEM_ID,
          learning_path_id: PATH_ID,
          bookmark_id: BM_ID,
          user_id: USER_ID,
          position: 0,
          is_completed: false,
          completed_at: null,
          created_at: "2026-11-09T00:00:00Z",
          updated_at: "2026-11-09T00:00:00Z",
          bookmarks: {
            id: BM_ID,
            user_id: USER_ID,
            title: "Deleted BM",
            url: "https://deleted.com",
            tags: [],
            created_at: "2026-11-09T00:00:00Z",
            updated_at: "2026-11-09T00:00:00Z",
            deleted_at: "2026-11-09T01:00:00Z", // soft-deleted
          },
        },
      ];

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: pathData, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: itemsData, error: null }),
        };
      });

      const res = await getLearningPath(makeRequest("GET"), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.learning_path.items[0].bookmark).toBeNull();
    });
  });

  // ─── PATCH /api/learning-paths/[id] ──────────────────────────────────────

  describe("PATCH /api/learning-paths/[id]", () => {
    const params = Promise.resolve({ id: PATH_ID });

    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await updateLearningPath(makeRequest("PATCH", { title: "New" }), { params });
      expect(res.status).toBe(401);
    });

    it("returns 404 when path not owned by user", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await updateLearningPath(makeRequest("PATCH", { title: "New" }), { params });
      expect(res.status).toBe(404);
    });

    it("returns 400 when no updatable fields provided", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await updateLearningPath(makeRequest("PATCH", {}), { params });
      expect(res.status).toBe(400);
    });

    it("returns 200 with updated path", async () => {
      const updatedPath = {
        id: PATH_ID,
        user_id: USER_ID,
        title: "Updated Title",
        description: "",
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T01:00:00Z",
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // existence check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        // update
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: updatedPath, error: null }),
        };
      });

      const res = await updateLearningPath(
        makeRequest("PATCH", { title: "Updated Title" }),
        { params }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.learning_path.title).toBe("Updated Title");
    });
  });

  // ─── DELETE /api/learning-paths/[id] ─────────────────────────────────────

  describe("DELETE /api/learning-paths/[id]", () => {
    const params = Promise.resolve({ id: PATH_ID });

    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await deleteLearningPath(makeRequest("DELETE"), { params });
      expect(res.status).toBe(401);
    });

    it("returns 404 when path not found", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("nf") }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await deleteLearningPath(makeRequest("DELETE"), { params });
      expect(res.status).toBe(404);
    });

    it("returns 200 on successful deletion", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        // delete chain: .delete().eq("id",...).eq("user_id",...) → resolves last
        const eqMock = vi.fn().mockReturnThis();
        eqMock.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) });
        return { delete: vi.fn().mockReturnValue({ eq: eqMock }) };
      });

      const res = await deleteLearningPath(makeRequest("DELETE"), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toContain("deleted");
    });
  });

  // ─── POST /api/learning-paths/[id]/items ─────────────────────────────────

  describe("POST /api/learning-paths/[id]/items", () => {
    const params = Promise.resolve({ id: PATH_ID });

    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await addItem(makeRequest("POST", { bookmark_id: BM_ID }), { params });
      expect(res.status).toBe(401);
    });

    it("returns 404 when path not found", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("nf") }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await addItem(makeRequest("POST", { bookmark_id: BM_ID }), { params });
      expect(res.status).toBe(404);
    });

    it("returns 400 when bookmark_id is invalid UUID", async () => {
      // Path found
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await addItem(makeRequest("POST", { bookmark_id: "not-a-uuid" }), { params });
      expect(res.status).toBe(400);
    });

    it("returns 404 when bookmark belongs to another user", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // path exists
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        // bookmark not found (belongs to another user, RLS hides it)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("nf") }),
        };
      });

      const res = await addItem(makeRequest("POST", { bookmark_id: BM_ID }), { params });
      expect(res.status).toBe(404);
    });

    it("returns 400 when bookmark is soft-deleted", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: BM_ID, deleted_at: "2026-11-09T00:00:00Z" },
            error: null,
          }),
        };
      });

      const res = await addItem(makeRequest("POST", { bookmark_id: BM_ID }), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("BOOKMARK_DELETED");
    });

    it("returns 409 when bookmark already in path", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // path found
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        if (callCount === 2) {
          // bookmark found, not deleted
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: BM_ID, deleted_at: null }, error: null }),
          };
        }
        // duplicate check: item already exists
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: ITEM_ID }, error: null }),
        };
      });

      const res = await addItem(makeRequest("POST", { bookmark_id: BM_ID }), { params });
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json.error.code).toBe("DUPLICATE_BOOKMARK");
    });

    it("returns 201 on successful item addition", async () => {
      const newItem = {
        id: ITEM_ID,
        learning_path_id: PATH_ID,
        bookmark_id: BM_ID,
        user_id: USER_ID,
        position: 0,
        is_completed: false,
        completed_at: null,
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T00:00:00Z",
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: BM_ID, deleted_at: null }, error: null }),
          };
        }
        if (callCount === 3) {
          // duplicate check: no duplicate
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (callCount === 4) {
          // max position query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // empty path
          };
        }
        // insert
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: newItem, error: null }),
        };
      });

      const res = await addItem(makeRequest("POST", { bookmark_id: BM_ID }), { params });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.item.id).toBe(ITEM_ID);
      expect(json.data.item.position).toBe(0);
    });
  });

  // ─── PATCH /api/learning-paths/[id]/items/[itemId] ───────────────────────

  describe("PATCH /api/learning-paths/[id]/items/[itemId]", () => {
    const params = Promise.resolve({ id: PATH_ID, itemId: ITEM_ID });

    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await updateItem(makeRequest("PATCH", { is_completed: true }), { params });
      expect(res.status).toBe(401);
    });

    it("returns 404 when path not found", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("nf") }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await updateItem(makeRequest("PATCH", { is_completed: true }), { params });
      expect(res.status).toBe(404);
    });

    it("returns 400 on empty body", async () => {
      // path found
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await updateItem(makeRequest("PATCH", {}), { params });
      expect(res.status).toBe(400);
    });

    it("returns 400 on invalid direction", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await updateItem(makeRequest("PATCH", { direction: "left" }), { params });
      expect(res.status).toBe(400);
    });

    it("returns 404 when item not found", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("nf") }),
        };
      });

      const res = await updateItem(makeRequest("PATCH", { is_completed: true }), { params });
      expect(res.status).toBe(404);
    });

    it("returns 200 toggling is_completed to true", async () => {
      const updatedItem = {
        id: ITEM_ID,
        learning_path_id: PATH_ID,
        bookmark_id: BM_ID,
        user_id: USER_ID,
        position: 0,
        is_completed: true,
        completed_at: "2026-11-09T01:00:00Z",
        created_at: "2026-11-09T00:00:00Z",
        updated_at: "2026-11-09T01:00:00Z",
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // path check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        if (callCount === 2) {
          // item fetch
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: ITEM_ID,
                learning_path_id: PATH_ID,
                bookmark_id: BM_ID,
                user_id: USER_ID,
                position: 0,
                is_completed: false,
                completed_at: null,
                created_at: "2026-11-09T00:00:00Z",
                updated_at: "2026-11-09T00:00:00Z",
              },
              error: null,
            }),
          };
        }
        // update
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: updatedItem, error: null }),
        };
      });

      const res = await updateItem(makeRequest("PATCH", { is_completed: true }), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.item.is_completed).toBe(true);
    });

    it("returns 400 when reordering item at boundary (direction=up at position 0)", async () => {
      const allItems = [{ id: ITEM_ID, position: 0 }];

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        if (callCount === 2) {
          // item fetch
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: ITEM_ID, position: 0 },
              error: null,
            }),
          };
        }
        // all items fetch
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: allItems, error: null }),
        };
      });

      const res = await updateItem(makeRequest("PATCH", { direction: "up" }), { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("REORDER_BOUNDARY");
    });
  });

  // ─── DELETE /api/learning-paths/[id]/items/[itemId] ──────────────────────

  describe("DELETE /api/learning-paths/[id]/items/[itemId]", () => {
    const params = Promise.resolve({ id: PATH_ID, itemId: ITEM_ID });

    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await deleteItem(makeRequest("DELETE"), { params });
      expect(res.status).toBe(401);
    });

    it("returns 404 when path not found", async () => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("nf") }),
      };
      mockSupabase.from.mockReturnValue(qb);

      const res = await deleteItem(makeRequest("DELETE"), { params });
      expect(res.status).toBe(404);
    });

    it("returns 404 when item not found", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("nf") }),
        };
      });

      const res = await deleteItem(makeRequest("DELETE"), { params });
      expect(res.status).toBe(404);
    });

    it("returns 200 and removes item (does not delete original bookmark)", async () => {
      const remainingItems = [
        { id: OTHER_ID, position: 1 }, // was position 1, now should become 0
      ];

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // path check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
          };
        }
        if (callCount === 2) {
          // item check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: ITEM_ID, position: 0 },
              error: null,
            }),
          };
        }
        if (callCount === 3) {
          // delete chain: .delete().eq("id",...).eq("user_id",...) → resolves last
          const eqMock3 = vi.fn().mockReturnThis();
          eqMock3.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) });
          return { delete: vi.fn().mockReturnValue({ eq: eqMock3 }) };
        }
        if (callCount === 4) {
          // remaining items for re-index
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: remainingItems, error: null }),
          };
        }
        // re-index update: .update({}).eq("id",...).eq("user_id",...) → resolves last
        const eqMockReindex = vi.fn().mockReturnThis();
        eqMockReindex.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) });
        return { update: vi.fn().mockReturnValue({ eq: eqMockReindex }) };
      });

      const res = await deleteItem(makeRequest("DELETE"), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toContain("removed");
    });
  });
});
