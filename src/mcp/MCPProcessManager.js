const EventEmitter = require('events');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

/**
 * MCP Process Manager - Lifecycle management for MCP servers
 * Handles starting, stopping, restarting, and health monitoring
 */
class MCPProcessManager extends EventEmitter {
  constructor(connectionManager, registry) {
    super();
    this.connectionManager = connectionManager;
    this.registry = registry;
    this.processes = new Map();
    this.healthChecks = new Map();
    this.restartAttempts = new Map();
    this.maxRestartAttempts = 3;
    this.healthCheckInterval = 30000; // 30 seconds
    this.startupTimeout = 10000; // 10 seconds
  }

  /**
   * Start an MCP server
   */
  async start(name, config = {}) {
    console.log(chalk.blue(`🚀 Starting MCP: ${name}`));
    
    // Get MCP configuration from registry
    const mcpConfig = this.registry.getMCP(name);
    
    if (!mcpConfig) {
      throw new Error(`MCP not found in registry: ${name}`);
    }

    // Merge with provided config
    const finalConfig = {
      ...mcpConfig,
      ...config,
      configurable: {
        ...mcpConfig.configurable,
        ...config.configurable
      }
    };

    // Check if already running
    if (this.processes.has(name)) {
      const process = this.processes.get(name);
      if (process.status === 'running') {
        console.log(chalk.yellow(`⚠️  MCP ${name} is already running`));
        return process;
      }
    }

    // Validate configuration
    const validation = this.validateConfig(finalConfig);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Resolve configuration values
    const resolvedConfig = await this.resolveConfig(finalConfig);

    // Create process entry
    const processEntry = {
      name,
      config: resolvedConfig,
      status: 'starting',
      startedAt: new Date(),
      pid: null,
      restarts: 0,
      errors: []
    };

    this.processes.set(name, processEntry);

    try {
      // Connect using connection manager
      const connection = await this.connectionManager.connect(resolvedConfig);
      
      processEntry.status = 'running';
      processEntry.connection = connection;
      
      if (connection.process) {
        processEntry.pid = connection.process.pid;
      }

      // Start health monitoring
      this.startHealthMonitoring(name);

      // Listen for connection events
      this.setupConnectionListeners(name);

      this.emit('started', { name, pid: processEntry.pid });
      console.log(chalk.green(`✅ MCP ${name} started successfully`));
      
      return processEntry;
    } catch (error) {
      processEntry.status = 'failed';
      processEntry.errors.push({
        timestamp: new Date(),
        message: error.message
      });
      
      this.emit('start-failed', { name, error });
      throw error;
    }
  }

  /**
   * Stop an MCP server
   */
  async stop(name, force = false) {
    console.log(chalk.blue(`🛑 Stopping MCP: ${name}`));
    
    const process = this.processes.get(name);
    
    if (!process) {
      console.log(chalk.yellow(`⚠️  MCP ${name} is not running`));
      return;
    }

    // Stop health monitoring
    this.stopHealthMonitoring(name);

    // Update status
    process.status = 'stopping';

    try {
      // Disconnect using connection manager
      await this.connectionManager.disconnect(name);
      
      process.status = 'stopped';
      process.stoppedAt = new Date();
      
      this.emit('stopped', { name });
      console.log(chalk.green(`✅ MCP ${name} stopped successfully`));
    } catch (error) {
      if (force) {
        // Force kill if needed
        if (process.connection?.process) {
          process.connection.process.kill('SIGKILL');
        }
        process.status = 'stopped';
        console.log(chalk.yellow(`⚠️  MCP ${name} force stopped`));
      } else {
        process.status = 'error';
        throw error;
      }
    }
  }

  /**
   * Restart an MCP server
   */
  async restart(name) {
    console.log(chalk.blue(`🔄 Restarting MCP: ${name}`));
    
    const process = this.processes.get(name);
    
    if (!process) {
      // If not running, just start it
      return this.start(name);
    }

    const config = process.config;
    
    // Stop the process
    await this.stop(name);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start with same config
    return this.start(name, config);
  }

