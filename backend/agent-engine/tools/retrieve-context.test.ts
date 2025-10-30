/**
 * RAG Context Retrieval Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RAGClient } from "./retrieve-context";

describe("RAGClient", () => {
  let ragClient: RAGClient;

  beforeEach(() => {
    ragClient = new RAGClient();
  });

  describe("retrieveContext", () => {
    it("should retrieve context for OOP query", async () => {
      const chunks = await ragClient.retrieveContext(
        "object oriented programming",
        5
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty("content");
      expect(chunks[0]).toHaveProperty("source");
      expect(chunks[0]).toHaveProperty("score");
      expect(chunks[0].content.toLowerCase()).toContain("object");
    });

    it("should retrieve context for API query", async () => {
      const chunks = await ragClient.retrieveContext("REST API design", 3);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThanOrEqual(3);
      expect(chunks[0].content.toLowerCase()).toMatch(/rest|api/);
    });

    it("should retrieve context for architecture query", async () => {
      const chunks = await ragClient.retrieveContext("microservices architecture", 5);

      expect(chunks.length).toBeGreaterThan(0);
      const topChunk = chunks[0];
      expect(topChunk.content.toLowerCase()).toContain("microservices");
    });

    it("should retrieve context for security query", async () => {
      const chunks = await ragClient.retrieveContext("SQL injection prevention", 5);

      expect(chunks.length).toBeGreaterThan(0);
      const topChunk = chunks[0];
      expect(topChunk.content.toLowerCase()).toMatch(/sql|injection/);
    });

    it("should retrieve context for performance query", async () => {
      const chunks = await ragClient.retrieveContext("database optimization", 5);

      expect(chunks.length).toBeGreaterThan(0);
      const topChunk = chunks[0];
      expect(topChunk.content.toLowerCase()).toMatch(/database|query|optimization/);
    });

    it("should respect limit parameter", async () => {
      const chunks = await ragClient.retrieveContext("programming", 3);

      expect(chunks.length).toBeLessThanOrEqual(3);
    });

    it("should use default limit of 5", async () => {
      const chunks = await ragClient.retrieveContext("programming");

      expect(chunks.length).toBeLessThanOrEqual(5);
    });

    it("should return chunks sorted by relevance score", async () => {
      const chunks = await ragClient.retrieveContext("async programming", 5);

      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i].score).toBeGreaterThanOrEqual(chunks[i + 1].score);
      }
    });

    it("should include metadata in chunks", async () => {
      const chunks = await ragClient.retrieveContext("API authentication", 5);

      expect(chunks.length).toBeGreaterThan(0);
      const topChunk = chunks[0];
      expect(topChunk.metadata).toBeDefined();
      if (topChunk.metadata) {
        expect(topChunk.metadata.category).toBeDefined();
      }
    });

    it("should handle multi-word queries", async () => {
      const chunks = await ragClient.retrieveContext(
        "event driven architecture patterns",
        5
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].score).toBeGreaterThan(0);
    });

    it("should handle queries with common topics", async () => {
      const chunks = await ragClient.retrieveContext("best practices", 5);

      expect(chunks.length).toBeGreaterThan(0);
      const topChunk = chunks[0];
      expect(topChunk.content.toLowerCase()).toContain("practice");
    });

    it("should return all chunks with valid scores", async () => {
      const chunks = await ragClient.retrieveContext("caching", 10);

      chunks.forEach((chunk) => {
        expect(chunk.score).toBeGreaterThan(0);
        expect(chunk.score).toBeLessThanOrEqual(1.0);
      });
    });

    it("should return all chunks with valid sources", async () => {
      const chunks = await ragClient.retrieveContext("programming", 5);

      chunks.forEach((chunk) => {
        expect(chunk.source).toBeTruthy();
        expect(chunk.source).toMatch(/\.md$/);
      });
    });

    it("should handle exact phrase matches", async () => {
      const chunks = await ragClient.retrieveContext(
        "pure functions always return the same output",
        5
      );

      expect(chunks.length).toBeGreaterThan(0);
      const topChunk = chunks[0];
      expect(topChunk.content.toLowerCase()).toContain("pure function");
    });

    it("should handle case-insensitive queries", async () => {
      const chunks1 = await ragClient.retrieveContext("REST API", 3);
      const chunks2 = await ragClient.retrieveContext("rest api", 3);

      expect(chunks1.length).toBe(chunks2.length);
      expect(chunks1[0].content).toBe(chunks2[0].content);
    });
  });

  describe("addContext", () => {
    it("should add new context to knowledge base", () => {
      const initialSize = ragClient.getKnowledgeBaseSize();

      ragClient.addContext({
        content: "Test content about testing",
        source: "test/testing.md",
        score: 0.8,
        metadata: { category: "testing" },
      });

      expect(ragClient.getKnowledgeBaseSize()).toBe(initialSize + 1);
    });

    it("should make added context retrievable", async () => {
      ragClient.addContext({
        content: "This is a unique test phrase for retrieval",
        source: "test/unique.md",
        score: 0.9,
        metadata: { category: "test" },
      });

      const chunks = await ragClient.retrieveContext("unique test phrase", 5);

      expect(chunks.some((c) => c.content.includes("unique test phrase"))).toBe(true);
    });
  });

  describe("clearKnowledgeBase", () => {
    it("should clear all context from knowledge base", () => {
      ragClient.clearKnowledgeBase();

      expect(ragClient.getKnowledgeBaseSize()).toBe(0);
    });

    it("should return empty results after clearing", async () => {
      ragClient.clearKnowledgeBase();

      const chunks = await ragClient.retrieveContext("anything", 5);

      expect(chunks).toEqual([]);
    });
  });

  describe("getKnowledgeBaseSize", () => {
    it("should return correct size of knowledge base", () => {
      const size = ragClient.getKnowledgeBaseSize();

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe("number");
    });

    it("should update size when adding context", () => {
      const initialSize = ragClient.getKnowledgeBaseSize();

      ragClient.addContext({
        content: "New content",
        source: "test.md",
        score: 0.8,
      });

      expect(ragClient.getKnowledgeBaseSize()).toBe(initialSize + 1);
    });
  });

  describe("scoring algorithm", () => {
    it("should give higher scores to exact phrase matches", async () => {
      const chunks = await ragClient.retrieveContext(
        "Object-oriented programming",
        10
      );

      const topChunk = chunks[0];
      expect(topChunk.score).toBeGreaterThan(0.5);
    });

    it("should score based on token overlap", async () => {
      const chunks = await ragClient.retrieveContext(
        "database query performance",
        5
      );

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.score).toBeGreaterThan(0);
      });
    });

    it("should consider source matching", async () => {
      const chunks = await ragClient.retrieveContext("api", 10);

      expect(chunks.some((c) => c.source.includes("api"))).toBe(true);
    });
  });
});
