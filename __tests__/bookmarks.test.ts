import { describe, it, expect } from "vitest";
import {
  validateTitle,
  validateUrl,
  normalizeTags,
  validateCreateBookmarkInput,
  validateUpdateBookmarkInput,
} from "@/lib/bookmarks";

describe("Bookmark Validation Helpers (Pure Logic)", () => {
  describe("validateTitle", () => {
    it("should accept valid trimmed titles", () => {
      const result = validateTitle("LinkShelf Dashboard");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("LinkShelf Dashboard");
    });

    it("should trim surrounding whitespace from titles", () => {
      const result = validateTitle("  Next.js 16 Overview   ");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("Next.js 16 Overview");
    });

    it("should reject empty or whitespace-only titles", () => {
      expect(validateTitle("").isValid).toBe(false);
      expect(validateTitle("   ").isValid).toBe(false);
      expect(validateTitle("").error).toBe("Title is required.");
    });

    it("should reject titles exceeding 255 characters", () => {
      const longTitle = "a".repeat(256);
      const result = validateTitle(longTitle);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("255 characters");
    });
  });

  describe("validateUrl", () => {
    it("should accept valid http:// and https:// URLs", () => {
      expect(validateUrl("https://example.com").isValid).toBe(true);
      expect(validateUrl("http://localhost:3000").isValid).toBe(true);
      expect(validateUrl("https://nextjs.org/docs?lang=ts#section").isValid).toBe(true);
    });

    it("should trim surrounding whitespace before validating", () => {
      const result = validateUrl("  https://vitest.dev  ");
      expect(result.isValid).toBe(true);
      expect(result.value).toBe("https://vitest.dev");
    });

    it("should reject malicious protocols such as javascript:", () => {
      const result = validateUrl("javascript:alert('XSS')");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("URL must use http:// or https:// protocol.");
    });

    it("should reject unsupported protocols such as ftp:, data:, file:", () => {
      expect(validateUrl("ftp://ftp.example.com").isValid).toBe(false);
      expect(validateUrl("data:text/html,test").isValid).toBe(false);
      expect(validateUrl("file:///etc/passwd").isValid).toBe(false);
    });

    it("should reject malformed or non-URL strings", () => {
      expect(validateUrl("not a url").isValid).toBe(false);
      expect(validateUrl("").isValid).toBe(false);
      expect(validateUrl("https://").isValid).toBe(false);
    });
  });

  describe("normalizeTags", () => {
    it("should convert tags to lowercase and trim whitespace", () => {
      const tags = ["  React  ", "NextJS", " TYPESCRIPT "];
      expect(normalizeTags(tags)).toEqual(["react", "nextjs", "typescript"]);
    });

    it("should deduplicate tags case-insensitively", () => {
      const tags = ["frontend", "Frontend", "FRONTEND", "css"];
      expect(normalizeTags(tags)).toEqual(["frontend", "css"]);
    });

    it("should remove empty or whitespace-only tags", () => {
      const tags = ["", "   ", "javascript", "   "];
      expect(normalizeTags(tags)).toEqual(["javascript"]);
    });

    it("should return an empty array if tags is undefined or empty", () => {
      expect(normalizeTags(undefined)).toEqual([]);
      expect(normalizeTags([])).toEqual([]);
    });
  });

  describe("validateCreateBookmarkInput", () => {
    it("should return valid result with normalized data for correct payload", () => {
      const input = {
        title: "  Google  ",
        url: "https://www.google.com",
        tags: [" Search ", "tools", "SEARCH"],
      };
      const result = validateCreateBookmarkInput(input);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({
        title: "Google",
        url: "https://www.google.com",
        tags: ["search", "tools"],
      });
      expect(result.errors).toEqual({});
    });

    it("should collect all errors when multiple fields are invalid", () => {
      const input = {
        title: "   ",
        url: "javascript:evil()",
        tags: ["valid"],
      };
      const result = validateCreateBookmarkInput(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.title).toBeDefined();
      expect(result.errors.url).toBeDefined();
    });
  });

  describe("validateUpdateBookmarkInput", () => {
    it("should allow partial update of only title", () => {
      const result = validateUpdateBookmarkInput({ title: "New Title" });
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ title: "New Title" });
    });

    it("should allow partial update of only url", () => {
      const result = validateUpdateBookmarkInput({ url: "https://new.dev" });
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ url: "https://new.dev" });
    });

    it("should allow partial update of only tags", () => {
      const result = validateUpdateBookmarkInput({ tags: ["DEV", "prod"] });
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ tags: ["dev", "prod"] });
    });

    it("should reject update if no fields are supplied", () => {
      const result = validateUpdateBookmarkInput({});
      expect(result.isValid).toBe(false);
      expect(result.errors._general).toBeDefined();
    });

    it("should reject update if provided field is invalid", () => {
      const result = validateUpdateBookmarkInput({ url: "ftp://invalid" });
      expect(result.isValid).toBe(false);
      expect(result.errors.url).toBeDefined();
    });
  });
});
