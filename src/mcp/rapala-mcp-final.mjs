#!/usr/bin/env node

import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // Create MCP server instance
  const server = new McpServer(
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

  // Register tools using the tool() method
  server.tool(
    'rapala_test',
    'Test Rapala MCP connection and verify it is working',
    {},
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Rapala MCP is working!\n\nServer: rapala-mcp v2.0.0\nStatus: Connected\nTime: ${new Date().toISOString()}`
          }
        ]
      };
    }
  );

  server.tool(
    'rapala_hook_list',
    'List all available Rapala hooks with their current status',
    {
      category: {
        type: 'string',
        description: 'Filter by category (optional)',
        optional: true
      }
    },
    async (args) => {
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
                  events: config.events || [],
                  tags: config.tags || []
                });
              }
            } catch (err) {
              console.error(`Failed to read config for ${dir}:`, err);
            }
          }
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${hooks.length} hooks:\n\n${hooks.map(h => 
              `📌 ${h.name}${h.enabled ? ' ✅' : ' ❌'}\n   ${h.description}\n   Events: ${h.events.join(', ') || 'none'}`
            ).join('\n\n')}`
          }
        ]
      };
    }
  );

  server.tool(
    'rapala_hook_enable',
    'Enable a specific Rapala hook',
    {
      name: {
        type: 'string',
        description: 'Name of the hook to enable',
        required: true
      }
    },
    async (args) => {
      const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        config.disabled = false;
        await fs.writeJson(configPath, config, { spaces: 2 });
        return {
          content: [
            {
              type: 'text',
              text: `✅ Hook "${args.name}" has been enabled successfully`
            }
          ]
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `❌ Hook not found: ${args.name}`
          }
        ],
        isError: true
      };
    }
  );

  server.tool(
    'rapala_hook_disable',
    'Disable a specific Rapala hook',
    {
      name: {
        type: 'string',
        description: 'Name of the hook to disable',
        required: true
      }
    },
    async (args) => {
      const configPath = path.join(__dirname, '../../hooks', args.name, 'config.json');
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        config.disabled = true;
        await fs.writeJson(configPath, config, { spaces: 2 });
        return {
          content: [
            {
              type: 'text',
              text: `✅ Hook "${args.name}" has been disabled successfully`
            }
          ]
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `❌ Hook not found: ${args.name}`
          }
        ],
        isError: true
      };
    }
  );

  server.tool(
    'rapala_status',
    'Get overall Rapala system status',
    {},
    async () => {
      const hooksDir = path.join(__dirname, '../../hooks');
      let totalHooks = 0;
      let enabledHooks = 0;
      let disabledHooks = 0;
      
      if (await fs.pathExists(hooksDir)) {
        const dirs = await fs.readdir(hooksDir);
        for (const dir of dirs) {
          const configPath = path.join(hooksDir, dir, 'config.json');
          if (await fs.pathExists(configPath)) {
            try {
              const config = await fs.readJson(configPath);
              totalHooks++;
              if (config.disabled) {
                disabledHooks++;
              } else {
                enabledHooks++;
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
            text: `📊 Rapala System Status\n\n` +
                  `Total Hooks: ${totalHooks}\n` +
                  `✅ Enabled: ${enabledHooks}\n` +
                  `❌ Disabled: ${disabledHooks}\n` +
                  `\nServer: rapala-mcp v2.0.0\n` +
                  `Status: Operational\n` +
                  `Time: ${new Date().toISOString()}`
          }
        ]
      };
    }
  );

  // Register resources
  server.resource(
    'rapala://hooks',
    'List of all available hooks and their configurations',
    'application/json',
    async () => {
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
      
      return {
        text: JSON.stringify(hooks, null, 2)
      };
    }
  );

  server.resource(
    'rapala://config',
    'Main Rapala configuration',
    'application/json',
    async () => {
      const configPath = path.join(os.homedir(), '.rapala', 'config.json');
      let config = {};
      
      if (await fs.pathExists(configPath)) {
        config = await fs.readJson(configPath);
      }
      
      return {
        text: JSON.stringify(config, null, 2)
      };
    }
  );

  // Create and connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (stdout is used for protocol communication)
  console.error('🚀 Rapala MCP Server v2.0.0 started successfully');
  console.error('📡 Connected via stdio transport');
  console.error('🛠️  Available tools: rapala_test, rapala_hook_list, rapala_hook_enable, rapala_hook_disable, rapala_status');
}

// Handle errors gracefully
main().catch((error) => {
  console.error('❌ Fatal error starting Rapala MCP Server:', error);
  process.exit(1);
});