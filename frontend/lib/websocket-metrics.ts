type MetricUpdateCallback = (data: any) => void;

interface MetricSubscription {
  id: string;
  metric: string;
  callback: MetricUpdateCallback;
}

class MetricsWebSocketClient {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, MetricSubscription[]> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  constructor(private url: string) {
    this.connect();
  }

  private connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("Metrics WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Metrics WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("Metrics WebSocket disconnected");
        this.isConnecting = false;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((subs, metric) => {
      this.send({
        type: "subscribe",
        metric: metric
      });
    });
  }

  private handleMessage(data: any): void {
    if (data.type === "metric_update" && data.metric) {
      const subs = this.subscriptions.get(data.metric) || [];
      subs.forEach(sub => sub.callback(data.data));
    }
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(metric: string, callback: MetricUpdateCallback): () => void {
    const id = `${metric}_${Date.now()}_${Math.random()}`;
    const subscription: MetricSubscription = { id, metric, callback };

    if (!this.subscriptions.has(metric)) {
      this.subscriptions.set(metric, []);
      this.send({
        type: "subscribe",
        metric: metric
      });
    }

    this.subscriptions.get(metric)!.push(subscription);

    return () => {
      const subs = this.subscriptions.get(metric) || [];
      const index = subs.findIndex(s => s.id === id);
      if (index !== -1) {
        subs.splice(index, 1);
      }

      if (subs.length === 0) {
        this.subscriptions.delete(metric);
        this.send({
          type: "unsubscribe",
          metric: metric
        });
      }
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }
}

let metricsWSClient: MetricsWebSocketClient | null = null;

export function getMetricsWebSocketClient(): MetricsWebSocketClient {
  if (!metricsWSClient) {
    const wsUrl = import.meta.env.DEV 
      ? "ws://localhost:4000/ws/metrics"
      : `wss://${window.location.host}/ws/metrics`;
    metricsWSClient = new MetricsWebSocketClient(wsUrl);
  }
  return metricsWSClient;
}

export function subscribeToMetric(metric: string, callback: MetricUpdateCallback): () => void {
  const client = getMetricsWebSocketClient();
  return client.subscribe(metric, callback);
}

export function disconnectMetricsWebSocket(): void {
  if (metricsWSClient) {
    metricsWSClient.disconnect();
    metricsWSClient = null;
  }
}