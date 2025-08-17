#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const MCPManager = require('./MCPManager');

/**
 * MCP Launcher - Launches and manages MCP servers for Claude
 * Can be used directly in Claude settings.json
 */
class MCPLauncher {
  constructor() {
    this.manager = new MCPManager();
    this.launchConfig = null;
    this.processes = new Map();
  }

  /**
   * Launch MCPs based on configuration
   */
  async launch(configPath) {
    try {
      // Load launch configuration
      if (configPath) {
        this.launchConfig = await fs.readJson(configPath);
      } else {
        // Use default configuration
        this.launchConfig = await this.getDefaultLaunchConfig();
      }

      console.log(chalk.blue('🚀 Launching MCP servers...'));

      // Initialize manager
      await this.manager.initialize();

      // Launch each configured MCP
      const results = { success: [], failed: [] };

      for (const mcpConfig of this.launchConfig.servers) {
        try {
          await this.launchMCP(mcpConfig);
          results.success.push(mcpConfig.name);
        } catch (error) {
          console.error(chalk.red(`Failed to launch ${mcpConfig.name}: ${error.message}`));
          results.failed.push({ name: mcpConfig.name, error: error.message });
        }
      }

      // Report results
      if (results.success.length > 0) {
        console.log(chalk.green(`✅ Launched: ${results.success.join(', ')}`));
      }
      if (results.failed.length > 0) {
        console.log(chalk.red(`❌ Failed: ${results.failed.map(f => f.name).join(', ')}`));
      }

      // Keep launcher running
      this.setupShutdownHandlers();
      
      // Start monitoring
      this.startMonitoring();

      return results;
    } catch (error) {
      console.error(chalk.red('Launch failed:'), error);
      process.exit(1);
    }
  }

  /**
   * Launch a single MCP
   */
  async launchMCP(config) {
    const { name, enabled = true } = config;

    if (!enabled) {
      console.log(chalk.gray(`⏭️  Skipping disabled MCP: ${name}`));
      return;
    }

    // Check if it's the Rapala MCP server
    if (name === 'rapala') {
      return this.launchRapalaMCP(config);
    }

    // Register if not already registered
    const existing = this.manager.registry.getMCP(name);
    if (!existing) {
      await this.manager.registry.registerMCP(config);
    }

    // Start the MCP
    await this.manager.start(name, config);
  }

  /**
   * Launch the Rapala MCP server
   */
  async launchRapalaMCP(config) {
    console.log(chalk.blue('🎣 Launching Rapala MCP Server...'));

    const rapalaMCPPath = path.join(__dirname, 'RapalaMCPServer.js');
    
    // Spawn Rapala MCP server as a child process
    const child = spawn('node', [rapalaMCPPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RAPALA_CONFIG: JSON.stringify(config)
      }
    });

    // Store process reference
    this.processes.set('rapala', {
      process: child,
      config,
      startedAt: new Date()
    });

    // Forward stdio
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    process.stdin.pipe(child.stdin);

    // Handle exit
    child.on('exit', (code) => {
      console.log(chalk.yellow(`Rapala MCP server exited with code ${code}`));
      this.processes.delete('rapala');
      
      // Auto-restart if configured
      if (config.autoRestart && code !== 0) {
        setTimeout(() => {
          console.log(chalk.yellow('Restarting Rapala MCP server...'));
          this.launchRapalaMCP(config);
        }, 5000);
      }
    });

