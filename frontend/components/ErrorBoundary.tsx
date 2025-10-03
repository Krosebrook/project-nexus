import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    console.error("Stack trace:", error.stack);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReportIssue = () => {
    const errorDetails = {
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error("Error report:", errorDetails);
    
    const subject = encodeURIComponent("Project Nexus Error Report");
    const body = encodeURIComponent(
      `Error occurred at ${errorDetails.timestamp}\n\n` +
      `Message: ${errorDetails.message}\n\n` +
      `URL: ${errorDetails.url}\n\n` +
      `Please provide any additional context about what you were doing when this error occurred.`
    );
    window.open(`mailto:support@projectnexus.com?subject=${subject}&body=${body}`, '_blank');
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="text-center space-y-6 max-w-lg">
            <AlertTriangle className="w-20 h-20 text-destructive mx-auto" />
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Something went wrong</h1>
              <p className="text-muted-foreground">
                We're sorry, but something unexpected happened. Please try reloading the page.
              </p>
            </div>
            
            {this.state.error && (
              <details className="text-left bg-muted/50 p-4 rounded-lg text-sm">
                <summary className="cursor-pointer font-medium mb-2">Error details</summary>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground overflow-auto max-h-40">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReload} size="lg" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
              <Button onClick={this.handleReportIssue} variant="outline" size="lg" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Report Issue
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
