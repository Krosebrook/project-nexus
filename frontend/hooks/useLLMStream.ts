import { useState, useCallback, useRef } from 'react';

interface UseLLMStreamOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export function useLLMStream(options?: UseLLMStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stream = useCallback(
    async (prompt: string, provider: 'claude' | 'gemini' | 'auto' = 'auto') => {
      setIsStreaming(true);
      setOutput('');
      setError(null);

      abortControllerRef.current = new AbortController();

      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/llm/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt,
            provider,
            temperature: 0.7,
            max_tokens: 2000,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`LLM request failed: ${response.statusText}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkStr = decoder.decode(value);
          const lines = chunkStr.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.text) {
                fullText += data.text;
                setOutput(prev => prev + data.text);
                options?.onChunk?.(data.text);
              }
            } catch (err) {
              console.warn('[LLMStream] Failed to parse chunk:', line);
            }
          }
        }

        options?.onComplete?.(fullText);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.log('[LLMStream] Request cancelled');
        } else {
          setError(err as Error);
          options?.onError?.(err as Error);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [options]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return { stream, cancel, isStreaming, output, error };
}
