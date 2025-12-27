import * as net from 'net';

// Supported DAW types
export type DAWType = 'bitwig' | 'ableton';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Generic DAW client for communicating with DAW extensions via TCP.
 * Supports both Bitwig (port 8181) and Ableton (port 8182).
 */
export class DAWClient {
  private socket: net.Socket | null = null;
  private host: string;
  private port: number;
  private timeout: number;
  private dawType: DAWType;
  private requestId = 0;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private buffer = '';

  constructor(dawType: DAWType, host = 'localhost', port?: number, timeout = 10000) {
    this.dawType = dawType;
    this.host = host;
    this.port = port ?? (dawType === 'bitwig' ? 8181 : 8182);
    this.timeout = timeout;
  }

  get type(): DAWType {
    return this.dawType;
  }

  /**
   * Connect to the DAW extension.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        console.error(`[DAWClient:${this.dawType}] Connected on port ${this.port}`);
        resolve();
      });

      this.socket.on('data', (data) => {
        this.handleData(data.toString());
      });

      this.socket.on('error', (err) => {
        console.error(`[DAWClient:${this.dawType}] Socket error:`, err.message);
        reject(err);
      });

      this.socket.on('close', () => {
        console.error(`[DAWClient:${this.dawType}] Connection closed`);
        this.socket = null;
      });

      this.socket.connect(this.port, this.host);
    });
  }

  /**
   * Disconnect from DAW.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  /**
   * Send a command to DAW and wait for response.
   */
  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected()) {
      await this.connect();
    }

    const id = String(++this.requestId);
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.socket!.write(message, (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          reject(err);
        }
      });

      // Timeout after configured duration
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout (${this.dawType})`));
        }
      }, this.timeout);
    });
  }

  private handleData(data: string): void {
    this.buffer += data;

    // Try to parse complete JSON messages (newline-delimited)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';  // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: JsonRpcResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (err) {
          console.error(`[DAWClient:${this.dawType}] Failed to parse response:`, line);
        }
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    }
  }
}

/**
 * Manages multiple DAW client connections with lazy initialization.
 */
export class DAWClientManager {
  private clients: Map<DAWType, DAWClient> = new Map();
  private defaultDaw: DAWType;
  private ports: Record<DAWType, number>;
  private timeout: number;

  constructor(config: {
    defaultDaw: DAWType;
    bitwigPort?: number;
    abletonPort?: number;
    timeout?: number;
  }) {
    this.defaultDaw = config.defaultDaw;
    this.ports = {
      bitwig: config.bitwigPort ?? 8181,
      ableton: config.abletonPort ?? 8182,
    };
    this.timeout = config.timeout ?? 10000;
  }

  /**
   * Get client for specified DAW (or default if not specified).
   * Creates client lazily on first use.
   */
  getClient(daw?: DAWType): DAWClient {
    const dawType = daw ?? this.defaultDaw;

    if (!this.clients.has(dawType)) {
      const client = new DAWClient(
        dawType,
        'localhost',
        this.ports[dawType],
        this.timeout
      );
      this.clients.set(dawType, client);
    }

    return this.clients.get(dawType)!;
  }

  /**
   * Send command to specified DAW (or default).
   */
  async send(method: string, params?: Record<string, unknown>, daw?: DAWType): Promise<unknown> {
    const client = this.getClient(daw);
    return client.send(method, params);
  }

  /**
   * Get the default DAW type.
   */
  getDefaultDaw(): DAWType {
    return this.defaultDaw;
  }

  /**
   * Get port for specified DAW.
   */
  getPort(daw: DAWType): number {
    return this.ports[daw];
  }

  /**
   * Disconnect all clients.
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }

  /**
   * Check connection status for all DAWs.
   * Attempts to connect and send a simple command to verify DAW is running.
   */
  async checkConnections(): Promise<Array<{
    daw: DAWType;
    connected: boolean;
    isDefault: boolean;
    port: number;
  }>> {
    const dawTypes: DAWType[] = ['bitwig', 'ableton'];
    const results = await Promise.all(
      dawTypes.map(async (dawType) => {
        const port = this.ports[dawType];
        let connected = false;

        try {
          const client = this.getClient(dawType);
          // Try to get project info as a ping
          await client.send('project.getInfo', {});
          connected = true;
        } catch {
          // Connection failed or timed out
          connected = false;
        }

        return {
          daw: dawType,
          connected,
          isDefault: dawType === this.defaultDaw,
          port,
        };
      })
    );

    return results;
  }
}