    console.log(chalk.green('✅ Rapala MCP Server launched'));
  }

  /**
   * Get default launch configuration
   */
  async getDefaultLaunchConfig() {
    const configPath = path.join(require('os').homedir(), '.rapala', 'mcp-launch.json');
    
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }

    // Create default configuration
    const defaultConfig = {
      version: '1.0',
      servers: [
        {
          name: 'rapala',
          displayName: 'Rapala Hooks MCP',
          description: 'MCP server for Rapala hooks system',
          enabled: true,
          autoRestart: true,
          transport: 'stdio',
          capabilities: ['hooks', 'statusline', 'mcp-management']
        },
        {
          name: 'filesystem',
          displayName: 'Filesystem MCP',
          enabled: true,
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          configurable: {
            allowedDirectories: [process.cwd()]
          }
        }
      ],
      monitoring: {
        enabled: true,
        interval: 30000,
        healthCheck: true
      }
    };

    // Save default configuration
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, defaultConfig, { spaces: 2 });

    return defaultConfig;
  }

  /**
   * Start monitoring MCPs
   */
  startMonitoring() {
    if (!this.launchConfig.monitoring?.enabled) {
      return;
    }

    const interval = this.launchConfig.monitoring.interval || 30000;

    setInterval(() => {
      this.performHealthChecks();
    }, interval);
  }

  /**
   * Perform health checks on all MCPs
   */
  async performHealthChecks() {
    const statuses = await this.manager.processManager.getAllStatuses();
    
    for (const [name, status] of Object.entries(statuses)) {
      if (status.status === 'running') {
        console.log(chalk.gray(`✓ ${name}: ${status.status}`));
      } else if (status.status === 'error' || status.status === 'failed') {
        console.log(chalk.red(`✗ ${name}: ${status.status}`));
        
        // Attempt restart if configured
        const mcpConfig = this.launchConfig.servers.find(s => s.name === name);
        if (mcpConfig?.autoRestart) {
          console.log(chalk.yellow(`Restarting ${name}...`));
          await this.manager.restart(name);
        }
      }
    }
  }

  /**
   * Setup shutdown handlers
   */
  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      console.log(chalk.yellow(`\n📴 Received ${signal}, shutting down MCP servers...`));
      
      // Stop all MCPs
      await this.manager.processManager.stopAll();
      
      // Kill Rapala MCP if running
      const rapalaProcess = this.processes.get('rapala');
      if (rapalaProcess) {
        rapalaProcess.process.kill('SIGTERM');
      }
      
      console.log(chalk.green('Shutdown complete'));
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Generate Claude settings.json configuration
   */
  async generateClaudeConfig() {
    const config = {
      mcpServers: {}
    };

    // Add Rapala MCP launcher
    config.mcpServers['rapala-launcher'] = {
      command: 'node',
      args: [__filename, '--launch'],
      env: {}
    };

    // Generate configuration file
    const claudeConfigPath = path.join(require('os').homedir(), '.claude', 'mcp-config.json');
    await fs.ensureDir(path.dirname(claudeConfigPath));
    await fs.writeJson(claudeConfigPath, config, { spaces: 2 });

    console.log(chalk.green('✅ Generated Claude MCP configuration'));
    console.log(chalk.cyan('Add this to your Claude settings.json:'));
    console.log(JSON.stringify(config, null, 2));
    
    return config;
  }
}

// CLI interface
if (require.main === module) {
  const launcher = new MCPLauncher();
  const args = process.argv.slice(2);

  if (args.includes('--launch')) {
    // Launch mode - used by Claude
    launcher.launch().catch(error => {
      console.error(chalk.red('Launch failed:'), error);
      process.exit(1);
    });
  } else if (args.includes('--generate-config')) {
    // Generate Claude configuration
    launcher.generateClaudeConfig().catch(error => {
      console.error(chalk.red('Config generation failed:'), error);
      process.exit(1);
    });
  } else if (args.includes('--config')) {
    // Launch with specific config
    const configIndex = args.indexOf('--config');
    const configPath = args[configIndex + 1];
    launcher.launch(configPath).catch(error => {
      console.error(chalk.red('Launch failed:'), error);
      process.exit(1);
    });
  } else {
    // Show help
    console.log(chalk.cyan('MCP Launcher - Launch and manage MCP servers for Claude'));
    console.log('\nUsage:');
    console.log('  node MCPLauncher.js --launch           Launch MCPs (for Claude)');
    console.log('  node MCPLauncher.js --config <path>    Launch with specific config');
    console.log('  node MCPLauncher.js --generate-config  Generate Claude configuration');
  }
}

module.exports = MCPLauncher;