  /**
   * Start all registered MCPs
   */
  async startAll() {
    const mcps = this.registry.getAllMCPs();
    const results = { success: [], failed: [] };
    
    for (const [name, config] of Object.entries(mcps)) {
      if (config.enabled !== false && config.autoStart !== false) {
        try {
          await this.start(name);
          results.success.push(name);
        } catch (error) {
          console.error(chalk.red(`Failed to start ${name}: ${error.message}`));
          results.failed.push({ name, error: error.message });
        }
      }
    }
    
    return results;
  }

  /**
   * Stop all running MCPs
   */
  async stopAll() {
    const runningMCPs = Array.from(this.processes.keys());
    
    for (const name of runningMCPs) {
      try {
        await this.stop(name);
      } catch (error) {
        console.error(chalk.red(`Failed to stop ${name}: ${error.message}`));
      }
    }
  }

  /**
   * Get process status
   */
  getStatus(name) {
    const process = this.processes.get(name);
    
    if (!process) {
      return { status: 'not-running' };
    }

    const connectionStatus = this.connectionManager.getStatus(name);
    
    return {
      ...process,
      connectionStatus,
      uptime: process.startedAt ? Date.now() - process.startedAt.getTime() : 0,
      healthStatus: this.getHealthStatus(name)
    };
  }

  /**
   * Get all process statuses
   */
  getAllStatuses() {
    const statuses = {};
    const allMCPs = this.registry.getAllMCPs();
    
    for (const name of Object.keys(allMCPs)) {
      statuses[name] = this.getStatus(name);
    }
    
    return statuses;
  }

  /**
   * Start health monitoring for a process
   */
  startHealthMonitoring(name) {
    // Clear existing health check if any
    this.stopHealthMonitoring(name);
    
    const intervalId = setInterval(async () => {
      await this.performHealthCheck(name);
    }, this.healthCheckInterval);
    
    this.healthChecks.set(name, {
      intervalId,
      lastCheck: new Date(),
      status: 'healthy',
      consecutiveFailures: 0
    });
    
    // Perform initial health check
    setTimeout(() => this.performHealthCheck(name), 5000);
  }

  /**
   * Stop health monitoring for a process
   */
  stopHealthMonitoring(name) {
    const healthCheck = this.healthChecks.get(name);
    
    if (healthCheck) {
      clearInterval(healthCheck.intervalId);
      this.healthChecks.delete(name);
    }
  }

  /**
   * Perform health check on a process
   */
  async performHealthCheck(name) {
    const process = this.processes.get(name);
    
    if (!process || process.status !== 'running') {
      return;
    }

    const healthCheck = this.healthChecks.get(name);
    
    try {
      // Try to send a health check request
      const result = await this.connectionManager.sendRequest(name, 'health', {});
      
      healthCheck.status = 'healthy';
      healthCheck.consecutiveFailures = 0;
      healthCheck.lastCheck = new Date();
      
      this.emit('health-check', { name, status: 'healthy' });
    } catch (error) {
      healthCheck.consecutiveFailures++;
      healthCheck.lastCheck = new Date();
      
      if (healthCheck.consecutiveFailures >= 3) {
        healthCheck.status = 'unhealthy';
        console.error(chalk.red(`❌ MCP ${name} is unhealthy: ${error.message}`));
        
        // Attempt auto-restart if enabled
        if (process.config.autoRestart !== false) {
          await this.handleAutoRestart(name);
        }
      } else {
        healthCheck.status = 'degraded';
        console.warn(chalk.yellow(`⚠️  MCP ${name} health check failed (${healthCheck.consecutiveFailures}/3)`));
      }
      
      this.emit('health-check', { 
        name, 
        status: healthCheck.status,
        error: error.message 
      });
    }
  }

