const { spawn } = require('child_process');
const EventEmitter = require('events');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

/**
 * MCP Connection Manager - Handles different transport types
 * Supports stdio, SSE, and HTTP connections
 */
class MCPConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.connectionMetrics = new Map();
  }

  /**
   * Connect to an MCP server based on transport type
   */
  async connect(mcpConfig) {
    const { name, transport } = mcpConfig;
    
    if (this.connections.has(name)) {
      console.log(chalk.yellow(`⚠️  MCP ${name} is already connected`));
      return this.connections.get(name);
    }

    let connection;
    
    switch (transport) {
      case 'stdio':
        connection = await this.connectStdio(mcpConfig);
        break;
      case 'sse':
        connection = await this.connectSSE(mcpConfig);
        break;
      case 'http':
        connection = await this.connectHTTP(mcpConfig);
        break;
      default:
        throw new Error(`Unsupported transport type: ${transport}`);
    }

    this.connections.set(name, connection);
    this.initializeMetrics(name);
    
    this.emit('connected', { name, transport });
    console.log(chalk.green(`✅ Connected to MCP: ${name} (${transport})`));
    
    return connection;
  }

  /**
   * Connect via stdio (standard input/output)
   */
  async connectStdio(mcpConfig) {
    const { name, command, args = [], env = {}, workingDirectory } = mcpConfig;
    
    // Prepare environment variables
    const processEnv = {
      ...process.env,
      ...this.resolveEnvironmentVariables(env)
    };

    // Prepare spawn options
    const spawnOptions = {
      env: processEnv,
      cwd: workingDirectory || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    };

    // Resolve command arguments
    const resolvedArgs = this.resolveArguments(args, mcpConfig);

    // Spawn the process
    const childProcess = spawn(command, resolvedArgs, spawnOptions);
    
    const connection = {
      type: 'stdio',
      name,
      process: childProcess,
      stdin: childProcess.stdin,
      stdout: childProcess.stdout,
      stderr: childProcess.stderr,
      status: 'connected',
      startedAt: new Date(),
      messageQueue: [],
      responseHandlers: new Map(),
      nextId: 1
    };

    // Handle stdout (responses from MCP)
    let buffer = '';
    childProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleStdioMessage(connection, message);
          } catch (error) {
            console.error(chalk.red(`Failed to parse MCP response: ${line}`));
          }
        }
      }
    });

    // Handle stderr (errors and logs)
    childProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.error(chalk.yellow(`[${name}]: ${message}`));
      }
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      connection.status = 'disconnected';
      this.connections.delete(name);
      this.emit('disconnected', { name, code, signal });
      console.log(chalk.yellow(`MCP ${name} exited with code ${code}`));
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      connection.status = 'error';
      this.emit('error', { name, error });
      console.error(chalk.red(`MCP ${name} error: ${error.message}`));
    });

    // Initialize the connection
    await this.initializeStdioConnection(connection);

    return connection;
  }

  /**
   * Initialize stdio connection with handshake
   */
  async initializeStdioConnection(connection) {
    return new Promise((resolve, reject) => {
      const initMessage = {
        jsonrpc: '2.0',
        id: connection.nextId++,
        method: 'initialize',
        params: {
          protocolVersion: '1.0',
          clientInfo: {
            name: 'rapala-mcp-manager',
            version: '1.0.0'
          }
        }
      };

      const timeoutId = setTimeout(() => {
        reject(new Error(`MCP ${connection.name} initialization timeout`));
      }, 10000);

      connection.responseHandlers.set(initMessage.id, (response) => {
        clearTimeout(timeoutId);
        if (response.error) {
          reject(new Error(`MCP initialization failed: ${response.error.message}`));
        } else {
          connection.capabilities = response.result.capabilities || {};
          connection.serverInfo = response.result.serverInfo || {};
          resolve();
        }
      });

      connection.stdin.write(JSON.stringify(initMessage) + '\n');
    });
  }

  /**
   * Connect via Server-Sent Events (SSE)
   */
  async connectSSE(mcpConfig) {
    const { name, url, headers = {} } = mcpConfig;
    
    const EventSource = require('eventsource');
    
    const eventSource = new EventSource(url, {
      headers: this.resolveHeaders(headers)
    });

    const connection = {
      type: 'sse',
      name,
      eventSource,
      url,
      status: 'connecting',
      startedAt: new Date(),
      messageQueue: [],
      nextId: 1
    };

    return new Promise((resolve, reject) => {
      eventSource.onopen = () => {
        connection.status = 'connected';
        resolve(connection);
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleSSEMessage(connection, message);
        } catch (error) {
          console.error(chalk.red(`Failed to parse SSE message: ${event.data}`));
        }
      };

      eventSource.onerror = (error) => {
        connection.status = 'error';
        this.emit('error', { name, error });
        reject(error);
      };
    });
  }

  /**
   * Connect via HTTP
   */
  async connectHTTP(mcpConfig) {
    const { name, url, headers = {}, auth } = mcpConfig;
    
    const connection = {
      type: 'http',
      name,
      url,
      headers: this.resolveHeaders(headers),
      auth,
      status: 'connected',
      startedAt: new Date(),
      nextId: 1
    };

    // Test connection
    try {
      const response = await this.sendHTTPRequest(connection, {
        method: 'health',
        params: {}
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
    } catch (error) {
      connection.status = 'error';
      throw new Error(`Failed to connect to HTTP MCP: ${error.message}`);
    }

    return connection;
  }

  /**
   * Send request to MCP server
   */
  async sendRequest(name, method, params = {}) {
    const connection = this.connections.get(name);
    
    if (!connection) {
      throw new Error(`MCP ${name} is not connected`);
    }

    switch (connection.type) {
      case 'stdio':
        return this.sendStdioRequest(connection, method, params);
      case 'sse':
        return this.sendSSERequest(connection, method, params);
      case 'http':
        return this.sendHTTPRequest(connection, { method, params });
      default:
        throw new Error(`Unsupported connection type: ${connection.type}`);
    }
  }

  /**
   * Send request via stdio
   */
  async sendStdioRequest(connection, method, params) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: connection.nextId++,
        method,
        params
      };

      const timeoutId = setTimeout(() => {
        connection.responseHandlers.delete(request.id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      connection.responseHandlers.set(request.id, (response) => {
        clearTimeout(timeoutId);
        connection.responseHandlers.delete(request.id);
        
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      connection.stdin.write(JSON.stringify(request) + '\n');
      this.updateMetrics(connection.name, 'request');
    });
  }

  /**
   * Send request via SSE
   */
  async sendSSERequest(connection, method, params) {
    // SSE is typically one-way (server to client)
    // For bidirectional, we'd need a separate HTTP endpoint
    const response = await fetch(`${connection.url}/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...connection.headers
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: connection.nextId++,
        method,
        params
      })
    });

    const result = await response.json();
    this.updateMetrics(connection.name, 'request');
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result.result;
  }

  /**
   * Send request via HTTP
   */
  async sendHTTPRequest(connection, { method, params }) {
    const request = {
      jsonrpc: '2.0',
      id: connection.nextId++,
      method,
      params
    };

    const response = await fetch(connection.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...connection.headers,
        ...(connection.auth ? { 'Authorization': `Bearer ${connection.auth}` } : {})
      },
      body: JSON.stringify(request)
    });

    const result = await response.json();
    this.updateMetrics(connection.name, 'request');
    
    return result;
  }

  /**
   * Handle stdio message
   */
  handleStdioMessage(connection, message) {
    if (message.id && connection.responseHandlers.has(message.id)) {
      // Response to a request
      connection.responseHandlers.get(message.id)(message);
    } else if (message.method) {
      // Notification or request from server
      this.emit('message', {
        name: connection.name,
        message
      });
    }
    
    this.updateMetrics(connection.name, 'response');
  }

  /**
   * Handle SSE message
   */
  handleSSEMessage(connection, message) {
    this.emit('message', {
      name: connection.name,
      message
    });
    
    this.updateMetrics(connection.name, 'response');
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(name) {
    const connection = this.connections.get(name);
    
    if (!connection) {
      console.log(chalk.yellow(`⚠️  MCP ${name} is not connected`));
      return;
    }

    switch (connection.type) {
      case 'stdio':
        if (connection.process && !connection.process.killed) {
          connection.process.kill('SIGTERM');
        }
        break;
      case 'sse':
        if (connection.eventSource) {
          connection.eventSource.close();
        }
        break;
      case 'http':
        // No persistent connection to close
        break;
    }

    this.connections.delete(name);
    this.emit('disconnected', { name });
    console.log(chalk.green(`✅ Disconnected from MCP: ${name}`));
  }

  /**
   * Disconnect all MCPs
   */
  async disconnectAll() {
    const names = Array.from(this.connections.keys());
    
    for (const name of names) {
      await this.disconnect(name);
    }
  }

  /**
   * Get connection status
   */
  getStatus(name) {
    const connection = this.connections.get(name);
    
    if (!connection) {
      return { status: 'disconnected' };
    }

    const metrics = this.connectionMetrics.get(name) || {};
    
    return {
      status: connection.status,
      type: connection.type,
      startedAt: connection.startedAt,
      uptime: Date.now() - connection.startedAt.getTime(),
      metrics,
      capabilities: connection.capabilities,
      serverInfo: connection.serverInfo
    };
  }

  /**
   * Get all connection statuses
   */
  getAllStatuses() {
    const statuses = {};
    
    for (const name of this.connections.keys()) {
      statuses[name] = this.getStatus(name);
    }
    
    return statuses;
  }

  /**
   * Initialize metrics for a connection
   */
  initializeMetrics(name) {
    this.connectionMetrics.set(name, {
      requests: 0,
      responses: 0,
      errors: 0,
      lastActivity: new Date()
    });
  }

  /**
   * Update connection metrics
   */
  updateMetrics(name, type) {
    const metrics = this.connectionMetrics.get(name);
    
    if (metrics) {
      if (type === 'request') metrics.requests++;
      if (type === 'response') metrics.responses++;
      if (type === 'error') metrics.errors++;
      metrics.lastActivity = new Date();
    }
  }

  /**
   * Resolve environment variables
   */
  resolveEnvironmentVariables(env) {
    const resolved = {};
    
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Replace with actual environment variable
        const envVar = value.substring(1);
        resolved[key] = process.env[envVar] || '';
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  /**
   * Resolve command arguments
   */
  resolveArguments(args, mcpConfig) {
    return args.map(arg => {
      if (typeof arg === 'string') {
        // Replace placeholders
        return arg
          .replace('$CWD', process.cwd())
          .replace('$HOME', require('os').homedir())
          .replace('$DB_PATH', mcpConfig.configurable?.dbPath?.default || './database.db');
      }
      return arg;
    });
  }

  /**
   * Resolve headers
   */
  resolveHeaders(headers) {
    const resolved = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Replace with environment variable
        const envVar = value.substring(1);
        resolved[key] = process.env[envVar] || '';
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }
}

module.exports = MCPConnectionManager;