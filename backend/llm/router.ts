import { APIError } from 'encore.dev/api';
import { secret } from 'encore.dev/config';

const claudeApiKey = secret('ANTHROPIC_API_KEY');
const geminiApiKey = secret('GOOGLE_AI_API_KEY');

interface LLMProvider {
  name: string;
  available: boolean;
  cost_tier: 'high' | 'medium' | 'low' | 'free';
  capabilities: string[];
}

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private rateLimiter: Map<string, { count: number; resetAt: number }> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders() {
    this.providers.set('claude', {
      name: 'Claude Sonnet 4',
      available: !!claudeApiKey(),
      cost_tier: 'high',
      capabilities: ['code-generation', 'refactoring', 'architecture', 'analysis'],
    });

    this.providers.set('gemini', {
      name: 'Gemini Pro',
      available: !!geminiApiKey(),
      cost_tier: 'medium',
      capabilities: ['code-generation', 'analysis', 'documentation'],
    });
  }

  async *generate(
    prompt: string,
    provider: 'claude' | 'gemini' | 'auto',
    temperature: number,
    maxTokens: number,
    userId: string
  ): AsyncGenerator<string> {
    this.checkRateLimit(userId);

    const selectedProvider = provider === 'auto' 
      ? this.selectProvider(prompt) 
      : provider;

    console.log(`[LLMRouter] Routing to: ${selectedProvider}`);

    try {
      switch (selectedProvider) {
        case 'claude':
          return yield* this.generateClaude(prompt, temperature, maxTokens);
        case 'gemini':
          return yield* this.generateGemini(prompt, temperature, maxTokens);
        default:
          throw APIError.invalidArgument(`Unknown provider: ${selectedProvider}`);
      }
    } catch (error) {
      console.error(`[LLMRouter] ${selectedProvider} failed:`, error);

      if (selectedProvider === 'claude' && this.providers.get('gemini')?.available) {
        console.log('[LLMRouter] Falling back to Gemini');
        return yield* this.generateGemini(prompt, temperature, maxTokens);
      }

      throw error;
    }
  }

  private selectProvider(prompt: string): 'claude' | 'gemini' {
    const codeKeywords = ['function', 'class', 'import', 'const', 'async', 'refactor'];
    const hasCode = codeKeywords.some(kw => prompt.toLowerCase().includes(kw));

    if (hasCode && this.providers.get('claude')?.available) {
      return 'claude';
    }

    if (this.providers.get('gemini')?.available) {
      return 'gemini';
    }

    throw APIError.internal('No LLM providers available');
  }

  private async *generateClaude(prompt: string, temperature: number, maxTokens: number): AsyncGenerator<string> {
    const apiKey = claudeApiKey();
    if (!apiKey) {
      throw APIError.internal('Claude API key not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw APIError.internal(`Claude API error: ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

      for (const line of lines) {
        const data = line.replace('data: ', '');
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            yield json.delta.text;
          }
        } catch (error) {
          console.warn('[LLMRouter] Failed to parse Claude chunk:', data);
        }
      }
    }
  }

  private async *generateGemini(prompt: string, temperature: number, maxTokens: number): AsyncGenerator<string> {
    const apiKey = geminiApiKey();
    if (!apiKey) {
      throw APIError.internal('Gemini API key not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      throw APIError.internal(`Gemini API error: ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
            yield json.candidates[0].content.parts[0].text;
          }
        } catch (error) {
          console.warn('[LLMRouter] Failed to parse Gemini chunk:', line);
        }
      }
    }
  }



  private checkRateLimit(userId: string) {
    const now = Date.now();
    const userLimit = this.rateLimiter.get(userId);

    if (!userLimit || now > userLimit.resetAt) {
      this.rateLimiter.set(userId, { count: 1, resetAt: now + 60000 });
      return;
    }

    if (userLimit.count >= 10) {
      throw APIError.resourceExhausted('Rate limit exceeded: 10 requests per minute');
    }

    userLimit.count++;
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      health[name] = provider.available;
    }

    return health;
  }
}

export const llmRouter = new LLMRouter();
