#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * No Co-Author Hook for Claude Code
 * 
 * Features:
 * - Automatically disables includeCoAuthoredBy setting
 * - Runs on SessionStart to ensure setting is always disabled
 * - Modifies user-level settings for global effect
 * - Silent operation - doesn't interfere with normal usage
 */

class NoCoAuthorHook {
  constructor() {
    this.name = 'no-coauthor';
    this.version = '1.0.0';
  }

  /**
   * Execute the no co-author hook
   * @param {Object} input - Hook input from Claude Code
   */
  async execute(input) {
    try {
      // If running on SessionStart, do the main work
      if (input && input.hook_event_name === 'SessionStart') {
        await this.disableCoAuthoredBy();
        return this.success();
      }

      // If running on other events, check if we need to migrate to SessionStart
      if (input && input.hook_event_name !== 'SessionStart') {
        await this.migrateToSessionStart();
        await this.disableCoAuthoredBy(); // Also do the work now
        return this.success();
      }

      return this.success();

    } catch (error) {
      // Fail silently - don't interrupt normal operation
      console.warn(`No co-author hook warning: ${error.message}`);
      return this.success();
    }
  }

  /**
   * Migrate this hook from PostToolUse to SessionStart
   */
  async migrateToSessionStart() {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      return; // No settings to migrate
    }

    try {
      const settingsContent = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      if (!settings.hooks) return;

      let migrated = false;
      const hookCommand = `node "${path.join(__dirname, 'index.js')}"`;

      // Remove from PostToolUse if present
      if (settings.hooks.PostToolUse) {
        settings.hooks.PostToolUse = settings.hooks.PostToolUse.map(matcher => {
          if (matcher.hooks) {
            const filteredHooks = matcher.hooks.filter(hook => 
              !hook.command || !hook.command.includes('no-coauthor/index.js')
            );
            if (filteredHooks.length !== matcher.hooks.length) {
              migrated = true;
            }
            return { ...matcher, hooks: filteredHooks };
          }
          return matcher;
        }).filter(matcher => matcher.hooks && matcher.hooks.length > 0);
      }

      // Add to SessionStart if not already present
      if (!settings.hooks.SessionStart) {
        settings.hooks.SessionStart = [];
      }

      const sessionStartHooks = settings.hooks.SessionStart;
      const alreadyInSessionStart = sessionStartHooks.some(matcher => 
        matcher.hooks && matcher.hooks.some(hook => 
          hook.command && hook.command.includes('no-coauthor/index.js')
        )
      );

      if (!alreadyInSessionStart) {
        // Add to SessionStart
        const existingMatcher = sessionStartHooks.find(m => m.matcher === '');
        if (existingMatcher) {
          existingMatcher.hooks.push({
            type: 'command',
            command: hookCommand,
            timeout: 10
          });
        } else {
          sessionStartHooks.push({
            matcher: '',
            hooks: [{
              type: 'command',
              command: hookCommand,
              timeout: 10
            }]
          });
        }
        migrated = true;
      }

      if (migrated) {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.error('✓ Migrated no-coauthor hook to SessionStart');
      }

    } catch (error) {
      console.warn(`Could not migrate hook: ${error.message}`);
    }
  }

  /**
   * Disable the includeCoAuthoredBy setting
   */
  async disableCoAuthoredBy() {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    
    // Ensure .claude directory exists
    const claudeDir = path.dirname(settingsPath);
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Load existing settings or create new
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');
        settings = JSON.parse(settingsContent);
      } catch (error) {
        console.warn(`Could not parse existing settings: ${error.message}`);
        settings = {};
      }
    }

    // Set includeCoAuthoredBy to false if not already set
    if (settings.includeCoAuthoredBy !== false) {
      settings.includeCoAuthoredBy = false;
      
      // Write back to settings
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.error('✓ Disabled co-authored-by credits in Claude Code settings');
      } catch (error) {
        console.warn(`Could not update settings: ${error.message}`);
      }
    }
  }

  /**
   * Return success result
   */
  success() {
    return { continue: true };
  }
}

// When run directly, parse input and execute
if (require.main === module) {
  const hook = new NoCoAuthorHook();
  
  // Read input from stdin
  let inputData = '';
  process.stdin.on('data', chunk => {
    inputData += chunk;
  });
  
  process.stdin.on('end', async () => {
    try {
      const input = inputData ? JSON.parse(inputData) : {};
      await hook.execute(input);
    } catch (error) {
      console.error(`No co-author hook error: ${error.message}`);
      process.exit(1);
    }
  });
}

module.exports = NoCoAuthorHook;