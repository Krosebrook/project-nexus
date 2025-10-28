/**
 * Google Search Tool Tests
 */
import { describe, it, expect } from "vitest";
import { GoogleSearchTool } from "./google-search";

describe("GoogleSearchTool", () => {
  const searchTool = new GoogleSearchTool();

  describe("search", () => {
    it("should return search results for AI query", async () => {
      const results = await searchTool.search("artificial intelligence", 5);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("url");
      expect(results[0]).toHaveProperty("snippet");
      expect(results[0]).toHaveProperty("score");
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("should return search results for programming query", async () => {
      const results = await searchTool.search("typescript programming", 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBeTruthy();
      expect(results[0].url).toMatch(/^https?:\/\//);
    });

    it("should respect limit parameter", async () => {
      const results = await searchTool.search("machine learning", 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should use default limit of 5", async () => {
      const results = await searchTool.search("api design");

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("should sort results by score in descending order", async () => {
      const results = await searchTool.search("cloud computing", 5);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it("should return generic results for unknown queries", async () => {
      const results = await searchTool.search("xyz random query 123", 3);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toContain("xyz random query 123");
    });

    it("should handle database queries", async () => {
      const results = await searchTool.search("postgresql database", 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.title.toLowerCase().includes("postgresql"))).toBe(true);
    });

    it("should handle security queries", async () => {
      const results = await searchTool.search("security authentication", 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r =>
        r.title.toLowerCase().includes("security") ||
        r.title.toLowerCase().includes("authentication")
      )).toBe(true);
    });

    it("should include score in all results", async () => {
      const results = await searchTool.search("api integration", 5);

      results.forEach(result => {
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe("getSuggestions", () => {
    it("should return suggestions for prefix starting with 'a'", async () => {
      const suggestions = await searchTool.getSuggestions("a");

      expect(suggestions).toHaveLength(4);
      expect(suggestions).toContain("artificial intelligence");
      expect(suggestions).toContain("api design");
    });

    it("should return suggestions for prefix starting with 'm'", async () => {
      const suggestions = await searchTool.getSuggestions("m");

      expect(suggestions).toHaveLength(4);
      expect(suggestions).toContain("machine learning");
      expect(suggestions).toContain("microservices");
    });

    it("should return suggestions for prefix starting with 'p'", async () => {
      const suggestions = await searchTool.getSuggestions("p");

      expect(suggestions).toHaveLength(4);
      expect(suggestions).toContain("programming languages");
      expect(suggestions).toContain("postgresql");
    });

    it("should return generic suggestions for other prefixes", async () => {
      const suggestions = await searchTool.getSuggestions("xyz");

      expect(suggestions.length).toBeLessThanOrEqual(5);
      expect(suggestions.some(s => s.includes("xyz"))).toBe(true);
    });

    it("should handle empty prefix", async () => {
      const suggestions = await searchTool.getSuggestions("");

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("should limit suggestions to 5", async () => {
      const suggestions = await searchTool.getSuggestions("test");

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });
});
