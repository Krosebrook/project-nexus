import React, { useState } from 'react';
import { useLLMStream } from '../hooks/useLLMStream';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Loader2, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function CodeGeneratorPanel() {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<'auto' | 'claude' | 'gemini' | 'ollama'>('auto');
  const [copied, setCopied] = useState(false);

  const { stream, cancel, isStreaming, output, error } = useLLMStream({
    onComplete: (fullText) => {
      console.log('[CodeGenerator] Generated', fullText.length, 'characters');
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    await stream(prompt, provider);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="code-generator p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">AI Code Generator</h2>
          <p className="text-sm text-gray-600">
            Describe the code you want to generate and select an AI provider
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium mb-1.5">
              Prompt
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the code you want to generate..."
              rows={5}
              disabled={isStreaming}
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="provider" className="block text-sm font-medium mb-1.5">
                AI Provider
              </label>
              <Select value={provider} onValueChange={(val) => setProvider(val as any)}>
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Smart Routing)</SelectItem>
                  <SelectItem value="claude">Claude Sonnet 4</SelectItem>
                  <SelectItem value="gemini">Gemini Pro</SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              {isStreaming ? (
                <Button onClick={cancel} variant="outline" className="btn-cancel">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancel
                </Button>
              ) : (
                <Button onClick={handleGenerate} className="btn-generate">
                  Generate Code
                </Button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        )}

        {output && (
          <div className="output-section space-y-2">
            <div className="output-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Generated Code</span>
                {isStreaming && (
                  <Badge variant="outline" className="streaming-indicator">
                    <span className="pulse w-2 h-2 bg-blue-500 rounded-full inline-block mr-1.5 animate-pulse" />
                    Generating...
                  </Badge>
                )}
              </div>
              <Button
                onClick={handleCopy}
                variant="ghost"
                size="sm"
                className="btn-copy"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="rounded-lg overflow-hidden border">
              <SyntaxHighlighter 
                language="typescript" 
                style={vscDarkPlus}
                customStyle={{ margin: 0, borderRadius: 0 }}
              >
                {output}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
