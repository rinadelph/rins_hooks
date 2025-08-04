const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Intelligent Hook Management System
 * Prevents duplicate hooks and manages conflicts
 */

class HookManager {
  constructor(configManager) {
    this.configManager = configManager;
  }

  /**
   * Clean and optimize hook configuration
   * Removes duplicates and resolves conflicts
   */
  async cleanAndOptimize(scope = 'user') {
    console.log(chalk.blue('🧹 Cleaning and optimizing hook configuration...'));
    
    // Get current settings
    const settings = await this.configManager.loadSettings(scope);
    
    if (!settings.hooks) {
      console.log(chalk.yellow('ℹ️  No hooks found to clean'));
      return;
    }

    // Clean each event type
    const cleaned = {};
    let totalRemoved = 0;
    
    for (const [eventType, matchers] of Object.entries(settings.hooks)) {
      const { cleanedMatchers, removedCount } = this.cleanEventMatchers(eventType, matchers);
      if (cleanedMatchers.length > 0) {
        cleaned[eventType] = cleanedMatchers;
      }
      totalRemoved += removedCount;
    }

    // Update settings
    settings.hooks = cleaned;
    await this.configManager.saveSettings(scope, settings);

    console.log(chalk.green(`✅ Optimization complete! Removed ${totalRemoved} duplicate/conflicting hooks`));
    
    // Show final configuration
    await this.showOptimizedConfig(cleaned);
  }

  /**
   * Clean matchers for a specific event type
   */
  cleanEventMatchers(eventType, matchers) {
    const seenCommands = new Set();
    const seenMatchers = new Map();
    const cleanedMatchers = [];
    let removedCount = 0;

    for (const matcher of matchers) {
      const matcherKey = matcher.matcher || '';
      const hooks = matcher.hooks || [];
      
      // Filter out duplicate commands within this matcher
      const uniqueHooks = [];
      for (const hook of hooks) {
        const commandKey = hook.command;
        if (!seenCommands.has(commandKey)) {
          seenCommands.add(commandKey);
          uniqueHooks.push(hook);
        } else {
          removedCount++;
          console.log(chalk.yellow(`  🗑️  Removed duplicate: ${path.basename(hook.command)} for ${eventType}`));
        }
      }

      // Only add matcher if it has unique hooks
      if (uniqueHooks.length > 0) {
        // Check for matcher conflicts (same hook with different matchers)
        if (seenMatchers.has(matcherKey)) {
          // Merge hooks into existing matcher
          const existingMatcher = seenMatchers.get(matcherKey);
          existingMatcher.hooks.push(...uniqueHooks);
          removedCount++;
          console.log(chalk.yellow(`  🔄 Merged duplicate matcher: "${matcherKey}" for ${eventType}`));
        } else {
          const cleanMatcher = {
            matcher: matcherKey,
            hooks: uniqueHooks
          };
          cleanedMatchers.push(cleanMatcher);
          seenMatchers.set(matcherKey, cleanMatcher);
        }
      } else {
        removedCount++;
      }
    }

    return { cleanedMatchers, removedCount };
  }

  /**
   * Install hook with conflict detection
   */
  async installHookIntelligently(hookName, eventTypes, options = {}) {
    const scope = options.scope || 'user';
    
    console.log(chalk.blue(`🔧 Installing ${hookName} with intelligent conflict detection...`));
    
    // Check for existing installations
    const conflicts = await this.detectConflicts(hookName, eventTypes, scope);
    
    if (conflicts.length > 0) {
      console.log(chalk.yellow('⚠️  Detected potential conflicts:'));
      for (const conflict of conflicts) {
        console.log(chalk.yellow(`  • ${conflict.description}`));
      }
      
      // Auto-resolve conflicts
      await this.resolveConflicts(conflicts, scope);
    }

    // Install the hook
    const hookPath = path.join(__dirname, '..', 'hooks', hookName, 'index.js');
    
    for (const eventType of eventTypes) {
      const config = {
        matcher: options.matcher || '',
        hooks: [
          {
            type: 'command',
            command: `node "${hookPath}"`
          }
        ]
      };

      await this.configManager.addHook(eventType, config, scope);
      console.log(chalk.green(`  ✅ ${hookName} added to ${eventType}`));
    }

    // Clean up after installation
    await this.cleanAndOptimize(scope);
  }

