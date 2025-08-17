const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const MCPRegistry = require('./MCPRegistry');
const MCPConnectionManager = require('./MCPConnectionManager');
const MCPProcessManager = require('./MCPProcessManager');

/**
 * MCP Manager - Main interface for MCP management
 * Integrates registry, connections, and process management
 */
class MCPManager {
  constructor() {
    this.registry = new MCPRegistry();
    this.connectionManager = new MCPConnectionManager();
    this.processManager = new MCPProcessManager(this.connectionManager, this.registry);
    this.configPath = path.join(require('os').homedir(), '.rapala', 'mcp-config.json');
    this.config = {};
    this.loadConfig();
    this.setupEventHandlers();
  }

  /**
   * Load MCP configuration
   */
  async loadConfig() {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      if (await fs.pathExists(this.configPath)) {
        this.config = await fs.readJson(this.configPath);
      } else {
        this.config = {
          autoStart: [],
          profiles: {},
          globalSettings: {
            healthCheckInterval: 30000,
            maxRestartAttempts: 3,
            startupTimeout: 10000
          },
          projectOverrides: {}
        };
        await this.saveConfig();
      }
    } catch (error) {
      console.error(chalk.red('Failed to load MCP config:'), error);
    }
  }

  /**
   * Save MCP configuration
   */
  async saveConfig() {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJson(this.configPath, this.config, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red('Failed to save MCP config:'), error);
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Process manager events
    this.processManager.on('started', ({ name }) => {
      console.log(chalk.green(`📡 MCP ${name} started`));
      this.updateClaudeSettings();
    });

    this.processManager.on('stopped', ({ name }) => {
      console.log(chalk.yellow(`🛑 MCP ${name} stopped`));
      this.updateClaudeSettings();
    });

    this.processManager.on('health-check', ({ name, status }) => {
      if (status !== 'healthy') {
        console.log(chalk.yellow(`⚠️  MCP ${name} health: ${status}`));
      }
    });

    // Connection manager events
    this.connectionManager.on('message', ({ name, message }) => {
      // Handle server-initiated messages
      if (message.method === 'notification') {
        console.log(chalk.blue(`📬 [${name}] ${message.params.message}`));
      }
    });
  }

  /**
   * Initialize MCP Manager
   */
  async initialize() {
    console.log(chalk.blue('🚀 Initializing MCP Manager...'));
    
    // Load registry
    await this.registry.loadRegistry();
    
    // Auto-start configured MCPs
    if (this.config.autoStart && this.config.autoStart.length > 0) {
      console.log(chalk.blue('Starting auto-start MCPs...'));
      for (const name of this.config.autoStart) {
        try {
          await this.start(name);
        } catch (error) {
          console.error(chalk.red(`Failed to auto-start ${name}: ${error.message}`));
        }
      }
    }
    
    console.log(chalk.green('✅ MCP Manager initialized'));
  }

  /**
   * Add a new MCP
   */
  async add(config) {
    // Validate configuration
    const validation = this.registry.validateMCPConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid MCP configuration: ${validation.errors.join(', ')}`);
    }

    // Register in registry
    await this.registry.registerMCP(config);
    
    // Optionally start immediately
    if (config.autoStart) {
      await this.start(config.name);
    }
    
    // Update Claude settings
    await this.updateClaudeSettings();
    
    return config.name;
  }

  /**
   * Remove an MCP
   */
  async remove(name) {
    // Stop if running
    await this.stop(name);
    
    // Remove from registry
    await this.registry.removeMCP(name);
    
    // Remove from auto-start
    const index = this.config.autoStart.indexOf(name);
    if (index > -1) {
      this.config.autoStart.splice(index, 1);
      await this.saveConfig();
    }
    
    // Update Claude settings
    await this.updateClaudeSettings();
  }

  /**
   * Start an MCP
   */
  async start(name, options = {}) {
    // Get configuration
    const mcpConfig = this.registry.getMCP(name);
    if (!mcpConfig) {
      throw new Error(`MCP not found: ${name}`);
    }

    // Apply project overrides if available
    const projectOverride = this.getProjectOverride(name);
    const finalConfig = {
      ...mcpConfig,
      ...projectOverride,
      ...options
    };

    // Start the process
    await this.processManager.start(name, finalConfig);
  }

  /**
   * Stop an MCP
   */
  async stop(name) {
    await this.processManager.stop(name);
  }

  /**
   * Restart an MCP
   */
  async restart(name) {
    await this.processManager.restart(name);
  }

  /**
   * List all MCPs
   */
  async list() {
    const allMCPs = this.registry.getAllMCPs();
    const statuses = this.processManager.getAllStatuses();
    
    const list = [];
    
    for (const [name, mcp] of Object.entries(allMCPs)) {
      const status = statuses[name] || { status: 'not-running' };
      
      list.push({
        name: mcp.name,
        displayName: mcp.displayName,
        category: mcp.category,
        transport: mcp.transport,
        status: status.status,
        official: mcp.official || false,
        autoStart: this.config.autoStart.includes(name)
      });
    }
    
    return list;
  }

  /**
   * Get MCP status
   */
  async status(name) {
    const mcp = this.registry.getMCP(name);
    if (!mcp) {
      throw new Error(`MCP not found: ${name}`);
    }

    const processStatus = this.processManager.getStatus(name);
    
    return {
      ...mcp,
      ...processStatus
    };
  }

  /**
   * Configure an MCP
   */
  async configure(name, configuration) {
    const mcp = this.registry.getMCP(name);
    if (!mcp) {
      throw new Error(`MCP not found: ${name}`);
    }

    // Update registry
    await this.registry.updateMCP(name, configuration);
    
    // If running, restart with new config
    const status = this.processManager.getStatus(name);
    if (status.status === 'running') {
      await this.restart(name);
    }
  }

  /**
   * Create a profile (set of MCPs to start together)
   */
  async createProfile(profileName, mcpNames) {
    this.config.profiles[profileName] = mcpNames;
    await this.saveConfig();
    console.log(chalk.green(`✅ Created profile: ${profileName}`));
  }

  /**
   * Start a profile
   */
  async startProfile(profileName) {
    const mcpNames = this.config.profiles[profileName];
    if (!mcpNames) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    console.log(chalk.blue(`Starting profile: ${profileName}`));
    
    const results = { success: [], failed: [] };
    
    for (const name of mcpNames) {
      try {
        await this.start(name);
        results.success.push(name);
      } catch (error) {
        console.error(chalk.red(`Failed to start ${name}: ${error.message}`));
        results.failed.push({ name, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Stop a profile
   */
  async stopProfile(profileName) {
    const mcpNames = this.config.profiles[profileName];
    if (!mcpNames) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    console.log(chalk.blue(`Stopping profile: ${profileName}`));
    
    for (const name of mcpNames) {
      try {
        await this.stop(name);
      } catch (error) {
        console.error(chalk.red(`Failed to stop ${name}: ${error.message}`));
      }
    }
  }

  /**
   * Get project-specific override
   */
  getProjectOverride(name) {
    const projectPath = process.cwd();
    const overrides = this.config.projectOverrides[projectPath];
    
    if (overrides && overrides[name]) {
      return overrides[name];
    }
    
    return {};
  }

  /**
   * Set project-specific override
   */
  async setProjectOverride(name, override) {
    const projectPath = process.cwd();
    
    if (!this.config.projectOverrides[projectPath]) {
      this.config.projectOverrides[projectPath] = {};
    }
    
    this.config.projectOverrides[projectPath][name] = override;
    await this.saveConfig();
  }

  /**
   * Update Claude settings.json with MCP configurations
   */
  async updateClaudeSettings() {
    const claudeSettingsPath = path.join(require('os').homedir(), '.claude', 'settings.json');
    
    try {
      // Load current settings
      let settings = {};
      if (await fs.pathExists(claudeSettingsPath)) {
        settings = await fs.readJson(claudeSettingsPath);
      }

      // Get all running MCPs
      const statuses = this.processManager.getAllStatuses();
      const runningMCPs = {};

      for (const [name, status] of Object.entries(statuses)) {
        if (status.status === 'running') {
          const mcp = this.registry.getMCP(name);
          
          // Format for Claude settings
          if (mcp.transport === 'stdio') {
            runningMCPs[name] = {
              command: mcp.command,
              args: mcp.args || [],
              env: mcp.env || {}
            };
          } else if (mcp.transport === 'http' || mcp.transport === 'sse') {
            runningMCPs[name] = {
              url: mcp.url,
              headers: mcp.headers || {},
              transport: mcp.transport
            };
          }
        }
      }

      // Update settings
      settings.mcpServers = runningMCPs;
      
      // Save settings
      await fs.ensureDir(path.dirname(claudeSettingsPath));
      await fs.writeJson(claudeSettingsPath, settings, { spaces: 2 });
      
      console.log(chalk.green('✅ Updated Claude settings with MCP configurations'));
    } catch (error) {
      console.error(chalk.red('Failed to update Claude settings:'), error);
    }
  }

  /**
   * Interactive MCP installer
   */
  async interactiveInstall() {
    const choices = [
      { name: '📁 Filesystem - File and directory operations', value: 'filesystem' },
      { name: '🐙 GitHub - GitHub API integration', value: 'github' },
      { name: '🐘 PostgreSQL - PostgreSQL database', value: 'postgres' },
      { name: '💾 SQLite - SQLite database', value: 'sqlite' },
      { name: '🧠 Memory - Knowledge graph', value: 'memory' },
      { name: '⏰ Time - Time and timezone operations', value: 'time' },
      { name: '🌐 Fetch - HTTP client', value: 'fetch' },
      { name: '➕ Add custom MCP...', value: 'custom' }
    ];

    const { mcpChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mcpChoice',
        message: 'Select an MCP to install:',
        choices
      }
    ]);

    if (mcpChoice === 'custom') {
      await this.interactiveCustomMCP();
    } else {
      await this.installBuiltIn(mcpChoice);
    }
  }

  /**
   * Install a built-in MCP
   */
  async installBuiltIn(name) {
    const mcp = this.registry.getMCP(name);
    
    if (!mcp) {
      throw new Error(`Built-in MCP not found: ${name}`);
    }

    // Check for required configuration
    if (mcp.status === 'requires-config' && mcp.configurable) {
      console.log(chalk.yellow('This MCP requires configuration:'));
      
      const config = {};
      
      for (const [key, fieldConfig] of Object.entries(mcp.configurable)) {
        if (fieldConfig.required) {
          const { value } = await inquirer.prompt([
            {
              type: fieldConfig.secure ? 'password' : 'input',
              name: 'value',
              message: `${fieldConfig.description}:`,
              default: fieldConfig.default,
              validate: (input) => input ? true : 'This field is required'
            }
          ]);
          
          config[key] = value;
        }
      }

      // Apply configuration
      await this.configure(name, config);
    }

    // Ask if should auto-start
    const { autoStart } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'autoStart',
        message: 'Auto-start this MCP on initialization?',
        default: true
      }
    ]);

    if (autoStart) {
      if (!this.config.autoStart.includes(name)) {
        this.config.autoStart.push(name);
        await this.saveConfig();
      }
    }

    // Start the MCP
    const { startNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'startNow',
        message: 'Start the MCP now?',
        default: true
      }
    ]);

    if (startNow) {
      await this.start(name);
    }
  }

  /**
   * Interactive custom MCP configuration
   */
  async interactiveCustomMCP() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'MCP name (unique identifier):',
        validate: (input) => input ? true : 'Name is required'
      },
      {
        type: 'input',
        name: 'displayName',
        message: 'Display name:',
        validate: (input) => input ? true : 'Display name is required'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:'
      },
      {
        type: 'list',
        name: 'transport',
        message: 'Transport type:',
        choices: ['stdio', 'http', 'sse']
      }
    ]);

    // Transport-specific configuration
    if (answers.transport === 'stdio') {
      const stdioConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: 'Command to run:',
          validate: (input) => input ? true : 'Command is required'
        },
        {
          type: 'input',
          name: 'args',
          message: 'Arguments (comma-separated):',
          filter: (input) => input ? input.split(',').map(arg => arg.trim()) : []
        },
        {
          type: 'input',
          name: 'workingDirectory',
          message: 'Working directory (optional):'
        }
      ]);
      
      Object.assign(answers, stdioConfig);
    } else if (answers.transport === 'http' || answers.transport === 'sse') {
      const httpConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Server URL:',
          validate: (input) => input ? true : 'URL is required'
        },
        {
          type: 'password',
          name: 'auth',
          message: 'Authorization token (optional):'
        }
      ]);
      
      Object.assign(answers, httpConfig);
    }

    // Category
    const { category } = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Category:',
        choices: ['filesystem', 'database', 'api', 'development', 'productivity', 'custom']
      }
    ]);
    
    answers.category = category;

    // Register the custom MCP
    await this.add(answers);
    
    console.log(chalk.green(`✅ Custom MCP ${answers.name} added successfully`));
  }

  /**
   * Discover capabilities of an MCP
   */
  async discoverCapabilities(name) {
    const status = this.processManager.getStatus(name);
    
    if (status.status !== 'running') {
      throw new Error(`MCP ${name} is not running`);
    }

    try {
      // Request tool listing
      const tools = await this.connectionManager.sendRequest(name, 'tools/list', {});
      
      // Request resource listing
      const resources = await this.connectionManager.sendRequest(name, 'resources/list', {});
      
      // Request prompt listing
      const prompts = await this.connectionManager.sendRequest(name, 'prompts/list', {});
      
      return {
        tools: tools || [],
        resources: resources || [],
        prompts: prompts || []
      };
    } catch (error) {
      console.error(chalk.red(`Failed to discover capabilities: ${error.message}`));
      return {
        tools: [],
        resources: [],
        prompts: []
      };
    }
  }

  /**
   * Call a tool on an MCP
   */
  async callTool(name, toolName, args = {}) {
    return this.connectionManager.sendRequest(name, `tools/call`, {
      name: toolName,
      arguments: args
    });
  }

  /**
   * Read a resource from an MCP
   */
  async readResource(name, resourceUri) {
    return this.connectionManager.sendRequest(name, `resources/read`, {
      uri: resourceUri
    });
  }

  /**
   * Get a prompt from an MCP
   */
  async getPrompt(name, promptName, args = {}) {
    return this.connectionManager.sendRequest(name, `prompts/get`, {
      name: promptName,
      arguments: args
    });
  }
}

module.exports = MCPManager;