#!/usr/bin/env node

/**
 * Cleanup Duplicate Hooks Utility
 * 
 * This script removes duplicate hooks from Claude Code settings files
 * while preserving unique hooks and maintaining the settings structure.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class DuplicateCleanup {
  constructor() {
    this.settingsPath = path.join(process.env.HOME, '.claude', 'settings.json');
  }

  async cleanupDuplicates() {
    try {
      console.log(chalk.blue('🧹 Cleaning up duplicate hooks...'));
      console.log();

      if (!fs.existsSync(this.settingsPath)) {
        console.log(chalk.yellow('⚠️  Settings file not found.'));
        return;
      }

      // Read current settings
      const settingsData = fs.readFileSync(this.settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);

      if (!settings.hooks) {
        console.log(chalk.green('✅ No hooks section found - nothing to clean.'));
        return;
      }

      const cleanedSettings = { ...settings };
      let duplicatesRemoved = 0;

      // Process each hook event
      for (const [eventName, eventHooks] of Object.entries(settings.hooks)) {
        if (!Array.isArray(eventHooks)) continue;

        for (let i = 0; i < eventHooks.length; i++) {
          const hookGroup = eventHooks[i];
          if (!hookGroup.hooks || !Array.isArray(hookGroup.hooks)) continue;

          // Track seen hook commands to identify duplicates
          const seenCommands = new Set();
          const uniqueHooks = [];

          for (const hook of hookGroup.hooks) {
            if (!hook.command) continue;

            // Extract hook name from command path
            const hookName = this.extractHookName(hook.command);
            
            if (!seenCommands.has(hookName)) {
              seenCommands.add(hookName);
              uniqueHooks.push(hook);
            } else {
              console.log(chalk.yellow(`   Removing duplicate: ${hookName} from ${eventName}`));
              duplicatesRemoved++;
            }
          }

          // Update the hooks array with unique hooks only
          cleanedSettings.hooks[eventName][i].hooks = uniqueHooks;
        }
      }

      if (duplicatesRemoved > 0) {
        // Backup original settings
        const backupPath = `${this.settingsPath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, settingsData);
        console.log(chalk.blue(`📦 Backup created: ${backupPath}`));

        // Write cleaned settings
        fs.writeFileSync(this.settingsPath, JSON.stringify(cleanedSettings, null, 2));
        
        console.log();
        console.log(chalk.green(`✅ Removed ${duplicatesRemoved} duplicate hooks`));
        console.log(chalk.cyan('🔄 Restart Claude Code for changes to take effect'));
      } else {
        console.log(chalk.green('✅ No duplicates found - settings are clean!'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Extract hook name from command path
   * @param {string} command - Hook command path
   * @returns {string} Hook name
   */
  extractHookName(command) {
    // Extract from paths like: node "/path/to/hooks/hook-name/index.js"
    const match = command.match(/hooks\/([^\/]+)\/index\.js/);
    return match ? match[1] : command;
  }
}

// Run cleanup if called directly
if (require.main === module) {
  const cleanup = new DuplicateCleanup();
  cleanup.cleanupDuplicates().catch(error => {
    console.error(chalk.red('❌ Fatal error:'), error.message);
    process.exit(1);
  });
}

module.exports = DuplicateCleanup;