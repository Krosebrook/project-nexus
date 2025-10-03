import { useState } from 'react';
import { X, ExternalLink, ArrowLeft, ArrowRight, Github, FileText, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DocsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_LINKS = [
  { name: 'GitHub', icon: Github, url: 'https://github.com' },
  { name: 'Notion', icon: FileText, url: 'https://notion.so' },
  { name: 'Confluence', icon: Link, url: 'https://confluence.atlassian.com' }
];

export function DocsPanel({ isOpen, onClose }: DocsPanelProps) {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleNavigate = () => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    navigateToUrl(fullUrl);
  };

  const navigateToUrl = (newUrl: string) => {
    const newHistory = [...history.slice(0, historyIndex + 1), newUrl];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentUrl(newUrl);
    setUrl(newUrl);
  };

  const handleQuickLink = (linkUrl: string) => {
    setUrl(linkUrl);
    navigateToUrl(linkUrl);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const newUrl = history[historyIndex - 1];
      setCurrentUrl(newUrl);
      setUrl(newUrl);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const newUrl = history[historyIndex + 1];
      setCurrentUrl(newUrl);
      setUrl(newUrl);
    }
  };

  const openInNewTab = () => {
    if (currentUrl) {
      window.open(currentUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[600px] h-full bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Documentation Viewer</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goBack}
              disabled={historyIndex <= 0}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goForward}
              disabled={historyIndex >= history.length - 1}
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Input
              placeholder="Enter URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              className="flex-1"
            />
            <Button onClick={handleNavigate}>Go</Button>
            {currentUrl && (
              <Button variant="outline" size="icon" onClick={openInNewTab}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {QUICK_LINKS.map(({ name, icon: Icon, url: linkUrl }) => (
              <Button
                key={name}
                variant="outline"
                size="sm"
                onClick={() => handleQuickLink(linkUrl)}
                className="flex-1"
              >
                <Icon className="w-4 h-4 mr-2" />
                {name}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white">
          {currentUrl ? (
            <iframe
              src={currentUrl}
              className="w-full h-full border-0"
              title="Documentation Viewer"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <FileText className="w-16 h-16 mx-auto opacity-50" />
                <p>Enter a URL or select a quick link to view documentation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}