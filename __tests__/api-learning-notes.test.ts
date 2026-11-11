import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GET as getPathNotes,
  PUT as putPathNotes,
  PATCH as patchPathNotes,
} from "@/app/api/learning-paths/[id]/notes/route";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_EMPTY_NOTE_DOC } from "@/lib/learning-notes";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PATH_ID = "22222222-2222-4222-8222-222222222222";
const NOTE_ID = "33333333-3333-4333-8333-333333333333";

const mockUser = { id: USER_ID, email: "user@example.com" };

function makeRequest(method: string, body?: unknown, url = `http://localhost:3000/api/learning-paths/${PATH_ID}/notes`) {
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

describe("Learning Path Notes REST API (/api/learning-paths/[id]/notes)", () => {
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

  describe("GET /api/learning-paths/[id]/notes", () => {
    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await getPathNotes(makeRequest("GET"), { params: Promise.resolve({ id: PATH_ID }) });
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 404 when learning path does not exist or belongs to another user", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
      };
      mockSupabase.from.mockReturnValue(pathQb);

      const res = await getPathNotes(makeRequest("GET"), { params: Promise.resolve({ id: PATH_ID }) });
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("returns 200 with default empty document when no notebook exists yet", async () => {
      // 1. Path lookup succeeds
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      // 2. Note lookup returns null (not yet created)
      const noteQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(noteQb);

      const res = await getPathNotes(makeRequest("GET"), { params: Promise.resolve({ id: PATH_ID }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.note).not.toBeNull();
      expect(json.data.note.content).toEqual(DEFAULT_EMPTY_NOTE_DOC);
      expect(json.data.note.learning_path_id).toBe(PATH_ID);
    });

    it("returns 200 with existing note when found", async () => {
      const existingNote = {
        id: NOTE_ID,
        user_id: USER_ID,
        learning_path_id: PATH_ID,
        content: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Saved notes" }] }],
        },
        created_at: "2026-11-10T12:00:00Z",
        updated_at: "2026-11-10T12:00:00Z",
      };

      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      const noteQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existingNote, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(noteQb);

      const res = await getPathNotes(makeRequest("GET"), { params: Promise.resolve({ id: PATH_ID }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.note).toEqual(existingNote);
    });

    it("returns 500 when database error occurs during note lookup", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      const noteQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "DB failure" } }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(noteQb);

      const res = await getPathNotes(makeRequest("GET"), { params: Promise.resolve({ id: PATH_ID }) });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("PUT /api/learning-paths/[id]/notes", () => {
    it("returns 401 when unauthenticated", async () => {
      setUnauthenticated();
      const res = await putPathNotes(
        makeRequest("PUT", { content: DEFAULT_EMPTY_NOTE_DOC }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("enforces cross-user isolation: returns 404 when learning path belongs to another user", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "Path not found or not owned by user" } }),
      };
      mockSupabase.from.mockReturnValue(pathQb);

      const res = await putPathNotes(
        makeRequest("PUT", { content: DEFAULT_EMPTY_NOTE_DOC }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 VALIDATION_ERROR on invalid Tiptap structure", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };
      mockSupabase.from.mockReturnValue(pathQb);

      const res = await putPathNotes(
        makeRequest("PUT", { content: { type: "invalidRoot" } }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("subsequent save: updates existing note directly without inserting", async () => {
      const validDoc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Attention Mechanisms" }],
          },
        ],
      };

      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      const updatedResult = {
        id: NOTE_ID,
        user_id: USER_ID,
        learning_path_id: PATH_ID,
        content: validDoc,
        created_at: "2026-11-10T12:00:00Z",
        updated_at: "2026-11-10T12:05:00Z",
      };

      const updateMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: updatedResult, error: null });

      const noteQb = {
        update: updateMock,
        eq: eqMock,
        select: selectMock,
        maybeSingle: maybeSingleMock,
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(noteQb);

      const res = await putPathNotes(
        makeRequest("PUT", { content: validDoc }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.note).toEqual(updatedResult);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: validDoc,
        })
      );
      expect(eqMock).toHaveBeenCalledWith("learning_path_id", PATH_ID);
      expect(eqMock).toHaveBeenCalledWith("user_id", USER_ID);
    });

    it("first save: inserts new note when no existing note is found", async () => {
      const validDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "First note draft" }],
          },
        ],
      };

      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      // 1. Update attempt finds no row
      const updateQb = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertedResult = {
        id: NOTE_ID,
        user_id: USER_ID,
        learning_path_id: PATH_ID,
        content: validDoc,
        created_at: "2026-11-10T12:00:00Z",
        updated_at: "2026-11-10T12:00:00Z",
      };

      // 2. Insert creates the new row
      const insertMock = vi.fn().mockReturnThis();
      const insertQb = {
        insert: insertMock,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedResult, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(updateQb)
        .mockReturnValueOnce(insertQb);

      const res = await putPathNotes(
        makeRequest("PUT", { content: validDoc }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.note).toEqual(insertedResult);
      expect(insertMock).toHaveBeenCalledWith({
        learning_path_id: PATH_ID,
        user_id: USER_ID,
        content: validDoc,
      });
    });

    it("concurrency: handles 23505 unique conflict during concurrent first save and retries update", async () => {
      const validDoc = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Concurrent note edit" }] }],
      };

      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      // 1. Initial update finds no existing row
      const initialUpdateQb = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // 2. Insert fails due to unique constraint race condition (another request inserted it first)
      const insertQb = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        }),
      };

      // 3. Retry update succeeds on the newly created row
      const retriedResult = {
        id: NOTE_ID,
        user_id: USER_ID,
        learning_path_id: PATH_ID,
        content: validDoc,
        created_at: "2026-11-10T12:00:00Z",
        updated_at: "2026-11-10T12:00:01Z",
      };

      const retryUpdateQb = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: retriedResult, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(initialUpdateQb)
        .mockReturnValueOnce(insertQb)
        .mockReturnValueOnce(retryUpdateQb);

      const res = await putPathNotes(
        makeRequest("PUT", { content: validDoc }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.note).toEqual(retriedResult);
    });

    it("returns 500 when database update fails with unexpected error", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      const updateQb = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "Database connection failed" } }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(updateQb);

      const res = await putPathNotes(
        makeRequest("PUT", { content: DEFAULT_EMPTY_NOTE_DOC }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });

    it("returns 500 when database insert fails with non-conflict error", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      const updateQb = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertQb = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: "40001", message: "Serialization failure" } }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(updateQb)
        .mockReturnValueOnce(insertQb);

      const res = await putPathNotes(
        makeRequest("PUT", { content: DEFAULT_EMPTY_NOTE_DOC }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("PATCH /api/learning-paths/[id]/notes", () => {
    it("functions as an alias for PUT", async () => {
      const pathQb = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PATH_ID }, error: null }),
      };

      const updatedResult = {
        id: NOTE_ID,
        user_id: USER_ID,
        learning_path_id: PATH_ID,
        content: DEFAULT_EMPTY_NOTE_DOC,
        created_at: "2026-11-10T12:00:00Z",
        updated_at: "2026-11-10T12:01:00Z",
      };

      const updateQb = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: updatedResult, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(pathQb)
        .mockReturnValueOnce(updateQb);

      const res = await patchPathNotes(
        makeRequest("PATCH", { content: DEFAULT_EMPTY_NOTE_DOC }),
        { params: Promise.resolve({ id: PATH_ID }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.note).toEqual(updatedResult);
    });
  });
});
