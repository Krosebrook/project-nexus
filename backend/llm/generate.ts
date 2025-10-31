import { api, APIError, StreamOut } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { llmRouter } from './router';
import { LLMRequest } from './types';

interface LLMChunk {
  text: string;
}

export const generate = api.streamOut<LLMRequest, LLMChunk>(
  { expose: true, path: '/llm/generate', auth: true },
  async (req, stream) => {
    const auth = getAuthData() as any;
    const userId = auth?.userID ?? 'anonymous';

    if (!req.prompt || req.prompt.trim().length === 0) {
      throw APIError.invalidArgument('Prompt is required');
    }

    try {
      for await (const chunk of llmRouter.generate(
        req.prompt,
        req.provider ?? 'auto',
        req.temperature ?? 0.7,
        req.max_tokens ?? 2000,
        userId
      )) {
        await stream.send({ text: chunk });
      }
    } catch (error) {
      console.error('[LLM] Stream error:', error);
      throw error;
    } finally {
      await stream.close();
    }
  }
);
