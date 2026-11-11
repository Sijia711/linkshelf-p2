import { describe, it, expect } from "vitest";
import {
  validateCreateLearningPathInput,
  validateUpdateLearningPathInput,
  validateAddPathItemInput,
  calculateProgress,
  reorderItems,
  extractDomain,
} from "@/lib/learning-paths";

describe("Learning Paths Pure Helpers & Validation", () => {
  describe("validateCreateLearningPathInput", () => {
    it("should accept valid title and description", () => {
      const result = validateCreateLearningPathInput({
        title: "Mastering Next.js 16",
        description: "A complete step-by-step path for Next.js App Router.",
      });
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        title: "Mastering Next.js 16",
        description: "A complete step-by-step path for Next.js App Router.",
      });
    });

    it("should accept valid title without description", () => {
      const result = validateCreateLearningPathInput({
        title: "TypeScript Deep Dive",
      });
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        title: "TypeScript Deep Dive",
        description: "",
      });
    });

    it("should reject empty or whitespace title", () => {
      expect(validateCreateLearningPathInput({ title: "" }).isValid).toBe(false);
      expect(validateCreateLearningPathInput({ title: "   " }).isValid).toBe(false);
      expect(validateCreateLearningPathInput(null).isValid).toBe(false);
    });

    it("should reject title exceeding 255 characters", () => {
      const longTitle = "a".repeat(256);
      const result = validateCreateLearningPathInput({ title: longTitle });
      expect(result.isValid).toBe(false);
      expect(result.errors.title).toBeDefined();
    });

    it("should reject description exceeding 2000 characters", () => {
      const longDesc = "a".repeat(2001);
      const result = validateCreateLearningPathInput({
        title: "Valid Title",
        description: longDesc,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.description).toBeDefined();
    });
  });

  describe("validateUpdateLearningPathInput", () => {
    it("should accept partial updates", () => {
      const res1 = validateUpdateLearningPathInput({ title: "Updated Title" });
      expect(res1.isValid).toBe(true);
      expect(res1.data).toEqual({ title: "Updated Title" });

      const res2 = validateUpdateLearningPathInput({ description: "New summary" });
      expect(res2.isValid).toBe(true);
      expect(res2.data).toEqual({ description: "New summary" });
    });

    it("should reject empty update objects", () => {
      const result = validateUpdateLearningPathInput({});
      expect(result.isValid).toBe(false);
      expect(result.errors._general).toBeDefined();
    });
  });

  describe("validateAddPathItemInput", () => {
    it("should accept valid bookmark UUID", () => {
      const uuid = "a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d";
      const result = validateAddPathItemInput({ bookmark_id: uuid });
      expect(result.isValid).toBe(true);
      expect(result.bookmark_id).toBe(uuid);
    });

    it("should reject missing or non-UUID bookmark_id", () => {
      expect(validateAddPathItemInput({}).isValid).toBe(false);
      expect(validateAddPathItemInput({ bookmark_id: "not-a-uuid" }).isValid).toBe(false);
      expect(validateAddPathItemInput(null).isValid).toBe(false);
    });
  });

  describe("calculateProgress", () => {
    it("should return 0% progress for empty or null item list", () => {
      expect(calculateProgress([])).toEqual({
        total_items: 0,
        completed_items: 0,
        progress_percentage: 0,
      });
      expect(calculateProgress(null)).toEqual({
        total_items: 0,
        completed_items: 0,
        progress_percentage: 0,
      });
    });

    it("should calculate correct percentage for partially completed items", () => {
      const items = [
        { is_completed: true },
        { is_completed: false },
        { is_completed: true },
        { is_completed: false },
      ];
      expect(calculateProgress(items)).toEqual({
        total_items: 4,
        completed_items: 2,
        progress_percentage: 50,
      });
    });

    it("should round percentage correctly", () => {
      const items = [
        { is_completed: true },
        { is_completed: false },
        { is_completed: false },
      ]; // 1 / 3 = 33.33% -> 33%
      expect(calculateProgress(items)).toEqual({
        total_items: 3,
        completed_items: 1,
        progress_percentage: 33,
      });
    });

    it("should return 100% when all items are complete", () => {
      const items = [{ is_completed: true }, { is_completed: true }];
      expect(calculateProgress(items)).toEqual({
        total_items: 2,
        completed_items: 2,
        progress_percentage: 100,
      });
    });
  });

  describe("reorderItems", () => {
    const list = [
      { id: "1", position: 0, name: "First" },
      { id: "2", position: 1, name: "Second" },
      { id: "3", position: 2, name: "Third" },
    ];

    it("should move item up when not at first index", () => {
      const { updated, items } = reorderItems(list, "2", "up");
      expect(updated).toBe(true);
      expect(items[0].id).toBe("2");
      expect(items[0].position).toBe(0);
      expect(items[1].id).toBe("1");
      expect(items[1].position).toBe(1);
    });

    it("should not move item up if already at first position", () => {
      const { updated, items } = reorderItems(list, "1", "up");
      expect(updated).toBe(false);
      expect(items).toEqual(list);
    });

    it("should move item down when not at last index", () => {
      const { updated, items } = reorderItems(list, "2", "down");
      expect(updated).toBe(true);
      expect(items[1].id).toBe("3");
      expect(items[1].position).toBe(1);
      expect(items[2].id).toBe("2");
      expect(items[2].position).toBe(2);
    });

    it("should not move item down if already at last position", () => {
      const { updated, items } = reorderItems(list, "3", "down");
      expect(updated).toBe(false);
      expect(items).toEqual(list);
    });
  });

  describe("extractDomain", () => {
    it("should extract hostname without www prefix", () => {
      expect(extractDomain("https://www.youtube.com/watch?v=123")).toBe("youtube.com");
      expect(extractDomain("https://youtube.com/playlist")).toBe("youtube.com");
      expect(extractDomain("http://www.github.com/facebook/react")).toBe("github.com");
    });

    it("should handle subdomains accurately", () => {
      expect(extractDomain("https://docs.python.org/3/tutorial/")).toBe("docs.python.org");
      expect(extractDomain("https://nextjs.org/docs")).toBe("nextjs.org");
    });

    it("should fall back gracefully to original input if URL is malformed", () => {
      expect(extractDomain("not-a-valid-url")).toBe("not-a-valid-url");
    });
  });
});
