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
      // Only run on SessionStart to avoid repeated execution
      if (!input || input.hook_event_name !== 'SessionStart') {
        return this.success();
      }

      await this.disableCoAuthoredBy();
      return this.success();

    } catch (error) {
      // Fail silently - don't interrupt normal operation
      console.warn(`No co-author hook warning: ${error.message}`);
      return this.success();
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
        console.log('✓ Disabled co-authored-by credits in Claude Code settings');
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