#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const HookManager = require('../hook-manager');
const StatusLineManager = require('../statusline/StatusLineManager');
const MCPManager = require('./MCPManager');

/**
 * Rapala MCP Server - Exposes Rapala hooks system as an MCP server
 * Implements the Model Context Protocol via stdio
 */
class RapalaMCPServer {
  constructor() {
    this.protocolVersion = '1.0.0';
    this.serverInfo = {
      name: 'rapala-mcp',
      version: '1.0.0',
      description: 'Rapala Hooks System MCP Server'
    };
    
    this.hookManager = null;
    this.statusLineManager = new StatusLineManager();
    this.mcpManager = new MCPManager();
    
    this.tools = this.defineTools();
    this.resources = this.defineResources();
    this.prompts = this.definePrompts();
    
    this.setupStdio();
  }

  /**
   * Setup stdio communication
   */
  setupStdio() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', async (line) => {
      try {
        const message = JSON.parse(line);
        const response = await this.handleMessage(message);
        if (response) {
          this.sendResponse(response);
        }
      } catch (error) {
        this.sendError(null, -32700, 'Parse error', error.message);
      }
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down...');
      process.exit(0);
    });
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message) {
    const { id, method, params } = message;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id, params);
        
        case 'tools/list':
          return this.handleToolsList(id);
        
        case 'tools/call':
          return this.handleToolCall(id, params);
        
        case 'resources/list':
          return this.handleResourcesList(id);
        
        case 'resources/read':
          return this.handleResourceRead(id, params);
        
        case 'prompts/list':
          return this.handlePromptsList(id);
        
        case 'prompts/get':
          return this.handlePromptGet(id, params);
        
        case 'health':
          return this.handleHealth(id);
        
        default:
          return this.sendError(id, -32601, 'Method not found', `Unknown method: ${method}`);
      }
    } catch (error) {
      return this.sendError(id, -32603, 'Internal error', error.message);
    }
  }

  /**
   * Handle initialize request
   */
  handleInitialize(id, params) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: this.protocolVersion,
        serverInfo: this.serverInfo,
        capabilities: {
          tools: true,
          resources: true,
          prompts: true
        }
      }
    };
  }

  /**
   * Handle tools/list request
   */
  handleToolsList(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: Object.values(this.tools)
      }
    };
  }

  /**
   * Handle tools/call request
   */
  async handleToolCall(id, params) {
    const { name, arguments: args } = params;
    
    const tool = this.tools[name];
    if (!tool) {
      return this.sendError(id, -32602, 'Invalid params', `Unknown tool: ${name}`);
    }

    try {
      const result = await tool.handler(args);
      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      return this.sendError(id, -32603, 'Tool execution error', error.message);
    }
  }

  /**
   * Handle resources/list request
   */
  handleResourcesList(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        resources: Object.values(this.resources)
      }
    };
  }

  /**
   * Handle resources/read request
   */
  async handleResourceRead(id, params) {
    const { uri } = params;
    
    const resourceKey = uri.replace('rapala://', '');
    const resource = this.resources[resourceKey];
    
    if (!resource) {
      return this.sendError(id, -32602, 'Invalid params', `Unknown resource: ${uri}`);
    }

    try {
      const content = await resource.handler();
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: resource.mimeType || 'text/plain',
              text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return this.sendError(id, -32603, 'Resource read error', error.message);
    }
  }

  /**
   * Handle prompts/list request
   */
  handlePromptsList(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        prompts: Object.values(this.prompts).map(p => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments
        }))
      }
    };
  }

  /**
   * Handle prompts/get request
   */
  async handlePromptGet(id, params) {
    const { name, arguments: args } = params;
    
    const prompt = this.prompts[name];
    if (!prompt) {
      return this.sendError(id, -32602, 'Invalid params', `Unknown prompt: ${name}`);
    }

    try {
      const messages = await prompt.handler(args);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          description: prompt.description,
          messages
        }
      };
    } catch (error) {
      return this.sendError(id, -32603, 'Prompt generation error', error.message);
    }
  }

  /**
   * Handle health check
   */
  handleHealth(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Define available tools
   */
  defineTools() {
    return {
      'rapala.hook.list': {
        name: 'rapala.hook.list',
        description: 'List all available hooks',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category (optional)'
            }
          }
        },
        handler: async (args) => {
          const hooksDir = path.join(__dirname, '../../hooks');
          const hooks = [];
          
          const dirs = await fs.readdir(hooksDir);
          for (const dir of dirs) {
            const configPath = path.join(hooksDir, dir, 'config.json');
            if (await fs.pathExists(configPath)) {
              const config = await fs.readJson(configPath);
              if (!args.category || config.category === args.category) {
                hooks.push({
                  name: config.name,
                  description: config.description,
                  enabled: !config.disabled,
                  events: config.events || []
                });
              }
            }
          }
          
          return hooks;
        }
      },
      
      'rapala.hook.enable': {
        name: 'rapala.hook.enable',
        description: 'Enable a hook',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Hook name'
            }
          },
          required: ['name']
        },
        handler: async (args) => {
          const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
          if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            config.disabled = false;
            await fs.writeJson(configPath, config, { spaces: 2 });
            return { success: true, message: `Hook ${args.name} enabled` };
          }
          throw new Error(`Hook not found: ${args.name}`);
        }
      },
      
      'rapala.hook.disable': {
        name: 'rapala.hook.disable',
        description: 'Disable a hook',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Hook name'
            }
          },
          required: ['name']
        },
        handler: async (args) => {
          const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
          if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            config.disabled = true;
            await fs.writeJson(configPath, config, { spaces: 2 });
            return { success: true, message: `Hook ${args.name} disabled` };
          }
          throw new Error(`Hook not found: ${args.name}`);
        }
      },
      
      'rapala.statusline.templates': {
        name: 'rapala.statusline.templates',
        description: 'List available status line templates',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        handler: async () => {
          return this.statusLineManager.availableTemplates.map(t => ({
            name: t.name,
            displayName: t.displayName,
            description: t.description,
            preview: t.preview
          }));
        }
      },
      
      'rapala.statusline.apply': {
        name: 'rapala.statusline.apply',
        description: 'Apply a status line template',
        inputSchema: {
          type: 'object',
          properties: {
            template: {
              type: 'string',
              description: 'Template name'
            },
            scope: {
              type: 'string',
              enum: ['user', 'project'],
              description: 'Configuration scope'
            }
          },
          required: ['template']
        },
        handler: async (args) => {
          const template = this.statusLineManager.availableTemplates.find(t => t.name === args.template);
          if (!template) {
            throw new Error(`Template not found: ${args.template}`);
          }
          
          const config = {
            type: 'command',
            command: template.script,
            template: template.name,
            components: template.components
          };
          
          await this.statusLineManager.saveConfig(config, args.scope || 'user');
          return { success: true, message: `Applied template: ${args.template}` };
        }
      },
      
      'rapala.mcp.list': {
        name: 'rapala.mcp.list',
        description: 'List all registered MCP servers',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category'
            }
          }
        },
        handler: async (args) => {
          await this.mcpManager.initialize();
          const list = await this.mcpManager.list();
          
          if (args.category) {
            return list.filter(mcp => mcp.category === args.category);
          }
          
          return list;
        }
      },
      
      'rapala.mcp.start': {
        name: 'rapala.mcp.start',
        description: 'Start an MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'MCP server name'
            }
          },
          required: ['name']
        },
        handler: async (args) => {
          await this.mcpManager.start(args.name);
          return { success: true, message: `Started MCP: ${args.name}` };
        }
      },
      
      'rapala.mcp.stop': {
        name: 'rapala.mcp.stop',
        description: 'Stop an MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'MCP server name'
            }
          },
          required: ['name']
        },
        handler: async (args) => {
          await this.mcpManager.stop(args.name);
          return { success: true, message: `Stopped MCP: ${args.name}` };
        }
      },
      
      'rapala.mcp.status': {
        name: 'rapala.mcp.status',
        description: 'Get status of an MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'MCP server name'
            }
          },
          required: ['name']
        },
        handler: async (args) => {
          return await this.mcpManager.status(args.name);
        }
      },
      
      'rapala.mcp.discover': {
        name: 'rapala.mcp.discover',
        description: 'Discover capabilities of an MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'MCP server name'
            }
          },
          required: ['name']
        },
        handler: async (args) => {
          return await this.mcpManager.discoverCapabilities(args.name);
        }
      }
    };
  }

  /**
   * Define available resources
   */
  defineResources() {
    return {
      'hooks': {
        uri: 'rapala://hooks',
        name: 'Available Hooks',
        description: 'List of all available hooks and their configurations',
        mimeType: 'application/json',
        handler: async () => {
          const hooksDir = path.join(__dirname, '../../hooks');
          const hooks = {};
          
          const dirs = await fs.readdir(hooksDir);
          for (const dir of dirs) {
            const configPath = path.join(hooksDir, dir, 'config.json');
            if (await fs.pathExists(configPath)) {
              hooks[dir] = await fs.readJson(configPath);
            }
          }
          
          return hooks;
        }
      },
      
      'statusline/templates': {
        uri: 'rapala://statusline/templates',
        name: 'Status Line Templates',
        description: 'Available status line templates and configurations',
        mimeType: 'application/json',
        handler: async () => {
          return this.statusLineManager.availableTemplates;
        }
      },
      
      'statusline/components': {
        uri: 'rapala://statusline/components',
        name: 'Status Line Components',
        description: 'Available status line components',
        mimeType: 'application/json',
        handler: async () => {
          return this.statusLineManager.availableComponents;
        }
      },
      
      'mcp/registry': {
        uri: 'rapala://mcp/registry',
        name: 'MCP Registry',
        description: 'Registry of all available MCP servers',
        mimeType: 'application/json',
        handler: async () => {
          await this.mcpManager.registry.loadRegistry();
          return this.mcpManager.registry.getAllMCPs();
        }
      },
      
      'mcp/status': {
        uri: 'rapala://mcp/status',
        name: 'MCP Status',
        description: 'Current status of all MCP servers',
        mimeType: 'application/json',
        handler: async () => {
          return this.mcpManager.processManager.getAllStatuses();
        }
      },
      
      'config': {
        uri: 'rapala://config',
        name: 'Rapala Configuration',
        description: 'Main Rapala configuration',
        mimeType: 'application/json',
        handler: async () => {
          const configPath = path.join(require('os').homedir(), '.rapala', 'config.json');
          if (await fs.pathExists(configPath)) {
            return await fs.readJson(configPath);
          }
          return {};
        }
      }
    };
  }

  /**
   * Define available prompts
   */
  definePrompts() {
    return {
      'hook-creation': {
        name: 'hook-creation',
        description: 'Generate code for a new hook',
        arguments: [
          {
            name: 'hookName',
            description: 'Name of the hook',
            required: true
          },
          {
            name: 'eventType',
            description: 'Event type to hook into',
            required: true
          },
          {
            name: 'description',
            description: 'What the hook should do',
            required: true
          }
        ],
        handler: async (args) => {
          return [
            {
              role: 'system',
              content: 'You are a Rapala hook generator. Create a new hook implementation based on the requirements.'
            },
            {
              role: 'user',
              content: `Create a new Rapala hook with the following specifications:
- Name: ${args.hookName}
- Event: ${args.eventType}
- Description: ${args.description}

Generate the complete hook implementation including:
1. index.js file with the hook logic
2. config.json with hook metadata
3. Any necessary helper functions

Use the HookBase class and follow Rapala conventions.`
            }
          ];
        }
      },
      
      'mcp-integration': {
        name: 'mcp-integration',
        description: 'Guide for integrating a new MCP server',
        arguments: [
          {
            name: 'mcpType',
            description: 'Type of MCP to integrate',
            required: true
          },
          {
            name: 'transport',
            description: 'Transport type (stdio, http, sse)',
            required: true
          }
        ],
        handler: async (args) => {
          return [
            {
              role: 'system',
              content: 'You are an MCP integration expert. Guide the user through MCP server integration.'
            },
            {
              role: 'user',
              content: `Help me integrate a new MCP server:
- Type: ${args.mcpType}
- Transport: ${args.transport}

Provide step-by-step instructions for:
1. Configuring the MCP server
2. Registering it with Rapala
3. Setting up authentication if needed
4. Testing the connection
5. Using the MCP tools and resources`
            }
          ];
        }
      },
      
      'statusline-design': {
        name: 'statusline-design',
        description: 'Design a custom status line',
        arguments: [
          {
            name: 'components',
            description: 'Desired components (comma-separated)',
            required: true
          },
          {
            name: 'style',
            description: 'Visual style preference',
            required: false
          }
        ],
        handler: async (args) => {
          const components = args.components.split(',').map(c => c.trim());
          return [
            {
              role: 'system',
              content: 'You are a status line designer for Claude Code. Create custom status line configurations.'
            },
            {
              role: 'user',
              content: `Design a custom status line with:
- Components: ${components.join(', ')}
- Style: ${args.style || 'modern'}

Create:
1. A custom template configuration
2. Any needed component implementations
3. Color scheme and animations
4. Installation instructions`
            }
          ];
        }
      }
    };
  }

  /**
   * Send response
   */
  sendResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  /**
   * Send error response
   */
  sendError(id, code, message, data) {
    const error = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data
      }
    };
    this.sendResponse(error);
    return error;
  }

  /**
   * Log message (to stderr to not interfere with stdio protocol)
   */
  log(message) {
    process.stderr.write(`[Rapala MCP] ${message}\n`);
  }
}

// Start the server
const server = new RapalaMCPServer();
server.log('Rapala MCP Server started');

module.exports = RapalaMCPServer;