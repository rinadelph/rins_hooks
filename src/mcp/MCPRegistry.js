const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

/**
 * MCP Registry - Centralized catalog of all available MCP servers
 * Handles discovery, registration, and metadata management
 */
class MCPRegistry {
  constructor() {
    this.registryPath = path.join(require('os').homedir(), '.rapala', 'mcp-registry.json');
    this.registry = {};
    this.builtInMCPs = this.getBuiltInMCPs();
    this.loadRegistry();
  }

  /**
   * Load registry from disk
   */
  async loadRegistry() {
    try {
      await fs.ensureDir(path.dirname(this.registryPath));
      if (await fs.pathExists(this.registryPath)) {
        this.registry = await fs.readJson(this.registryPath);
      } else {
        this.registry = {
          servers: {},
          categories: {
            filesystem: [],
            database: [],
            api: [],
            development: [],
            productivity: [],
            custom: []
          },
          lastUpdated: new Date().toISOString()
        };
        await this.saveRegistry();
      }
    } catch (error) {
      console.error(chalk.red('Failed to load MCP registry:'), error);
      this.registry = { servers: {}, categories: {} };
    }
  }

  /**
   * Save registry to disk
   */
  async saveRegistry() {
    try {
      await fs.ensureDir(path.dirname(this.registryPath));
      await fs.writeJson(this.registryPath, this.registry, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red('Failed to save MCP registry:'), error);
    }
  }

