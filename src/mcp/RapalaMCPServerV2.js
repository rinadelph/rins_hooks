#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Rapala MCP Server V2 - Using proper MCP SDK
 * Exposes Rapala hooks system via Model Context Protocol
 */
class RapalaMCPServerV2 {
  constructor() {
    this.server = new Server(
      {
        name: 'rapala-mcp',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );
    
    this.setupTools();
    this.setupResources();
  }

  /**
   * Setup available tools
   */
  setupTools() {
    // Hook management tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'rapala_hook_list',
          description: 'List all available Rapala hooks',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Filter by category (optional)'
              }
            }
          }
        },
        {
          name: 'rapala_hook_enable',
          description: 'Enable a Rapala hook',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Hook name'
              }
            },
            required: ['name']
          }
        },
        {
          name: 'rapala_hook_disable',
          description: 'Disable a Rapala hook',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Hook name'
              }
            },
            required: ['name']
          }
        },
        {
          name: 'rapala_statusline_templates',
          description: 'List available status line templates',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'rapala_statusline_apply',
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
          }
        },
        {
          name: 'rapala_mcp_list',
          description: 'List all registered MCP servers',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Filter by category'
              }
            }
          }
        },
        {
          name: 'rapala_mcp_start',
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
          }
        },
        {
          name: 'rapala_mcp_stop',
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
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'rapala_hook_list':
            return await this.listHooks(args);
            
          case 'rapala_hook_enable':
            return await this.enableHook(args);
            
          case 'rapala_hook_disable':
            return await this.disableHook(args);
            
          case 'rapala_statusline_templates':
            return await this.listStatusLineTemplates();
            
          case 'rapala_statusline_apply':
            return await this.applyStatusLineTemplate(args);
            
          case 'rapala_mcp_list':
            return await this.listMCPs(args);
            
          case 'rapala_mcp_start':
            return await this.startMCP(args);
            
          case 'rapala_mcp_stop':
            return await this.stopMCP(args);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  /**
   * Setup available resources
   */
  setupResources() {
    this.server.setRequestHandler('resources/list', async () => ({
      resources: [
        {
          uri: 'rapala://hooks',
          name: 'Available Hooks',
          description: 'List of all available hooks and their configurations',
          mimeType: 'application/json'
        },
        {
          uri: 'rapala://statusline/templates',
          name: 'Status Line Templates',
          description: 'Available status line templates',
          mimeType: 'application/json'
        },
        {
          uri: 'rapala://statusline/components',
          name: 'Status Line Components',
          description: 'Available status line components',
          mimeType: 'application/json'
        },
        {
          uri: 'rapala://mcp/registry',
          name: 'MCP Registry',
          description: 'Registry of all available MCP servers',
          mimeType: 'application/json'
        },
        {
          uri: 'rapala://config',
          name: 'Rapala Configuration',
          description: 'Main Rapala configuration',
          mimeType: 'application/json'
        }
      ]
    }));

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      
      try {
        let content;
        
        switch (uri) {
          case 'rapala://hooks':
            content = await this.getHooksResource();
            break;
            
          case 'rapala://statusline/templates':
            content = await this.getStatusLineTemplatesResource();
            break;
            
          case 'rapala://statusline/components':
            content = await this.getStatusLineComponentsResource();
            break;
            
          case 'rapala://mcp/registry':
            content = await this.getMCPRegistryResource();
            break;
            
          case 'rapala://config':
            content = await this.getConfigResource();
            break;
            
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(content, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error reading resource: ${error.message}`
            }
          ]
        };
      }
    });
  }

  /**
   * Tool implementations
   */
  async listHooks(args) {
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
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(hooks, null, 2)
        }
      ]
    };
  }

  async enableHook(args) {
    const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      config.disabled = false;
      await fs.writeJson(configPath, config, { spaces: 2 });
      return {
        content: [
          {
            type: 'text',
            text: `Hook ${args.name} enabled successfully`
          }
        ]
      };
    }
    throw new Error(`Hook not found: ${args.name}`);
  }

  async disableHook(args) {
    const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      config.disabled = true;
      await fs.writeJson(configPath, config, { spaces: 2 });
      return {
        content: [
          {
            type: 'text',
            text: `Hook ${args.name} disabled successfully`
          }
        ]
      };
    }
    throw new Error(`Hook not found: ${args.name}`);
  }

  async listStatusLineTemplates() {
    // Import StatusLineManager dynamically
    const StatusLineManager = (await import('../statusline/StatusLineManager.js')).default;
    const manager = new StatusLineManager();
    
    const templates = manager.availableTemplates.map(t => ({
      name: t.name,
      displayName: t.displayName,
      description: t.description,
      preview: t.preview
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(templates, null, 2)
        }
      ]
    };
  }

  async applyStatusLineTemplate(args) {
    const StatusLineManager = (await import('../statusline/StatusLineManager.js')).default;
    const manager = new StatusLineManager();
    
    const template = manager.availableTemplates.find(t => t.name === args.template);
    if (!template) {
      throw new Error(`Template not found: ${args.template}`);
    }
    
    const config = {
      type: 'command',
      command: template.script,
      template: template.name,
      components: template.components
    };
    
    await manager.saveConfig(config, args.scope || 'user');
    
    return {
      content: [
        {
          type: 'text',
          text: `Applied template: ${args.template}`
        }
      ]
    };
  }

  async listMCPs(args) {
    const MCPManager = (await import('./MCPManager.js')).default;
    const manager = new MCPManager();
    await manager.initialize();
    const list = await manager.list();
    
    const filtered = args.category 
      ? list.filter(m => m.category === args.category)
      : list;
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(filtered, null, 2)
        }
      ]
    };
  }

  async startMCP(args) {
    const MCPManager = (await import('./MCPManager.js')).default;
    const manager = new MCPManager();
    await manager.initialize();
    await manager.start(args.name);
    
    return {
      content: [
        {
          type: 'text',
          text: `Started MCP: ${args.name}`
        }
      ]
    };
  }

  async stopMCP(args) {
    const MCPManager = (await import('./MCPManager.js')).default;
    const manager = new MCPManager();
    await manager.initialize();
    await manager.stop(args.name);
    
    return {
      content: [
        {
          type: 'text',
          text: `Stopped MCP: ${args.name}`
        }
      ]
    };
  }

  /**
   * Resource implementations
   */
  async getHooksResource() {
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

  async getStatusLineTemplatesResource() {
    const StatusLineManager = (await import('../statusline/StatusLineManager.js')).default;
    const manager = new StatusLineManager();
    return manager.availableTemplates;
  }

  async getStatusLineComponentsResource() {
    const StatusLineManager = (await import('../statusline/StatusLineManager.js')).default;
    const manager = new StatusLineManager();
    return manager.availableComponents;
  }

  async getMCPRegistryResource() {
    const MCPRegistry = (await import('./MCPRegistry.js')).default;
    const registry = new MCPRegistry();
    await registry.loadRegistry();
    return registry.getAllMCPs();
  }

  async getConfigResource() {
    const configPath = path.join(process.env.HOME, '.rapala', 'config.json');
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
    return {};
  }

  /**
   * Start the server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Rapala MCP Server V2 running on stdio');
  }
}

// Start the server
async function main() {
  try {
    const server = new RapalaMCPServerV2();
    await server.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);