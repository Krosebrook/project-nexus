export type DeploymentStatus = "success" | "failed" | "in_progress" | "rolled_back" | "queued";
export type DeploymentStage = "build" | "test" | "deploy_staging" | "deploy_production";
export type StageStatus = "pending" | "running" | "complete" | "failed";

export interface DeploymentStageInfo {
  name: string;
  status: StageStatus;
  duration?: number;
  startTime?: Date;
  logs?: string;
  error?: string;
}

export interface DeploymentCommitInfo {
  hash: string;
  author: string;
  authorAvatar: string;
  message: string;
  timestamp: Date;
  githubUrl: string;
}

export interface Deployment {
  id: string;
  projectId: number;
  projectName: string;
  version: string;
  status: DeploymentStatus;
  duration: number;
  timestamp: Date;
  environment: "staging" | "production";
  commit: DeploymentCommitInfo;
  stages: DeploymentStageInfo[];
  artifacts?: string[];
}

export const mockDeployments: Deployment[] = [
  {
    id: "deploy_1",
    projectId: 1,
    projectName: "INT-triage-ai-2.0",
    version: "v2.1.5",
    status: "success",
    duration: 222,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    environment: "production",
    commit: {
      hash: "a3f4b2c",
      author: "Sarah Chen",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      message: "Add improved triage classification model",
      timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      githubUrl: "https://github.com/example/int-triage-ai/commit/a3f4b2c"
    },
    stages: [
      { name: "Build", status: "complete", duration: 45 },
      { name: "Test", status: "complete", duration: 98 },
      { name: "Deploy Staging", status: "complete", duration: 32 },
      { name: "Deploy Production", status: "complete", duration: 47 }
    ],
    artifacts: ["triage-ai-v2.1.5.tar.gz", "migration-scripts.sql"]
  },
  {
    id: "deploy_2",
    projectId: 2,
    projectName: "Vetting-Vista",
    version: "v1.0.12",
    status: "success",
    duration: 258,
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    environment: "production",
    commit: {
      hash: "b7d9e1f",
      author: "Marcus Rodriguez",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
      message: "Fix background check API integration",
      timestamp: new Date(Date.now() - 5.5 * 60 * 60 * 1000),
      githubUrl: "https://github.com/example/vetting-vista/commit/b7d9e1f"
    },
    stages: [
      { name: "Build", status: "complete", duration: 52 },
      { name: "Test", status: "complete", duration: 124 },
      { name: "Deploy Staging", status: "complete", duration: 38 },
      { name: "Deploy Production", status: "complete", duration: 44 }
    ]
  },
  {
    id: "deploy_3",
    projectId: 3,
    projectName: "PromoForge",
    version: "v0.9.3",
    status: "failed",
    duration: 68,
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    environment: "staging",
    commit: {
      hash: "c2e5a8b",
      author: "Alex Kim",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
      message: "Add promotional campaign templates",
      timestamp: new Date(Date.now() - 6.2 * 60 * 60 * 1000),
      githubUrl: "https://github.com/example/promoforge/commit/c2e5a8b"
    },
    stages: [
      { name: "Build", status: "complete", duration: 41 },
      { name: "Test", status: "failed", duration: 27, error: "Missing environment variable: DATABASE_URL" }
    ]
  },
  {
    id: "deploy_4",
    projectId: 4,
    projectName: "FlashFusion",
    version: "v1.2.1",
    status: "in_progress",
    duration: 135,
    timestamp: new Date(Date.now() - 2.25 * 60 * 1000),
    environment: "production",
    commit: {
      hash: "d8f3c1a",
      author: "Jordan Lee",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
      message: "Optimize video processing pipeline",
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      githubUrl: "https://github.com/example/flashfusion/commit/d8f3c1a"
    },
    stages: [
      { name: "Build", status: "complete", duration: 48, startTime: new Date(Date.now() - 2.25 * 60 * 1000) },
      { name: "Test", status: "complete", duration: 87, startTime: new Date(Date.now() - 1.5 * 60 * 1000) },
      { name: "Deploy Staging", status: "running", startTime: new Date(Date.now() - 0.5 * 60 * 1000) },
      { name: "Deploy Production", status: "pending" }
    ]
  },
  {
    id: "deploy_5",
    projectId: 5,
    projectName: "Server-Side-Rate-Limiting",
    version: "v3.2.0",
    status: "success",
    duration: 171,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    environment: "production",
    commit: {
      hash: "e1a9f7d",
      author: "Taylor Brooks",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor",
      message: "Implement Redis-based rate limiting",
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
      githubUrl: "https://github.com/example/rate-limiting/commit/e1a9f7d"
    },
    stages: [
      { name: "Build", status: "complete", duration: 38 },
      { name: "Test", status: "complete", duration: 76 },
      { name: "Deploy Staging", status: "complete", duration: 29 },
      { name: "Deploy Production", status: "complete", duration: 28 }
    ]
  },
  {
    id: "deploy_6",
    projectId: 6,
    projectName: "LLM-Model-Chaining",
    version: "v0.8.1",
    status: "rolled_back",
    duration: 513,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    environment: "production",
    commit: {
      hash: "f5c2b9e",
      author: "Morgan Taylor",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Morgan",
      message: "Add GPT-4 integration for chaining",
      timestamp: new Date(Date.now() - 2.1 * 24 * 60 * 60 * 1000),
      githubUrl: "https://github.com/example/llm-chaining/commit/f5c2b9e"
    },
    stages: [
      { name: "Build", status: "complete", duration: 52 },
      { name: "Test", status: "complete", duration: 143 },
      { name: "Deploy Staging", status: "complete", duration: 41 },
      { name: "Deploy Production", status: "complete", duration: 277 }
    ]
  },
  {
    id: "deploy_7",
    projectId: 7,
    projectName: "API-Gateway-v2",
    version: "v2.0.0",
    status: "success",
    duration: 194,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    environment: "production",
    commit: {
      hash: "g7e4d2c",
      author: "Jamie Park",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jamie",
      message: "Major refactor: new routing engine",
      timestamp: new Date(Date.now() - 3.1 * 24 * 60 * 60 * 1000),
      githubUrl: "https://github.com/example/api-gateway/commit/g7e4d2c"
    },
    stages: [
      { name: "Build", status: "complete", duration: 44 },
      { name: "Test", status: "complete", duration: 89 },
      { name: "Deploy Staging", status: "complete", duration: 31 },
      { name: "Deploy Production", status: "complete", duration: 30 }
    ]
  },
  {
    id: "deploy_8",
    projectId: 8,
    projectName: "DataSync-Engine",
    version: "v1.5.3",
    status: "success",
    duration: 203,
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    environment: "production",
    commit: {
      hash: "h9b6f3a",
      author: "Casey Wright",
      authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Casey",
      message: "Improve sync conflict resolution",
      timestamp: new Date(Date.now() - 4.2 * 24 * 60 * 60 * 1000),
      githubUrl: "https://github.com/example/datasync/commit/h9b6f3a"
    },
    stages: [
      { name: "Build", status: "complete", duration: 46 },
      { name: "Test", status: "complete", duration: 102 },
      { name: "Deploy Staging", status: "complete", duration: 28 },
      { name: "Deploy Production", status: "complete", duration: 27 }
    ]
  }
];