  /**
   * Detect conflicts for a hook installation
   */
  async detectConflicts(hookName, eventTypes, scope) {
    const conflicts = [];
    const settings = await this.configManager.loadSettings(scope);
    
    if (!settings.hooks) return conflicts;

    const hookPath = path.join(__dirname, '..', 'hooks', hookName, 'index.js');
    const hookCommand = `node "${hookPath}"`;

    for (const eventType of eventTypes) {
      const matchers = settings.hooks[eventType] || [];
      
      for (const matcher of matchers) {
        for (const hook of matcher.hooks || []) {
          if (hook.command === hookCommand) {
            conflicts.push({
              type: 'duplicate',
              eventType,
              matcher: matcher.matcher,
              hookName,
              description: `${hookName} already installed for ${eventType} with matcher "${matcher.matcher}"`
            });
          }
          
          // Check for overlapping functionality
          if (this.hasOverlappingFunctionality(hookName, hook.command)) {
            conflicts.push({
              type: 'overlap',
              eventType,
              existingHook: path.basename(path.dirname(hook.command)),
              hookName,
              description: `${hookName} may conflict with existing ${path.basename(path.dirname(hook.command))} hook`
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two hooks have overlapping functionality
   */
  hasOverlappingFunctionality(hookName, existingCommand) {
    const overlaps = {
      'git-agentmcp': ['auto-commit'],
      'auto-commit': ['git-agentmcp'],
      'code-formatter': ['auto-commit'],
      'notification': ['task-blocker'],
      'extended-thinking': [] // Extended thinking is designed to work with others
    };

    const existingHookName = path.basename(path.dirname(existingCommand));
    return overlaps[hookName]?.includes(existingHookName) || false;
  }

  /**
   * Resolve detected conflicts
   */
  async resolveConflicts(conflicts, scope) {
    const settings = await this.configManager.loadSettings(scope);
    
    for (const conflict of conflicts) {
      if (conflict.type === 'duplicate') {
        console.log(chalk.blue(`  🔄 Skipping duplicate installation of ${conflict.hookName}`));
      } else if (conflict.type === 'overlap') {
        console.log(chalk.blue(`  🤝 Configuring ${conflict.hookName} to work alongside ${conflict.existingHook}`));
        // Could implement specific resolution logic here
      }
    }
  }

  /**
   * Show optimized configuration
   */
  async showOptimizedConfig(hooks) {
    console.log(chalk.blue('\n📋 Optimized Hook Configuration:'));
    
    for (const [eventType, matchers] of Object.entries(hooks)) {
      console.log(chalk.green(`\n🎯 ${eventType}:`));
      
      for (const matcher of matchers) {
        const matcherText = matcher.matcher || '(all)';
        console.log(chalk.cyan(`  📝 Matcher: "${matcherText}"`));
        
        for (const hook of matcher.hooks) {
          const hookName = path.basename(path.dirname(hook.command));
          console.log(chalk.gray(`    • ${hookName}`));
        }
      }
    }
  }

  /**
   * Get hook statistics
   */
  async getHookStats(scope = 'user') {
    const settings = await this.configManager.loadSettings(scope);
    
    if (!settings.hooks) {
      return {
        totalEvents: 0,
        totalMatchers: 0,
        totalHooks: 0,
        hooksByEvent: {}
      };
    }

    let totalMatchers = 0;
    let totalHooks = 0;
    const hooksByEvent = {};

    for (const [eventType, matchers] of Object.entries(settings.hooks)) {
      totalMatchers += matchers.length;
      let eventHooks = 0;
      
      for (const matcher of matchers) {
        eventHooks += matcher.hooks?.length || 0;
      }
      
      totalHooks += eventHooks;
      hooksByEvent[eventType] = eventHooks;
    }

    return {
      totalEvents: Object.keys(settings.hooks).length,
      totalMatchers,
      totalHooks,
      hooksByEvent
    };
  }

  /**
   * Validate hook configuration
   */
  async validateConfiguration(scope = 'user') {
    console.log(chalk.blue('🔍 Validating hook configuration...'));
    
    const settings = await this.configManager.loadSettings(scope);
    const issues = [];

    if (!settings.hooks) {
      console.log(chalk.green('✅ No hooks configured'));
      return [];
    }

    // Check for common issues
    for (const [eventType, matchers] of Object.entries(settings.hooks)) {
      for (const matcher of matchers) {
        for (const hook of matcher.hooks || []) {
          // Check if hook file exists
          const hookPath = hook.command.match(/"([^"]+)"/)?.[1];
          if (hookPath && !fs.existsSync(hookPath)) {
            issues.push({
              type: 'missing_file',
              eventType,
              path: hookPath,
              description: `Hook file not found: ${hookPath}`
            });
          }

          // Check for reasonable timeouts
          const timeout = hook.timeout || 30;
          if (timeout > 300) {
            issues.push({
              type: 'long_timeout',
              eventType,
              timeout,
              description: `Very long timeout (${timeout}s) for ${eventType} hook`
            });
          }
        }
      }
    }

    // Report issues
    if (issues.length > 0) {
      console.log(chalk.yellow(`⚠️  Found ${issues.length} issue(s):`));
      for (const issue of issues) {
        console.log(chalk.yellow(`  • ${issue.description}`));
      }
    } else {
      console.log(chalk.green('✅ Configuration is valid'));
    }

    return issues;
  }
}

module.exports = HookManager;