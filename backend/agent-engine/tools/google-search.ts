/**
 * Google Search Tool
 *
 * Web search for grounding/RAG - provides real-time information.
 * In production, this would integrate with Google Search API or similar.
 */
import { z } from "zod";

/**
 * Search result interface
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

/**
 * Input schema for Google search
 */
export const GoogleSearchSchema = z.object({
  query: z.string(),
  limit: z.number().min(1).max(20).optional(),
});

/**
 * GoogleSearchTool - performs web searches
 */
export class GoogleSearchTool {
  /**
   * Search the web for information
   *
   * @param query - Search query
   * @param limit - Maximum number of results (default: 5)
   * @returns Array of search results
   */
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    // Simulate search delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate mock search results based on query keywords
    const results = this.generateMockResults(query, limit);

    return results;
  }

  /**
   * Generate mock search results based on query
   */
  private generateMockResults(query: string, limit: number): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // AI/ML related queries
    if (
      lowerQuery.includes("ai") ||
      lowerQuery.includes("artificial intelligence") ||
      lowerQuery.includes("machine learning")
    ) {
      results.push(
        {
          title: "Artificial Intelligence: A Modern Approach",
          url: "https://aima.cs.berkeley.edu/",
          snippet:
            "The leading textbook in Artificial Intelligence, covering intelligent agents, problem-solving, knowledge representation, and machine learning.",
          score: 0.95,
        },
        {
          title: "Machine Learning Fundamentals | Stanford Online",
          url: "https://online.stanford.edu/courses/machine-learning",
          snippet:
            "Learn the fundamentals of machine learning including supervised learning, unsupervised learning, and deep learning techniques.",
          score: 0.92,
        },
        {
          title: "OpenAI Research",
          url: "https://openai.com/research",
          snippet:
            "Latest research in artificial intelligence, including language models, reinforcement learning, and AI safety.",
          score: 0.89,
        }
      );
    }

    // Programming/coding queries
    if (
      lowerQuery.includes("programming") ||
      lowerQuery.includes("code") ||
      lowerQuery.includes("developer") ||
      lowerQuery.includes("typescript") ||
      lowerQuery.includes("javascript")
    ) {
      results.push(
        {
          title: "MDN Web Docs - JavaScript Reference",
          url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
          snippet:
            "Comprehensive JavaScript documentation including tutorials, references, and guides for web developers.",
          score: 0.94,
        },
        {
          title: "TypeScript: JavaScript with syntax for types",
          url: "https://www.typescriptlang.org/",
          snippet:
            "TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.",
          score: 0.91,
        },
        {
          title: "Stack Overflow - Where Developers Learn & Share",
          url: "https://stackoverflow.com/",
          snippet:
            "The largest online community for programmers to learn, share knowledge, and build careers.",
          score: 0.88,
        }
      );
    }

    // API/Integration queries
    if (
      lowerQuery.includes("api") ||
      lowerQuery.includes("rest") ||
      lowerQuery.includes("integration")
    ) {
      results.push(
        {
          title: "RESTful API Design: Best Practices",
          url: "https://restfulapi.net/",
          snippet:
            "Learn REST API design principles, best practices, and implementation patterns for building scalable web services.",
          score: 0.93,
        },
        {
          title: "API Documentation Best Practices",
          url: "https://swagger.io/resources/articles/best-practices-in-api-documentation/",
          snippet:
            "Essential guidelines for creating clear, comprehensive API documentation that developers love.",
          score: 0.90,
        }
      );
    }

    // Cloud/DevOps queries
    if (
      lowerQuery.includes("cloud") ||
      lowerQuery.includes("aws") ||
      lowerQuery.includes("azure") ||
      lowerQuery.includes("devops")
    ) {
      results.push(
        {
          title: "AWS Cloud Computing Services",
          url: "https://aws.amazon.com/",
          snippet:
            "Amazon Web Services offers reliable, scalable, and inexpensive cloud computing services. Free tier available.",
          score: 0.96,
        },
        {
          title: "Microsoft Azure Cloud Platform",
          url: "https://azure.microsoft.com/",
          snippet:
            "Build, run, and manage applications across multiple clouds, on-premises, and at the edge.",
          score: 0.93,
        },
        {
          title: "DevOps Practices and Principles",
          url: "https://www.atlassian.com/devops",
          snippet:
            "Learn about DevOps culture, practices, and tools that enable high-performing technology organizations.",
          score: 0.89,
        }
      );
    }

    // Database queries
    if (
      lowerQuery.includes("database") ||
      lowerQuery.includes("sql") ||
      lowerQuery.includes("postgresql") ||
      lowerQuery.includes("mongodb")
    ) {
      results.push(
        {
          title: "PostgreSQL: The World's Most Advanced Open Source Database",
          url: "https://www.postgresql.org/",
          snippet:
            "PostgreSQL is a powerful, open source object-relational database system with over 35 years of development.",
          score: 0.95,
        },
        {
          title: "SQL Tutorial - W3Schools",
          url: "https://www.w3schools.com/sql/",
          snippet:
            "Learn SQL with our interactive tutorial. Practice with SQL examples and exercises.",
          score: 0.91,
        }
      );
    }

    // Security queries
    if (
      lowerQuery.includes("security") ||
      lowerQuery.includes("encryption") ||
      lowerQuery.includes("authentication")
    ) {
      results.push(
        {
          title: "OWASP Top 10 Web Application Security Risks",
          url: "https://owasp.org/www-project-top-ten/",
          snippet:
            "The OWASP Top 10 is a standard awareness document representing critical security risks to web applications.",
          score: 0.94,
        },
        {
          title: "Authentication Best Practices",
          url: "https://auth0.com/docs/best-practices",
          snippet:
            "Learn about authentication and authorization best practices for securing your applications.",
          score: 0.90,
        }
      );
    }

    // Generic fallback results if no specific match
    if (results.length === 0) {
      results.push(
        {
          title: `Search results for: ${query}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Find comprehensive information about ${query} including articles, documentation, and resources.`,
          score: 0.75,
        },
        {
          title: `${query} - Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          snippet: `Wikipedia article providing detailed information about ${query}, including history, applications, and references.`,
          score: 0.72,
        },
        {
          title: `${query} Tutorial and Guide`,
          url: `https://example.com/tutorial/${encodeURIComponent(query)}`,
          snippet: `Comprehensive tutorial covering ${query} fundamentals, advanced topics, and practical examples.`,
          score: 0.68,
        }
      );
    }

    // Limit results and sort by score
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get search suggestions based on query prefix
   *
   * @param prefix - Query prefix
   * @returns Array of suggested queries
   */
  async getSuggestions(prefix: string): Promise<string[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    const lowerPrefix = prefix.toLowerCase();
    const suggestions: string[] = [];

    // Generate suggestions based on prefix
    if (lowerPrefix.startsWith("a")) {
      suggestions.push(
        "artificial intelligence",
        "api design",
        "aws services",
        "authentication"
      );
    } else if (lowerPrefix.startsWith("m")) {
      suggestions.push(
        "machine learning",
        "microservices",
        "mongodb",
        "modern javascript"
      );
    } else if (lowerPrefix.startsWith("p")) {
      suggestions.push(
        "programming languages",
        "python tutorial",
        "postgresql",
        "performance optimization"
      );
    } else {
      suggestions.push(
        `${prefix} tutorial`,
        `${prefix} best practices`,
        `${prefix} documentation`,
        `${prefix} examples`
      );
    }

    return suggestions.slice(0, 5);
  }
}

/**
 * Singleton instance
 */
export const googleSearchTool = new GoogleSearchTool();
