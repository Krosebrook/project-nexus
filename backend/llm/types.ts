export interface LLMRequest {
  prompt: string;
  provider?: 'claude' | 'gemini' | 'ollama' | 'auto';
  temperature?: number;
  max_tokens?: number;
}

export interface LLMProvider {
  name: string;
  available: boolean;
  cost_tier: 'high' | 'medium' | 'low' | 'free';
  capabilities: string[];
}

export interface HealthResponse {
  providers: Record<string, boolean>;
}
