import { describe, it, expect } from "vitest";
import {
  validateCreateLearningPathInput,
  validateUpdateLearningPathInput,
  validateAddPathItemInput,
  validateProgressPercentage,
  getResourceStatus,
  getResourceStatusLabel,
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

    it("should calculate arithmetic mean of percentage items truncated to an integer", () => {
      // 30% and 25%: sum = 55, mean = 27.5 -> truncated to 27% (NOT rounded to 28%)
      const items1 = [
        { progress_percentage: 30 },
        { progress_percentage: 25 },
      ];
      expect(calculateProgress(items1)).toEqual({
        total_items: 2,
        completed_items: 0,
        progress_percentage: 27,
      });

      // 100%, 100%, 99%: sum = 299, mean = 99.666 -> truncated to 99%
      const items2 = [
        { progress_percentage: 100 },
        { progress_percentage: 100 },
        { progress_percentage: 99 },
      ];
      expect(calculateProgress(items2)).toEqual({
        total_items: 3,
        completed_items: 2,
        progress_percentage: 99,
      });
    });

    it("should truncate percentage correctly toward zero", () => {
      const items = [
        { is_completed: true },
        { is_completed: false },
        { is_completed: false },
      ]; // 1 / 3 = 33.33% -> truncated to 33%
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

  describe("validateProgressPercentage", () => {
    it("should accept valid integers 0, 30, 75, 100", () => {
      expect(validateProgressPercentage(0)).toEqual({ isValid: true, value: 0 });
      expect(validateProgressPercentage(30)).toEqual({ isValid: true, value: 30 });
      expect(validateProgressPercentage(75)).toEqual({ isValid: true, value: 75 });
      expect(validateProgressPercentage(100)).toEqual({ isValid: true, value: 100 });
      expect(validateProgressPercentage("50")).toEqual({ isValid: true, value: 50 });
    });

    it("should truncate decimal inputs toward zero (e.g. 20.78 -> 20, NOT rounded to 21)", () => {
      const res = validateProgressPercentage(20.78);
      expect(res.isValid).toBe(true);
      expect(res.value).toBe(20);

      const strRes = validateProgressPercentage("20.78");
      expect(strRes.isValid).toBe(true);
      expect(strRes.value).toBe(20);
    });

    it("should reject numbers outside 0 through 100", () => {
      expect(validateProgressPercentage(120).isValid).toBe(false);
      expect(validateProgressPercentage(-20).isValid).toBe(false);
      expect(validateProgressPercentage(100.1).isValid).toBe(false);
      expect(validateProgressPercentage(-0.1).isValid).toBe(false);
    });

    it("should reject blank, NaN, Infinity, and non-numeric values", () => {
      expect(validateProgressPercentage("").isValid).toBe(false);
      expect(validateProgressPercentage("   ").isValid).toBe(false);
      expect(validateProgressPercentage(NaN).isValid).toBe(false);
      expect(validateProgressPercentage(Infinity).isValid).toBe(false);
      expect(validateProgressPercentage(-Infinity).isValid).toBe(false);
      expect(validateProgressPercentage("abc").isValid).toBe(false);
      expect(validateProgressPercentage(null).isValid).toBe(false);
      expect(validateProgressPercentage(undefined).isValid).toBe(false);
      expect(validateProgressPercentage({})).toEqual(expect.objectContaining({ isValid: false }));
    });
  });

  describe("getResourceStatus and getResourceStatusLabel", () => {
    it("classifies 0 as not_started", () => {
      expect(getResourceStatus(0)).toBe("not_started");
      expect(getResourceStatusLabel(0)).toBe("Not Started");
    });

    it("classifies 1..99 as in_progress", () => {
      expect(getResourceStatus(1)).toBe("in_progress");
      expect(getResourceStatusLabel(1)).toBe("In Progress");
      expect(getResourceStatus(50)).toBe("in_progress");
      expect(getResourceStatusLabel(50)).toBe("In Progress");
      expect(getResourceStatus(99)).toBe("in_progress");
      expect(getResourceStatusLabel(99)).toBe("In Progress");
    });

    it("classifies 100 as completed", () => {
      expect(getResourceStatus(100)).toBe("completed");
      expect(getResourceStatusLabel(100)).toBe("Completed");
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
