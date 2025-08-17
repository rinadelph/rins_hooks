#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create and start the Rapala MCP server
 */
async function main() {
  // Create server instance
  const server = new Server(
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

  // Register tools
  server.setRequestHandler('tools/list', async () => ({
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
        name: 'rapala_test',
        description: 'Test Rapala MCP connection',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  }));

  // Handle tool calls
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      switch (name) {
        case 'rapala_hook_list': {
          const hooksDir = path.join(__dirname, '../../hooks');
          const hooks = [];
          
          if (await fs.pathExists(hooksDir)) {
            const dirs = await fs.readdir(hooksDir);
            for (const dir of dirs) {
              const configPath = path.join(hooksDir, dir, 'config.json');
              if (await fs.pathExists(configPath)) {
                try {
                  const config = await fs.readJson(configPath);
                  if (!args?.category || config.category === args.category) {
                    hooks.push({
                      name: config.name || dir,
                      description: config.description || 'No description',
                      enabled: !config.disabled,
                      events: config.events || []
                    });
                  }
                } catch (err) {
                  // Skip invalid configs
                }
              }
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `Found ${hooks.length} hooks:\n${JSON.stringify(hooks, null, 2)}`
              }
            ]
          };
        }
        
        case 'rapala_hook_enable': {
          const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
          if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            config.disabled = false;
            await fs.writeJson(configPath, config, { spaces: 2 });
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Hook ${args.name} enabled successfully`
                }
              ]
            };
          }
          throw new Error(`Hook not found: ${args.name}`);
        }
        
        case 'rapala_hook_disable': {
          const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
          if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            config.disabled = true;
            await fs.writeJson(configPath, config, { spaces: 2 });
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Hook ${args.name} disabled successfully`
                }
              ]
            };
          }
          throw new Error(`Hook not found: ${args.name}`);
        }
        
        case 'rapala_test': {
          return {
            content: [
              {
                type: 'text',
                text: `✅ Rapala MCP is working!\n\nServer: rapala-mcp v2.0.0\nStatus: Connected\nTime: ${new Date().toISOString()}`
              }
            ]
          };
        }
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });

  // Register resources
  server.setRequestHandler('resources/list', async () => ({
    resources: [
      {
        uri: 'rapala://hooks',
        name: 'Available Hooks',
        description: 'List of all available hooks and their configurations',
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

  // Handle resource reads
  server.setRequestHandler('resources/read', async (request) => {
    const { uri } = request.params;
    
    try {
      let content;
      
      switch (uri) {
        case 'rapala://hooks': {
          const hooksDir = path.join(__dirname, '../../hooks');
          const hooks = {};
          
          if (await fs.pathExists(hooksDir)) {
            const dirs = await fs.readdir(hooksDir);
            for (const dir of dirs) {
              const configPath = path.join(hooksDir, dir, 'config.json');
              if (await fs.pathExists(configPath)) {
                try {
                  hooks[dir] = await fs.readJson(configPath);
                } catch (err) {
                  // Skip invalid configs
                }
              }
            }
          }
          content = hooks;
          break;
        }
        
        case 'rapala://config': {
          const configPath = path.join(os.homedir(), '.rapala', 'config.json');
          if (await fs.pathExists(configPath)) {
            content = await fs.readJson(configPath);
          } else {
            content = { message: 'No configuration found' };
          }
          break;
        }
        
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

  // Create stdio transport
  const transport = new StdioServerTransport();
  
  // Connect server to transport
  await server.connect(transport);
  
  // Log to stderr (stdout is used for protocol)
  console.error('Rapala MCP Server started successfully');
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});