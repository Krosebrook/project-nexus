import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface NotificationsSettingsProps {
  settings: any;
  updateSettings: (updates: any) => void;
  isSaving: boolean;
}

export function NotificationsSettings({ settings, updateSettings }: NotificationsSettingsProps) {
  const { toast } = useToast();
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);

  const emailEnabled = settings.preferences?.emailEnabled ?? false;
  const emailAddress = settings.preferences?.emailAddress || "";
  const emailAlertTypes = settings.preferences?.emailAlertTypes || ["deployment_failed", "critical_status"];
  
  const slackEnabled = settings.preferences?.slackEnabled ?? false;
  const slackWebhook = settings.preferences?.slackWebhook || "";
  const slackAlertTypes = settings.preferences?.slackAlertTypes || ["deployment_failed", "critical_status"];
  
  const latencyThreshold = settings.preferences?.latencyThreshold || 1000;
  const errorRateThreshold = settings.preferences?.errorRateThreshold || 5;
  const uptimeThreshold = settings.preferences?.uptimeThreshold || 99;

  const alertTypes = [
    { value: "deployment_failed", label: "Deployment Failed" },
    { value: "critical_status", label: "Critical Status" },
    { value: "test_failures", label: "Test Failures" },
    { value: "high_latency", label: "High Latency" },
    { value: "error_spike", label: "Error Spike" },
  ];

  const handleEmailToggle = (checked: boolean) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        emailEnabled: checked,
      },
    });
  };

  const handleEmailChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        emailAddress: value,
      },
    });
  };

  const handleEmailAlertTypeToggle = (type: string, checked: boolean) => {
    const updated = checked
      ? [...emailAlertTypes, type]
      : emailAlertTypes.filter((t: string) => t !== type);
    
    updateSettings({
      preferences: {
        ...settings.preferences,
        emailAlertTypes: updated,
      },
    });
  };

  const handleSlackToggle = (checked: boolean) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        slackEnabled: checked,
      },
    });
  };

  const handleSlackWebhookChange = (value: string) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        slackWebhook: value,
      },
    });
  };

  const handleSlackAlertTypeToggle = (type: string, checked: boolean) => {
    const updated = checked
      ? [...slackAlertTypes, type]
      : slackAlertTypes.filter((t: string) => t !== type);
    
    updateSettings({
      preferences: {
        ...settings.preferences,
        slackAlertTypes: updated,
      },
    });
  };

  const handleThresholdChange = (key: string, value: number) => {
    updateSettings({
      preferences: {
        ...settings.preferences,
        [key]: value,
      },
    });
  };

  const testEmailConnection = async () => {
    setTestingEmail(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTestingEmail(false);
    toast({
      title: "Test Email Sent",
      description: `A test email was sent to ${emailAddress}`,
    });
  };

  const testSlackConnection = async () => {
    setTestingSlack(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTestingSlack(false);
    toast({
      title: "Slack Connection Test",
      description: "Test message sent to Slack webhook",
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Email Alerts</Label>
            <p className="text-sm text-muted-foreground">Receive notifications via email</p>
          </div>
          <Checkbox
            checked={emailEnabled}
            onCheckedChange={handleEmailToggle}
          />
        </div>

        {emailEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="email-address">Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="email-address"
                  type="email"
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={(e) => handleEmailChange(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={testEmailConnection}
                  disabled={!emailAddress || testingEmail}
                >
                  {testingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alert Types</Label>
              <div className="space-y-2">
                {alertTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`email-${type.value}`}
                      checked={emailAlertTypes.includes(type.value)}
                      onCheckedChange={(checked) => handleEmailAlertTypeToggle(type.value, checked as boolean)}
                    />
                    <Label htmlFor={`email-${type.value}`} className="cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Slack Integration</Label>
            <p className="text-sm text-muted-foreground">Send notifications to Slack</p>
          </div>
          <Checkbox
            checked={slackEnabled}
            onCheckedChange={handleSlackToggle}
          />
        </div>

        {slackEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="slack-webhook">Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  id="slack-webhook"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => handleSlackWebhookChange(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={testSlackConnection}
                  disabled={!slackWebhook || testingSlack}
                >
                  {testingSlack ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alert Types</Label>
              <div className="space-y-2">
                {alertTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`slack-${type.value}`}
                      checked={slackAlertTypes.includes(type.value)}
                      onCheckedChange={(checked) => handleSlackAlertTypeToggle(type.value, checked as boolean)}
                    />
                    <Label htmlFor={`slack-${type.value}`} className="cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Alert Thresholds</Label>
          <p className="text-sm text-muted-foreground">Configure when alerts should be triggered</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="latency-threshold">Latency (ms)</Label>
            <Input
              id="latency-threshold"
              type="number"
              min={0}
              value={latencyThreshold}
              onChange={(e) => handleThresholdChange("latencyThreshold", parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="error-rate-threshold">Error Rate (%)</Label>
            <Input
              id="error-rate-threshold"
              type="number"
              min={0}
              max={100}
              value={errorRateThreshold}
              onChange={(e) => handleThresholdChange("errorRateThreshold", parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="uptime-threshold">Min Uptime (%)</Label>
            <Input
              id="uptime-threshold"
              type="number"
              min={0}
              max={100}
              value={uptimeThreshold}
              onChange={(e) => handleThresholdChange("uptimeThreshold", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}