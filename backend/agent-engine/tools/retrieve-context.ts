/**
 * RAG Context Retrieval Tool
 *
 * Retrieves relevant context from internal knowledge base for grounding.
 * In production, this would integrate with vector databases like Pinecone, Weaviate, etc.
 */
import { z } from "zod";

/**
 * Context chunk interface
 */
export interface ContextChunk {
  content: string;
  source: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Input schema for context retrieval
 */
export const RAGClientSchema = z.object({
  query: z.string(),
  limit: z.number().min(1).max(20).optional(),
});

/**
 * RAGClient - retrieves context from knowledge base
 */
export class RAGClient {
  private knowledgeBase: ContextChunk[];

  constructor() {
    // Initialize mock knowledge base
    this.knowledgeBase = this.initializeKnowledgeBase();
  }

  /**
   * Retrieve relevant context chunks
   *
   * @param query - Search query
   * @param limit - Maximum number of chunks to return (default: 5)
   * @returns Array of relevant context chunks
   */
  async retrieveContext(query: string, limit: number = 5): Promise<ContextChunk[]> {
    // Simulate retrieval delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Search knowledge base for relevant chunks
    const scoredChunks = this.searchKnowledgeBase(query);

    // Sort by relevance score and return top results
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search knowledge base and score chunks
   */
  private searchKnowledgeBase(query: string): ContextChunk[] {
    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery.split(/\s+/);

    return this.knowledgeBase.map((chunk) => {
      // Calculate relevance score based on token overlap
      const lowerContent = chunk.content.toLowerCase();
      const lowerSource = chunk.source.toLowerCase();

      let score = 0;

      // Check for exact phrase match (highest score)
      if (lowerContent.includes(lowerQuery)) {
        score += 0.5;
      }

      // Check for token matches
      for (const token of queryTokens) {
        if (token.length < 3) continue; // Skip short tokens

        if (lowerContent.includes(token)) {
          score += 0.1;
        }

        if (lowerSource.includes(token)) {
          score += 0.05;
        }
      }

      // Add base score from chunk
      score += chunk.score * 0.3;

      return {
        ...chunk,
        score: Math.min(score, 1.0), // Cap at 1.0
      };
    });
  }

  /**
   * Initialize mock knowledge base
   */
  private initializeKnowledgeBase(): ContextChunk[] {
    return [
      // Programming Concepts
      {
        content:
          "Object-oriented programming (OOP) is a programming paradigm based on the concept of objects, which can contain data and code. The four main principles of OOP are encapsulation, abstraction, inheritance, and polymorphism. Encapsulation bundles data and methods together, abstraction hides complex implementation details, inheritance allows classes to inherit properties from parent classes, and polymorphism enables objects to take multiple forms.",
        source: "programming-fundamentals/oop-principles.md",
        score: 0.9,
        metadata: {
          category: "programming",
          topic: "oop",
          lastUpdated: "2024-01-15",
        },
      },
      {
        content:
          "Functional programming is a programming paradigm that treats computation as the evaluation of mathematical functions and avoids changing state and mutable data. Key concepts include pure functions, immutability, first-class functions, higher-order functions, and function composition. Pure functions always return the same output for the same input and have no side effects.",
        source: "programming-fundamentals/functional-programming.md",
        score: 0.88,
        metadata: {
          category: "programming",
          topic: "functional",
          lastUpdated: "2024-01-20",
        },
      },
      {
        content:
          "Asynchronous programming allows programs to handle multiple operations concurrently without blocking execution. In JavaScript and TypeScript, this is achieved through callbacks, promises, and async/await syntax. Async/await provides a cleaner syntax for working with promises, making asynchronous code look and behave more like synchronous code. Always handle errors with try-catch blocks when using async/await.",
        source: "programming-fundamentals/async-programming.md",
        score: 0.87,
        metadata: {
          category: "programming",
          topic: "async",
          lastUpdated: "2024-02-01",
        },
      },

      // API Documentation
      {
        content:
          "REST (Representational State Transfer) is an architectural style for designing networked applications. RESTful APIs use HTTP methods explicitly: GET for retrieving resources, POST for creating new resources, PUT for updating existing resources, PATCH for partial updates, and DELETE for removing resources. URLs should be resource-oriented and use nouns, not verbs. Status codes should be used appropriately: 2xx for success, 4xx for client errors, 5xx for server errors.",
        source: "api-design/rest-principles.md",
        score: 0.92,
        metadata: {
          category: "api",
          topic: "rest",
          lastUpdated: "2024-01-10",
        },
      },
      {
        content:
          "API versioning strategies include URL versioning (e.g., /v1/users), header versioning (using custom headers), and content negotiation (using Accept headers). URL versioning is the most common and easiest to implement. When designing APIs, maintain backward compatibility when possible. Deprecate old versions gradually with clear migration paths. Document all breaking changes and provide migration guides.",
        source: "api-design/versioning.md",
        score: 0.85,
        metadata: {
          category: "api",
          topic: "versioning",
          lastUpdated: "2024-01-25",
        },
      },
      {
        content:
          "API authentication methods include API keys, OAuth 2.0, JWT tokens, and basic authentication. JWT (JSON Web Tokens) are self-contained tokens that include user information and claims. They consist of three parts: header, payload, and signature. JWTs should be signed (and optionally encrypted) to prevent tampering. Store tokens securely and implement proper token refresh mechanisms. Never store sensitive data in JWT payloads as they are only base64 encoded.",
        source: "api-design/authentication.md",
        score: 0.90,
        metadata: {
          category: "api",
          topic: "authentication",
          lastUpdated: "2024-02-05",
        },
      },

      // System Architecture
      {
        content:
          "Microservices architecture is an approach to developing a single application as a suite of small, independently deployable services. Each service runs in its own process and communicates via lightweight mechanisms like HTTP/REST or message queues. Benefits include independent deployment, technology diversity, fault isolation, and scalability. Challenges include distributed system complexity, data consistency, and operational overhead.",
        source: "architecture/microservices.md",
        score: 0.91,
        metadata: {
          category: "architecture",
          topic: "microservices",
          lastUpdated: "2024-01-18",
        },
      },
      {
        content:
          "Event-driven architecture (EDA) is a software architecture pattern promoting the production, detection, consumption, and reaction to events. Events are significant changes in state. EDA enables loose coupling between components, scalability, and real-time processing. Common patterns include event sourcing, CQRS (Command Query Responsibility Segregation), and saga patterns for distributed transactions. Use message brokers like RabbitMQ, Kafka, or AWS SNS/SQS.",
        source: "architecture/event-driven.md",
        score: 0.89,
        metadata: {
          category: "architecture",
          topic: "events",
          lastUpdated: "2024-01-22",
        },
      },
      {
        content:
          "Caching strategies improve application performance by storing frequently accessed data in fast-access storage. Common caching patterns include: cache-aside (lazy loading), write-through (write to cache and database simultaneously), write-behind (asynchronous write), and refresh-ahead (proactive cache updates). Choose cache eviction policies based on access patterns: LRU (Least Recently Used), LFU (Least Frequently Used), or TTL (Time To Live). Popular caching solutions include Redis, Memcached, and CDNs.",
        source: "architecture/caching-strategies.md",
        score: 0.86,
        metadata: {
          category: "architecture",
          topic: "caching",
          lastUpdated: "2024-02-10",
        },
      },

      // Best Practices
      {
        content:
          "Code review best practices: Review small changes frequently rather than large changes infrequently. Focus on logic, design, and maintainability, not just syntax. Be constructive and respectful in feedback. Look for security vulnerabilities, performance issues, and edge cases. Ensure tests are included and documentation is updated. Use automated tools for style checking. Reviews should be completed within 24 hours to maintain development velocity.",
        source: "best-practices/code-reviews.md",
        score: 0.84,
        metadata: {
          category: "practices",
          topic: "code-review",
          lastUpdated: "2024-01-12",
        },
      },
      {
        content:
          "Error handling best practices: Always handle errors explicitly, never silently fail. Use specific error types for different error conditions. Include context in error messages (what failed, why, and how to fix). Log errors with appropriate severity levels. In APIs, return meaningful error responses with proper status codes. Implement retry logic with exponential backoff for transient failures. Use circuit breakers for external service calls. Never expose sensitive information in error messages.",
        source: "best-practices/error-handling.md",
        score: 0.88,
        metadata: {
          category: "practices",
          topic: "errors",
          lastUpdated: "2024-01-28",
        },
      },
      {
        content:
          "Database design best practices: Normalize data to reduce redundancy but denormalize when necessary for performance. Use appropriate data types and constraints. Index columns used in WHERE, JOIN, and ORDER BY clauses. Avoid N+1 queries by using proper joins or eager loading. Use transactions for data consistency. Implement soft deletes for audit trails. Use connection pooling for better resource management. Regular database maintenance including vacuum, analyze, and index rebuilding improves performance.",
        source: "best-practices/database-design.md",
        score: 0.87,
        metadata: {
          category: "practices",
          topic: "database",
          lastUpdated: "2024-02-03",
        },
      },

      // Security
      {
        content:
          "SQL injection prevention: Never concatenate user input directly into SQL queries. Use parameterized queries or prepared statements. Validate and sanitize all user inputs. Apply the principle of least privilege to database users. Escape special characters when building dynamic queries. Use ORM frameworks that handle parameterization automatically. Implement input validation on both client and server sides. Regular security audits and penetration testing help identify vulnerabilities.",
        source: "security/sql-injection.md",
        score: 0.93,
        metadata: {
          category: "security",
          topic: "sql-injection",
          lastUpdated: "2024-01-08",
        },
      },
      {
        content:
          "Cross-Site Scripting (XSS) prevention: Sanitize and encode all user-generated content before displaying. Use Content Security Policy (CSP) headers. Escape HTML, JavaScript, and CSS contexts appropriately. Use frameworks that auto-escape output by default. Validate input types and formats. Use HTTPOnly and Secure flags on cookies. Implement proper authentication and session management. Regular dependency updates patch known vulnerabilities.",
        source: "security/xss-prevention.md",
        score: 0.91,
        metadata: {
          category: "security",
          topic: "xss",
          lastUpdated: "2024-01-30",
        },
      },

      // Performance
      {
        content:
          "Database query optimization techniques: Use EXPLAIN/ANALYZE to understand query execution plans. Add indexes on frequently queried columns. Avoid SELECT * and only retrieve needed columns. Use appropriate JOIN types and order. Implement pagination for large result sets. Use database views for complex queries used frequently. Consider materialized views for expensive aggregations. Monitor slow query logs and optimize bottlenecks. Use database-specific features like table partitioning for very large tables.",
        source: "performance/query-optimization.md",
        score: 0.89,
        metadata: {
          category: "performance",
          topic: "queries",
          lastUpdated: "2024-02-08",
        },
      },
      {
        content:
          "Frontend performance optimization: Minimize bundle size through code splitting and tree shaking. Lazy load components and routes. Optimize images with compression and modern formats (WebP, AVIF). Use CDN for static assets. Implement caching strategies with service workers. Reduce JavaScript execution time. Use virtual scrolling for long lists. Implement skeleton screens for perceived performance. Monitor Core Web Vitals: LCP, FID, and CLS. Use performance budgets to prevent regression.",
        source: "performance/frontend-optimization.md",
        score: 0.88,
        metadata: {
          category: "performance",
          topic: "frontend",
          lastUpdated: "2024-02-12",
        },
      },
    ];
  }

  /**
   * Add new context to knowledge base (for testing)
   */
  addContext(chunk: ContextChunk): void {
    this.knowledgeBase.push(chunk);
  }

  /**
   * Clear knowledge base (for testing)
   */
  clearKnowledgeBase(): void {
    this.knowledgeBase = [];
  }

  /**
   * Get knowledge base size
   */
  getKnowledgeBaseSize(): number {
    return this.knowledgeBase.length;
  }
}

/**
 * Singleton instance
 */
export const ragClient = new RAGClient();
