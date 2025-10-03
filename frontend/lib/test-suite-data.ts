export type TestStatus = "passed" | "failed" | "not_run";

export interface TestCase {
  id: string;
  name: string;
  description: string;
  project: string;
  tags: string[];
  promptInput: string;
  expectedOutput: string;
  actualOutput?: string;
  status: TestStatus;
  lastRun?: Date;
  duration?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestCase[];
  lastRun?: Date;
  duration?: number;
}

export const mockTestSuites: TestSuite[] = [
  {
    id: "suite-1",
    name: "Triage Classification",
    description: "Tests for issue triage and classification accuracy",
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
    duration: 12.5,
    tests: [
      {
        id: "test-1-1",
        name: "Bug classification",
        description: "Verify correct classification of bug reports",
        project: "INT-triage-ai",
        tags: ["classification", "bug"],
        promptInput: `Classify the following issue:\n\nTitle: Application crashes on startup\nDescription: When I launch the app on iOS 16, it immediately crashes with no error message. This happens every time.`,
        expectedOutput: `{
  "category": "bug",
  "severity": "high",
  "priority": "urgent",
  "reason": "Application crash affecting core functionality"
}`,
        actualOutput: `{
  "category": "bug",
  "severity": "high",
  "priority": "urgent",
  "reason": "Application crash affecting core functionality"
}`,
        status: "passed",
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        duration: 2.3,
      },
      {
        id: "test-1-2",
        name: "Feature request classification",
        description: "Verify correct classification of feature requests",
        project: "INT-triage-ai",
        tags: ["classification", "feature"],
        promptInput: `Classify the following issue:\n\nTitle: Add dark mode support\nDescription: It would be great if the app had a dark mode option for better viewing at night.`,
        expectedOutput: `{
  "category": "feature",
  "severity": "low",
  "priority": "normal",
  "reason": "Enhancement request for UI improvement"
}`,
        actualOutput: `{
  "category": "feature",
  "severity": "low",
  "priority": "normal",
  "reason": "Enhancement request for UI improvement"
}`,
        status: "passed",
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        duration: 2.1,
      },
      {
        id: "test-1-3",
        name: "Support question",
        description: "Verify correct classification of support questions",
        project: "INT-triage-ai",
        tags: ["classification", "support", "edge-case"],
        promptInput: `Classify the following issue:\n\nTitle: How do I reset my password?\nDescription: I forgot my password and can't find the reset option.`,
        expectedOutput: `{
  "category": "question",
  "severity": "low",
  "priority": "normal",
  "reason": "User support inquiry"
}`,
        actualOutput: `{
  "category": "support",
  "severity": "low",
  "priority": "normal",
  "reason": "User support inquiry"
}`,
        status: "failed",
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        duration: 2.4,
      },
      {
        id: "test-1-4",
        name: "Urgent escalation",
        description: "Verify correct identification of urgent issues",
        project: "INT-triage-ai",
        tags: ["classification", "escalation"],
        promptInput: `Classify the following issue:\n\nTitle: Data breach - user data exposed\nDescription: URGENT: Our security team discovered that customer PII is accessible via an unauthenticated API endpoint.`,
        expectedOutput: `{
  "category": "security",
  "severity": "critical",
  "priority": "immediate",
  "reason": "Security vulnerability exposing sensitive data"
}`,
        actualOutput: `{
  "category": "security",
  "severity": "critical",
  "priority": "immediate",
  "reason": "Security vulnerability exposing sensitive data"
}`,
        status: "passed",
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        duration: 2.6,
      },
      {
        id: "test-1-5",
        name: "Edge case: empty input",
        description: "Test handling of empty or malformed input",
        project: "INT-triage-ai",
        tags: ["edge-case", "validation"],
        promptInput: `Classify the following issue:\n\nTitle: \nDescription: `,
        expectedOutput: `{
  "category": "invalid",
  "severity": "none",
  "priority": "none",
  "reason": "Empty or invalid input provided"
}`,
        status: "not_run",
      },
    ],
  },
  {
    id: "suite-2",
    name: "Response Quality",
    description: "Tests for response quality, tone, and completeness",
    lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000),
    duration: 8.7,
    tests: [
      {
        id: "test-2-1",
        name: "Professional tone check",
        description: "Ensure responses maintain professional tone",
        project: "INT-support-bot",
        tags: ["quality", "tone"],
        promptInput: `Generate a response to this frustrated customer:\n\nCustomer: "This is ridiculous! I've been waiting 3 days for a response and nothing works!"`,
        expectedOutput: `I sincerely apologize for the delay in our response and for the frustration you're experiencing. I understand how important it is to get your issue resolved quickly. Let me personally ensure we address your concerns right away. Could you please share more details about what isn't working so I can prioritize getting this fixed for you?`,
        actualOutput: `I sincerely apologize for the delay in our response and for the frustration you're experiencing. I understand how important it is to get your issue resolved quickly. Let me personally ensure we address your concerns right away. Could you please share more details about what isn't working so I can prioritize getting this fixed for you?`,
        status: "passed",
        lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000),
        duration: 2.2,
      },
      {
        id: "test-2-2",
        name: "Completeness validation",
        description: "Verify responses include all necessary information",
        project: "INT-support-bot",
        tags: ["quality", "completeness"],
        promptInput: `Explain how to set up two-factor authentication.`,
        expectedOutput: `To set up two-factor authentication (2FA) on your account:\n\n1. Navigate to Settings > Security\n2. Click "Enable Two-Factor Authentication"\n3. Choose your preferred method: SMS or authenticator app\n4. For authenticator app: Scan the QR code with your app (Google Authenticator, Authy, etc.)\n5. Enter the 6-digit verification code\n6. Save your backup codes in a secure location\n7. Click "Confirm" to activate 2FA\n\nYou'll now be prompted for a verification code each time you log in. Keep your backup codes safe in case you lose access to your authentication device.`,
        actualOutput: `To set up 2FA:\n\n1. Go to Settings > Security\n2. Enable two-factor authentication\n3. Scan QR code or enter code from SMS\n4. Confirm activation`,
        status: "failed",
        lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000),
        duration: 2.8,
      },
      {
        id: "test-2-3",
        name: "Accuracy test",
        description: "Verify technical accuracy of responses",
        project: "INT-support-bot",
        tags: ["quality", "accuracy"],
        promptInput: `What ports does HTTPS use?`,
        expectedOutput: `HTTPS uses port 443 by default. While HTTP uses port 80, HTTPS (HTTP Secure) encrypts the connection using TLS/SSL and operates on port 443.`,
        actualOutput: `HTTPS uses port 443 by default. While HTTP uses port 80, HTTPS (HTTP Secure) encrypts the connection using TLS/SSL and operates on port 443.`,
        status: "passed",
        lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000),
        duration: 1.9,
      },
      {
        id: "test-2-4",
        name: "Edge case: special characters",
        description: "Test handling of special characters and Unicode",
        project: "INT-support-bot",
        tags: ["edge-case", "unicode"],
        promptInput: `Respond to: "🚨 Help! My émojis & spëcial çharacters don't work! 你好 🌍"`,
        expectedOutput: `I understand you're experiencing issues with special characters and emojis. This could be related to character encoding settings. To help resolve this, I'll need a bit more information:\n\n1. What application or feature are you using?\n2. Are all special characters affected, or only specific ones?\n3. What device and operating system are you using?\n\nIn the meantime, try checking your language and region settings to ensure UTF-8 encoding is enabled.`,
        status: "not_run",
      },
    ],
  },
  {
    id: "suite-3",
    name: "API Integration",
    description: "Tests for API response format and error handling",
    lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
    duration: 5.2,
    tests: [
      {
        id: "test-3-1",
        name: "Valid API response format",
        description: "Verify API returns correctly formatted JSON",
        project: "INT-api-gateway",
        tags: ["api", "format"],
        promptInput: `Generate API response for user profile request`,
        expectedOutput: `{
  "status": "success",
  "data": {
    "user_id": "user_123",
    "username": "john_doe",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:30:00Z",
    "profile": {
      "full_name": "John Doe",
      "avatar_url": "https://example.com/avatars/user_123.jpg"
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-03T12:00:00Z"
  }
}`,
        actualOutput: `{
  "status": "success",
  "data": {
    "user_id": "user_123",
    "username": "john_doe",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:30:00Z",
    "profile": {
      "full_name": "John Doe",
      "avatar_url": "https://example.com/avatars/user_123.jpg"
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-03T12:00:00Z"
  }
}`,
        status: "passed",
        lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
        duration: 1.8,
      },
      {
        id: "test-3-2",
        name: "Error handling",
        description: "Verify proper error response format",
        project: "INT-api-gateway",
        tags: ["api", "error-handling"],
        promptInput: `Generate API error response for 404 Not Found`,
        expectedOutput: `{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found",
    "details": "User with ID 'user_999' does not exist"
  },
  "meta": {
    "request_id": "req_xyz789",
    "timestamp": "2024-10-03T12:00:00Z"
  }
}`,
        actualOutput: `{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found",
    "details": "User with ID 'user_999' does not exist"
  },
  "meta": {
    "request_id": "req_xyz789",
    "timestamp": "2024-10-03T12:00:00Z"
  }
}`,
        status: "passed",
        lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
        duration: 1.6,
      },
      {
        id: "test-3-3",
        name: "Rate limit handling",
        description: "Test rate limit response and headers",
        project: "INT-api-gateway",
        tags: ["api", "rate-limit"],
        promptInput: `Generate API response when rate limit exceeded`,
        expectedOutput: `{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": "Rate limit of 100 requests per minute exceeded. Retry after 45 seconds."
  },
  "meta": {
    "request_id": "req_rate123",
    "timestamp": "2024-10-03T12:00:00Z",
    "rate_limit": {
      "limit": 100,
      "remaining": 0,
      "reset": "2024-10-03T12:01:00Z"
    }
  }
}`,
        status: "not_run",
      },
    ],
  },
];