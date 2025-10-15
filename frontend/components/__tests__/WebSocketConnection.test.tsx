import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager } from '../../lib/websocket';

describe('WebSocket Connection Management E2E Tests', () => {
  let wsManager: WebSocketManager;
  let mockWebSocket: any;

  beforeEach(() => {
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    global.WebSocket = vi.fn(() => mockWebSocket) as any;
  });

  afterEach(() => {
    wsManager?.disconnect();
  });

  it('should establish WebSocket connection', () => {
    wsManager = new WebSocketManager({
      url: 'ws://localhost:8080',
      reconnectInterval: 1000,
      maxReconnectAttempts: 3
    });

    wsManager.connect();

    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080', []);
  });

  it('should send messages when connected', () => {
    wsManager = new WebSocketManager({ url: 'ws://localhost:8080' });
    wsManager.connect();

    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    wsManager.send('test', { data: 'hello' });

    expect(mockWebSocket.send).toHaveBeenCalled();
    const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
    expect(sentMessage.type).toBe('test');
    expect(sentMessage.payload.data).toBe('hello');
  });

  it('should queue messages when disconnected', () => {
    wsManager = new WebSocketManager({ url: 'ws://localhost:8080' });
    mockWebSocket.readyState = WebSocket.CONNECTING;

    wsManager.send('queued', { message: 'test' });

    expect(mockWebSocket.send).not.toHaveBeenCalled();

    mockWebSocket.readyState = WebSocket.OPEN;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    expect(mockWebSocket.send).toHaveBeenCalled();
  });

  it('should handle reconnection with exponential backoff', async () => {
    vi.useFakeTimers();
    
    wsManager = new WebSocketManager({
      url: 'ws://localhost:8080',
      reconnectInterval: 1000,
      maxReconnectAttempts: 3
    });

    wsManager.connect();

    if (mockWebSocket.onclose) {
      mockWebSocket.onclose(new CloseEvent('close'));
    }

    vi.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(2000);
    expect(global.WebSocket).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('should handle message routing to handlers', () => {
    wsManager = new WebSocketManager({ url: 'ws://localhost:8080' });
    wsManager.connect();

    const handler = vi.fn();
    wsManager.on('deployment.update', handler);

    const message = JSON.stringify({
      type: 'deployment.update',
      payload: { status: 'success' }
    });

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(new MessageEvent('message', { data: message }));
    }

    expect(handler).toHaveBeenCalledWith({
      type: 'deployment.update',
      payload: { status: 'success' }
    });
  });

  it('should cleanup handlers on disconnect', () => {
    wsManager = new WebSocketManager({ url: 'ws://localhost:8080' });
    wsManager.connect();

    const handler = vi.fn();
    const unsubscribe = wsManager.on('test', handler);

    unsubscribe();

    const message = JSON.stringify({ type: 'test', payload: {} });
    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(new MessageEvent('message', { data: message }));
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it('should implement heartbeat mechanism', () => {
    vi.useFakeTimers();

    wsManager = new WebSocketManager({
      url: 'ws://localhost:8080',
      heartbeatInterval: 5000
    });

    wsManager.connect();

    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    vi.advanceTimersByTime(5000);
    
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"ping"')
    );

    vi.useRealTimers();
  });

  it('should stop reconnection after max attempts', () => {
    vi.useFakeTimers();

    wsManager = new WebSocketManager({
      url: 'ws://localhost:8080',
      reconnectInterval: 1000,
      maxReconnectAttempts: 2
    });

    wsManager.connect();

    if (mockWebSocket.onclose) {
      mockWebSocket.onclose(new CloseEvent('close'));
    }

    vi.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(2);

    if (mockWebSocket.onclose) {
      mockWebSocket.onclose(new CloseEvent('close'));
    }

    vi.advanceTimersByTime(2000);
    expect(global.WebSocket).toHaveBeenCalledTimes(3);

    if (mockWebSocket.onclose) {
      mockWebSocket.onclose(new CloseEvent('close'));
    }

    vi.advanceTimersByTime(10000);
    expect(global.WebSocket).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});