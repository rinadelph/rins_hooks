#!/usr/bin/env node

/**
 * Rapala Router Hook
 * Acts as dynamic dispatcher for all generated hooks
 * This is the ONLY hook that needs to be in Claude Code settings.json
 */

const HookBase = require('../../src/hook-base');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

class RapalaRouter extends HookBase {
  constructor() {
    super('rapala-router', {
      description: 'Dynamic router for all Rapala-generated hooks',
      matcher: '', // Matches all tools
      timeout: 60
    });
  }

  async execute(input) {
    try {
      const eventType = input.hook_event_name;
      const toolName = input.tool_name;
      
      // Discover all generated hooks
      const generatedHooks = await this.discoverGeneratedHooks();
      
      // Filter hooks that match this event and tool
      const matchingHooks = generatedHooks.filter(hook => {
        return this.hookMatches(hook, eventType, toolName);
      });
      
      // Execute matching hooks and merge results
      let mergedResult = {};
      for (const hook of matchingHooks) {
        try {
          const result = await this.executeGeneratedHook(hook, input);
          if (result && result.hookSpecificOutput) {
            // Merge hookSpecificOutput from each hook
            if (!mergedResult.hookSpecificOutput) {
              mergedResult.hookSpecificOutput = {};
            }
            Object.assign(mergedResult.hookSpecificOutput, result.hookSpecificOutput);
          }
        } catch (error) {
          console.error(`❌ Hook ${hook.name} failed:`, error.message);
        }
      }
      return this.success(mergedResult);
    } catch (error) {
      console.error(`❌ Rapala Router failed: ${error.message}`);
      console.error(`❌ Error stack:`, error.stack);
      return this.error(`Rapala Router failed: ${error.message}`);
    }
  }

  /**
   * Discover all generated hooks in the hooks directory
   */
  async discoverGeneratedHooks() {
    const hooksDir = path.join(__dirname, '..');
    const hooks = [];
    
    try {
      const entries = await fs.readdir(hooksDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = path.join(hooksDir, entry.name, 'config.json');
          const hookPath = path.join(hooksDir, entry.name, 'index.js');
          
          if (await fs.pathExists(configPath) && await fs.pathExists(hookPath)) {
            const config = await fs.readJson(configPath);
            
            // Only include Rapala-managed hooks that are not disabled and have an index.js file
            if ((config.installationType === 'generated' || config.installationType === 'synced') && !config.disabled && await fs.pathExists(hookPath)) {
              hooks.push({
                name: config.name,
                config: config,
                hookPath: hookPath,
                events: config.events || [],
                matcher: config.matcher
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error discovering hooks:', error.message);
    }
    
    return hooks;
  }

  /**
   * Check if a hook matches the current event and tool
   */
  hookMatches(hook, eventType, toolName) {
    // Check if hook handles this event type
    if (!hook.events.includes(eventType)) {
      return false;
    }
    
    // Check tool matcher if specified
    if (hook.matcher) {
      const matchers = hook.matcher.split('|');
      return matchers.includes(toolName);
    }
    
    // No matcher means matches all tools
    return true;
  }

  /**
   * Execute a generated hook
   */
  async executeGeneratedHook(hook, input) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [hook.hookPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, HOOK_INPUT: JSON.stringify(input) }
      });
      
      let output = '';
      let errorOutput = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          try {
            // Try to parse output as JSON
            resolve(JSON.parse(output));
          } catch (e) {
            // If not JSON, return as plain text
            resolve(output.trim());
          }
        } else {
          reject(new Error(`Hook exited with code ${code}: ${errorOutput}`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
      
      // Send input to hook
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    });
  }
}

// Main execution logic
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const router = new RapalaRouter();
      const result = await router.execute(input);
      HookBase.outputResult(result);
    } catch (e) {
      HookBase.outputResult({
        success: false,
        error: `RapalaRouter execution failed: ${e.message}`,
        hook: 'rapala-router'
      });
    }
  })();
}

module.exports = RapalaRouter;