  /**
   * Get built-in MCP definitions
   */
  getBuiltInMCPs() {
    return {
      'filesystem': {
        name: 'filesystem',
        displayName: 'Filesystem MCP',
        description: 'File and directory operations with safety controls',
        category: 'filesystem',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: {},
        configurable: {
          allowedDirectories: {
            type: 'array',
            description: 'Directories the MCP can access',
            default: ['$CWD']
          },
          blockedPaths: {
            type: 'array',
            description: 'Paths to block access to',
            default: ['/.git', '/node_modules', '/.env']
          }
        },
        capabilities: ['read', 'write', 'list', 'search'],
        status: 'available',
        official: true
      },
      'github': {
        name: 'github',
        displayName: 'GitHub MCP',
        description: 'GitHub API integration for repos, issues, PRs',
        category: 'api',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: '$GITHUB_TOKEN'
        },
        configurable: {
          token: {
            type: 'string',
            description: 'GitHub Personal Access Token',
            required: true,
            secure: true
          },
          owner: {
            type: 'string',
            description: 'Default repository owner',
            required: false
          }
        },
        capabilities: ['repos', 'issues', 'pull_requests', 'actions'],
        status: 'requires-config',
        official: true
      },
      'postgres': {
        name: 'postgres',
        displayName: 'PostgreSQL MCP',
        description: 'PostgreSQL database operations',
        category: 'database',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: {},
        configurable: {
          connectionString: {
            type: 'string',
            description: 'PostgreSQL connection string',
            required: true,
            secure: true,
            example: 'postgresql://user:password@localhost:5432/dbname'
          }
        },
        capabilities: ['query', 'schema', 'tables', 'data'],
        status: 'requires-config',
        official: true
      },
      'sqlite': {
        name: 'sqlite',
        displayName: 'SQLite MCP',
        description: 'SQLite database operations',
        category: 'database',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite', '$DB_PATH'],
        env: {},
        configurable: {
          dbPath: {
            type: 'string',
            description: 'Path to SQLite database file',
            required: true,
            default: './database.db'
          }
        },
        capabilities: ['query', 'schema', 'tables', 'data'],
        status: 'available',
        official: true
      },
      'memory': {
        name: 'memory',
        displayName: 'Memory MCP',
        description: 'Knowledge graph for memory and context',
        category: 'productivity',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: {},
        configurable: {
          storePath: {
            type: 'string',
            description: 'Path to store memory data',
            default: '~/.rapala/memory'
          }
        },
        capabilities: ['store', 'retrieve', 'relate', 'search'],
        status: 'available',
        official: true
      },
      'time': {
        name: 'time',
        displayName: 'Time MCP',
        description: 'Current time and timezone operations',
        category: 'productivity',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-time'],
        env: {},
        configurable: {},
        capabilities: ['current_time', 'timezone', 'conversion'],
        status: 'available',
        official: true
      },
      'fetch': {
        name: 'fetch',
        displayName: 'Fetch MCP',
        description: 'HTTP client for web requests',
        category: 'api',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        env: {},
        configurable: {
          allowedDomains: {
            type: 'array',
            description: 'Allowed domains for requests',
            default: ['*']
          },
          headers: {
            type: 'object',
            description: 'Default headers for requests',
            default: {}
          }
        },
        capabilities: ['get', 'post', 'put', 'delete', 'headers'],
        status: 'available',
        official: true
      }
    };
  }

  /**
   * Register a new MCP server
   */
  async registerMCP(config) {
    const { name } = config;
    
    if (!name) {
      throw new Error('MCP name is required');
    }

    // Validate transport type
    if (!['stdio', 'sse', 'http'].includes(config.transport)) {
      throw new Error(`Invalid transport type: ${config.transport}`);
    }

    // Add to registry
    this.registry.servers[name] = {
      ...config,
      registeredAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      status: config.status || 'available',
      enabled: config.enabled !== false
    };

    // Add to category if specified
    if (config.category && this.registry.categories[config.category]) {
      if (!this.registry.categories[config.category].includes(name)) {
        this.registry.categories[config.category].push(name);
      }
    }

    await this.saveRegistry();
    console.log(chalk.green(`✅ Registered MCP: ${name}`));
  }

  /**
   * Get all registered MCPs
   */
  getAllMCPs() {
    return {
      ...this.builtInMCPs,
      ...this.registry.servers
    };
  }

  /**
   * Get MCP by name
   */
  getMCP(name) {
    return this.builtInMCPs[name] || this.registry.servers[name];
  }

  /**
   * Get MCPs by category
   */
  getMCPsByCategory(category) {
    const allMCPs = this.getAllMCPs();
    return Object.values(allMCPs).filter(mcp => mcp.category === category);
  }

  /**
   * Update MCP configuration
   */
  async updateMCP(name, updates) {
    const mcp = this.getMCP(name);
    if (!mcp) {
      throw new Error(`MCP not found: ${name}`);
    }

    if (this.builtInMCPs[name]) {
      // For built-in MCPs, save overrides in registry
      this.registry.servers[name] = {
        ...this.builtInMCPs[name],
        ...updates,
        lastModified: new Date().toISOString()
      };
    } else {
      // Update custom MCP
      this.registry.servers[name] = {
        ...mcp,
        ...updates,
        lastModified: new Date().toISOString()
      };
    }

    await this.saveRegistry();
    console.log(chalk.green(`✅ Updated MCP: ${name}`));
  }

  /**
   * Remove MCP from registry
   */
  async removeMCP(name) {
    if (this.builtInMCPs[name]) {
      console.log(chalk.yellow(`⚠️  Cannot remove built-in MCP: ${name}`));
      return false;
    }

    if (this.registry.servers[name]) {
      delete this.registry.servers[name];
      
      // Remove from categories
      for (const category in this.registry.categories) {
        const index = this.registry.categories[category].indexOf(name);
        if (index > -1) {
          this.registry.categories[category].splice(index, 1);
        }
      }

      await this.saveRegistry();
      console.log(chalk.green(`✅ Removed MCP: ${name}`));
      return true;
    }

    console.log(chalk.yellow(`⚠️  MCP not found: ${name}`));
    return false;
  }

  /**
   * Search MCPs by query
   */
  searchMCPs(query) {
    const allMCPs = this.getAllMCPs();
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [name, mcp] of Object.entries(allMCPs)) {
      if (
        name.toLowerCase().includes(searchTerm) ||
        mcp.displayName?.toLowerCase().includes(searchTerm) ||
        mcp.description?.toLowerCase().includes(searchTerm) ||
        mcp.category?.toLowerCase().includes(searchTerm)
      ) {
        results.push(mcp);
      }
    }

    return results;
  }

  /**
   * Validate MCP configuration
   */
  validateMCPConfig(config) {
    const errors = [];
    
    if (!config.name) errors.push('Name is required');
    if (!config.transport) errors.push('Transport type is required');
    if (!config.command && config.transport === 'stdio') errors.push('Command is required for stdio transport');
    if (!config.url && config.transport === 'http') errors.push('URL is required for HTTP transport');
    if (!config.url && config.transport === 'sse') errors.push('URL is required for SSE transport');
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Import MCP from package.json or external source
   */
  async importMCP(source) {
    if (source.startsWith('http')) {
      // Import from URL
      const response = await fetch(source);
      const config = await response.json();
      await this.registerMCP(config);
    } else if (source.endsWith('.json')) {
      // Import from file
      const config = await fs.readJson(source);
      await this.registerMCP(config);
    } else {
      // Try to import from npm package
      try {
        const packagePath = require.resolve(source);
        const packageDir = path.dirname(packagePath);
        const packageJson = await fs.readJson(path.join(packageDir, 'package.json'));
        
        if (packageJson.mcp) {
          await this.registerMCP(packageJson.mcp);
        } else {
          throw new Error('No MCP configuration found in package.json');
        }
      } catch (error) {
        throw new Error(`Failed to import MCP from ${source}: ${error.message}`);
      }
    }
  }
}

module.exports = MCPRegistry;