export function getDeploymentStats(deployments: Deployment[]) {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  
  const activeDeployments = deployments.filter(d => d.status === "in_progress").length;
  const queuedDeployments = deployments.filter(d => d.status === "queued").length;
  
  const deploymentsLast24h = deployments.filter(d => d.timestamp.getTime() > last24h);
  const successfulLast24h = deploymentsLast24h.filter(d => d.status === "success").length;
  const successRate = deploymentsLast24h.length > 0 
    ? (successfulLast24h / deploymentsLast24h.length) * 100 
    : 100;
  
  const completedDeployments = deployments.filter(d => 
    d.status === "success" || d.status === "failed" || d.status === "rolled_back"
  );
  const avgDeployTime = completedDeployments.length > 0
    ? completedDeployments.reduce((sum, d) => sum + d.duration, 0) / completedDeployments.length
    : 0;
  
  return {
    activeDeployments,
    queuedDeployments,
    successRate,
    avgDeployTime
  };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function getStatusColor(status: DeploymentStatus): string {
  switch (status) {
    case "success": return "text-green-500";
    case "failed": return "text-red-500";
    case "in_progress": return "text-yellow-500";
    case "rolled_back": return "text-blue-500";
    case "queued": return "text-gray-500";
    default: return "text-gray-500";
  }
}

export function getDurationColor(seconds: number): string {
  const mins = seconds / 60;
  if (mins < 5) return "text-green-500";
  if (mins < 10) return "text-yellow-500";
  return "text-red-500";
}