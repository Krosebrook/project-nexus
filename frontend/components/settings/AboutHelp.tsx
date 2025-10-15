import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Github, BookOpen, Mail, FileText, History } from "lucide-react";

interface AboutHelpProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

export function AboutHelp({ }: AboutHelpProps) {
  const appVersion = "1.2.0";
  const buildNumber = "2025.10.03.1";
  const lastUpdated = "October 3, 2025";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>PROJECT NEXUS</CardTitle>
          <CardDescription>
            Enterprise-grade project management and deployment platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Version</Label>
              <p className="font-mono text-sm">{appVersion}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Build</Label>
              <p className="font-mono text-sm">{buildNumber}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Last Updated</Label>
              <p className="text-sm">{lastUpdated}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Environment</Label>
              <p className="text-sm">Production</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Resources</Label>
          <p className="text-sm text-muted-foreground">
            Documentation and support resources
          </p>
        </div>

        <div className="grid gap-3">
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => window.open("https://github.com/project-nexus/nexus", "_blank")}
          >
            <Github className="h-5 w-5 mr-3" />
            <div className="flex-1 text-left">
              <div className="font-medium">GitHub Repository</div>
              <div className="text-xs text-muted-foreground">
                View source code and contribute
              </div>
            </div>
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => window.open("https://docs.project-nexus.dev", "_blank")}
          >
            <BookOpen className="h-5 w-5 mr-3" />
            <div className="flex-1 text-left">
              <div className="font-medium">Documentation</div>
              <div className="text-xs text-muted-foreground">
                Comprehensive guides and API reference
              </div>
            </div>
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => window.open("https://docs.project-nexus.dev/changelog", "_blank")}
          >
            <History className="h-5 w-5 mr-3" />
            <div className="flex-1 text-left">
              <div className="font-medium">Changelog</div>
              <div className="text-xs text-muted-foreground">
                See what's new in each version
              </div>
            </div>
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => window.location.href = "mailto:support@project-nexus.dev"}
          >
            <Mail className="h-5 w-5 mr-3" />
            <div className="flex-1 text-left">
              <div className="font-medium">Support</div>
              <div className="text-xs text-muted-foreground">
                support@project-nexus.dev
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => window.open("https://project-nexus.dev/license", "_blank")}
          >
            <FileText className="h-5 w-5 mr-3" />
            <div className="flex-1 text-left">
              <div className="font-medium">License</div>
              <div className="text-xs text-muted-foreground">
                MIT License - Open Source
              </div>
            </div>
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-mono">{navigator.platform}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">User Agent</span>
            <span className="font-mono text-xs truncate max-w-xs">
              {navigator.userAgent.split(" ").slice(0, 3).join(" ")}...
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Language</span>
            <span className="font-mono">{navigator.language}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Screen Resolution</span>
            <span className="font-mono">
              {window.screen.width} × {window.screen.height}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-muted rounded-lg space-y-2">
        <p className="text-sm font-medium">Credits</p>
        <p className="text-xs text-muted-foreground">
          Built with ❤️ using React, TypeScript, Tailwind CSS, and Encore.ts.
          Icons by Lucide. UI components by shadcn/ui.
        </p>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        © 2025 PROJECT NEXUS. All rights reserved.
      </div>
    </div>
  );
}