  /**
   * Handle auto-restart for unhealthy process
   */
  async handleAutoRestart(name) {
    const attempts = this.restartAttempts.get(name) || 0;
    
    if (attempts >= this.maxRestartAttempts) {
      console.error(chalk.red(`❌ MCP ${name} exceeded max restart attempts`));
      this.emit('restart-failed', { name, attempts });
      return;
    }

    console.log(chalk.yellow(`🔄 Auto-restarting MCP ${name} (attempt ${attempts + 1}/${this.maxRestartAttempts})`));
    
    this.restartAttempts.set(name, attempts + 1);
    
    try {
      await this.restart(name);
      
      // Reset restart attempts on successful restart
      setTimeout(() => {
        this.restartAttempts.set(name, 0);
      }, 60000); // Reset after 1 minute of successful running
    } catch (error) {
      console.error(chalk.red(`Failed to auto-restart ${name}: ${error.message}`));
    }
  }

  /**
   * Get health status for a process
   */
  getHealthStatus(name) {
    const healthCheck = this.healthChecks.get(name);
    
    if (!healthCheck) {
      return { status: 'unknown' };
    }
    
    return {
      status: healthCheck.status,
      lastCheck: healthCheck.lastCheck,
      consecutiveFailures: healthCheck.consecutiveFailures
    };
  }

  /**
   * Setup connection event listeners
   */
  setupConnectionListeners(name) {
    // Listen for disconnection events
    this.connectionManager.once('disconnected', (event) => {
      if (event.name === name) {
        const process = this.processes.get(name);
        
        if (process && process.status === 'running') {
          process.status = 'disconnected';
          
          // Attempt auto-restart if not intentionally stopped
          if (process.config.autoRestart !== false) {
            setTimeout(() => {
              if (process.status === 'disconnected') {
                this.handleAutoRestart(name);
              }
            }, 5000);
          }
        }
      }
    });

    // Listen for error events
    this.connectionManager.on('error', (event) => {
      if (event.name === name) {
        const process = this.processes.get(name);
        
        if (process) {
          process.errors.push({
            timestamp: new Date(),
            message: event.error.message
          });
          
          // Keep only last 10 errors
          if (process.errors.length > 10) {
            process.errors.shift();
          }
        }
      }
    });
  }

  /**
   * Validate MCP configuration
   */
  validateConfig(config) {
    const errors = [];
    
    // Check required fields based on transport
    if (config.transport === 'stdio' && !config.command) {
      errors.push('Command is required for stdio transport');
    }
    
    if ((config.transport === 'http' || config.transport === 'sse') && !config.url) {
      errors.push('URL is required for HTTP/SSE transport');
    }

    // Check required configurable fields
    if (config.configurable) {
      for (const [key, fieldConfig] of Object.entries(config.configurable)) {
        if (fieldConfig.required && !config[key]) {
          errors.push(`Required field missing: ${key}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Resolve configuration values
   */
  async resolveConfig(config) {
    const resolved = { ...config };
    
    // Resolve configurable fields
    if (config.configurable) {
      for (const [key, fieldConfig] of Object.entries(config.configurable)) {
        if (!resolved[key] && fieldConfig.default) {
          resolved[key] = fieldConfig.default;
        }
        
        // Expand paths
        if (resolved[key] && typeof resolved[key] === 'string') {
          resolved[key] = resolved[key]
            .replace('~', require('os').homedir())
            .replace('$HOME', require('os').homedir())
            .replace('$CWD', process.cwd());
        }
      }
    }
    
    // Resolve working directory
    if (resolved.workingDirectory) {
      resolved.workingDirectory = path.resolve(resolved.workingDirectory);
    }
    
    return resolved;
  }

  /**
   * Export process statistics
   */
  getStatistics() {
    const stats = {
      total: this.processes.size,
      running: 0,
      stopped: 0,
      failed: 0,
      totalRestarts: 0,
      totalErrors: 0
    };
    
    for (const process of this.processes.values()) {
      if (process.status === 'running') stats.running++;
      if (process.status === 'stopped') stats.stopped++;
      if (process.status === 'failed') stats.failed++;
      stats.totalRestarts += process.restarts;
      stats.totalErrors += process.errors.length;
    }
    
    return stats;
  }
}

module.exports = MCPProcessManager;