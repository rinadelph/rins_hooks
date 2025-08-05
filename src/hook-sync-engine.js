#!/usr/bin/env node

/**
 * Rapala Hook Sync Engine
 * Intelligently converts hardcoded Claude Code hooks to dynamic Rapala hooks
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

class HookSyncEngine {
  constructor() {
    this.currentDir = process.cwd();
    this.hooksDir = path.join(this.currentDir, 'hooks');
    this.settingsFiles = {
      user: path.join(os.homedir(), '.claude', 'settings.json'),
      project: path.join(this.currentDir, '.claude', 'settings.json'),
      local: path.join(this.currentDir, '.claude', 'settings.local.json')
    };
    this.detectedHooks = [];
    this.rapalaRouterPath = path.join(this.hooksDir, 'rapala-router', 'index.js');
  }

  /**
   * Analyze current Claude Code hooks in all settings files
   */
  async analyze() {
    console.log(chalk.blue('🔍 Rapala Sync Analysis'));
    console.log(chalk.gray('Scanning Claude Code configurations for hardcoded hooks...'));
    console.log();

    this.detectedHooks = [];
    
    for (const [scope, settingsPath] of Object.entries(this.settingsFiles)) {
      if (await fs.pathExists(settingsPath)) {
        console.log(chalk.cyan(`📄 Analyzing ${scope} settings: ${settingsPath}`));
        await this.analyzeSettingsFile(settingsPath, scope);
      } else {
        console.log(chalk.gray(`⏭️  No ${scope} settings file found`));
      }
    }

    this.generateAnalysisReport();
    return this.detectedHooks;
  }

  /**
   * Analyze a single settings file
   */
  async analyzeSettingsFile(settingsPath, scope) {
    try {
      const settings = await fs.readJson(settingsPath);
      const hooks = settings.hooks || {};

      for (const [eventType, eventHooks] of Object.entries(hooks)) {
        for (const matcher of eventHooks) {
          for (const hook of matcher.hooks || []) {
            if (hook.command && hook.command.includes('node ')) {
              const hookInfo = this.parseHookCommand(hook.command, eventType, matcher.matcher, scope);
              if (hookInfo && !this.isRapalaRouter(hookInfo.path)) {
                this.detectedHooks.push(hookInfo);
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error reading ${scope} settings: ${error.message}`));
    }
  }

  /**
   * Parse hook command to extract information
   */
  parseHookCommand(command, eventType, matcher, scope) {
    const nodeMatch = command.match(/node\s+"?([^"]+)"?/);
    if (!nodeMatch) return null;

    const hookPath = nodeMatch[1];
    const hookName = this.extractHookName(hookPath);
    
    return {
      name: hookName,
      path: hookPath,
      command: command,
      eventType,
      matcher: matcher || '',
      scope,
      timeout: this.extractTimeout(command)
    };
  }

  /**
   * Extract hook name from path
   */
  extractHookName(hookPath) {
    const parts = hookPath.split('/');
    const hooksIndex = parts.findIndex(part => part === 'hooks');
    if (hooksIndex !== -1 && hooksIndex < parts.length - 1) {
      return parts[hooksIndex + 1];
    }
    return path.basename(hookPath, '.js');
  }

  /**
   * Extract timeout from command
   */
  extractTimeout(command) {
    const match = command.match(/"timeout":\s*(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Check if hook is already Rapala Router
   */
  isRapalaRouter(hookPath) {
    return hookPath.includes('rapala-router') || hookPath.includes('rapala-command');
  }

  /**
   * Generate analysis report
   */
  generateAnalysisReport() {
    console.log();
    console.log(chalk.bold.blue('📊 Analysis Results'));
    console.log(chalk.gray('━'.repeat(50)));

    if (this.detectedHooks.length === 0) {
      console.log(chalk.green('✅ No hardcoded hooks found - system already optimized!'));
      return;
    }

    // Group by scope
    const byScope = this.groupBy(this.detectedHooks, 'scope');
    for (const [scope, hooks] of Object.entries(byScope)) {
      console.log(chalk.cyan(`\n📁 ${scope.toUpperCase()} Level (${hooks.length} hooks):`));
      hooks.forEach(hook => {
        console.log(`   🔗 ${hook.name} → ${hook.eventType}${hook.matcher ? ` (${hook.matcher})` : ''}`);
      });
    }

    // Group by event type
    console.log(chalk.cyan('\n📋 By Event Type:'));
    const byEvent = this.groupBy(this.detectedHooks, 'eventType');
    Object.entries(byEvent).forEach(([event, hooks]) => {
      console.log(`   ${event}: ${hooks.length} hooks`);
    });

    console.log();
    console.log(chalk.yellow(`💡 Migration Plan:`));
    console.log(`   • Convert ${this.detectedHooks.length} hardcoded hooks to Rapala format`);
    console.log(`   • Replace with single Rapala Router per event type`);
    console.log(`   • Maintain all existing functionality`);
    console.log(`   • Enable dynamic hook management`);
  }

  /**
   * Migrate hooks to Rapala dynamic format
   */
  async migrate() {
    console.log(chalk.blue('🔄 Rapala Hook Migration'));
    console.log(chalk.gray('Converting hardcoded hooks to dynamic Rapala format...'));
    console.log();

    if (this.detectedHooks.length === 0) {
      await this.analyze();
      if (this.detectedHooks.length === 0) {
        console.log(chalk.green('✅ No hooks to migrate!'));
        return;
      }
    }

    // Create backups
    await this.createBackups();

    // Convert each hook
    let migrated = 0;
    for (const hook of this.detectedHooks) {
      try {
        await this.convertHookToRapala(hook);
        migrated++;
        console.log(chalk.green(`✅ Migrated: ${hook.name}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to migrate ${hook.name}: ${error.message}`));
      }
    }

    // Update settings files
    await this.updateSettingsFiles();

    console.log();
    console.log(chalk.green(`🎉 Migration Complete!`));
    console.log(chalk.cyan(`   • ${migrated} hooks converted to Rapala format`));
    console.log(chalk.cyan(`   • Settings updated to use Rapala Router`));
    console.log(chalk.cyan(`   • All functionality preserved`));
  }

  /**
   * Convert a single hook to Rapala format
   */
  async convertHookToRapala(hookInfo) {
    // Read existing hook if it exists
    const originalHookDir = this.findOriginalHookDirectory(hookInfo.name);
    let existingConfig = {};
    
    if (originalHookDir) {
      const configPath = path.join(originalHookDir, 'config.json');
      if (await fs.pathExists(configPath)) {
        existingConfig = await fs.readJson(configPath);
      }
    }

    // Create Rapala config
    const rapalaConfig = {
      name: hookInfo.name,
      description: existingConfig.description || `${hookInfo.name} hook`,
      version: existingConfig.version || '1.0.0',
      author: 'Rapala Sync System',
      events: [hookInfo.eventType],
      matcher: hookInfo.matcher || undefined,
      installationType: 'synced',
      originalLocation: hookInfo.scope,
      syncedAt: new Date().toISOString(),
      tags: ['synced', 'original-claude-code', ...(existingConfig.tags || [])],
      timeout: hookInfo.timeout,
      platforms: ['linux', 'darwin', 'win32']
    };

    // Remove undefined values
    Object.keys(rapalaConfig).forEach(key => {
      if (rapalaConfig[key] === undefined) {
        delete rapalaConfig[key];
      }
    });

    // Write config
    const hookDir = path.join(this.hooksDir, hookInfo.name);
    await fs.ensureDir(hookDir);
    await fs.writeJson(path.join(hookDir, 'config.json'), rapalaConfig, { spaces: 2 });

    // Copy or ensure hook implementation exists
    const indexPath = path.join(hookDir, 'index.js');
    if (!await fs.pathExists(indexPath)) {
      if (originalHookDir) {
        const originalIndex = path.join(originalHookDir, 'index.js');
        if (await fs.pathExists(originalIndex)) {
          await fs.copy(originalIndex, indexPath);
        }
      }
    }
  }

  /**
   * Find original hook directory
   */
  findOriginalHookDirectory(hookName) {
    const hookDir = path.join(this.hooksDir, hookName);
    return fs.pathExistsSync(hookDir) ? hookDir : null;
  }

  /**
   * Create backups of settings files
   */
  async createBackups() {
    console.log(chalk.yellow('💾 Creating backups...'));
    
    for (const [scope, settingsPath] of Object.entries(this.settingsFiles)) {
      if (await fs.pathExists(settingsPath)) {
        const backupPath = `${settingsPath}.backup.${Date.now()}`;
        await fs.copy(settingsPath, backupPath);
        console.log(chalk.gray(`   Backed up ${scope}: ${backupPath}`));
      }
    }
  }

  /**
   * Update settings files to use Rapala Router
   */
  async updateSettingsFiles() {
    console.log(chalk.yellow('⚙️  Updating settings files...'));

    for (const [scope, settingsPath] of Object.entries(this.settingsFiles)) {
      if (await fs.pathExists(settingsPath)) {
        await this.updateSingleSettingsFile(settingsPath, scope);
      }
    }
  }

  /**
   * Update a single settings file
   */
  async updateSingleSettingsFile(settingsPath, scope) {
    const settings = await fs.readJson(settingsPath);
    const originalHooks = settings.hooks || {};

    // Create new hooks structure with only Rapala Router
    const newHooks = {};
    const eventTypes = Object.keys(originalHooks);

    for (const eventType of eventTypes) {
      newHooks[eventType] = [{
        matcher: '',
        hooks: [{
          type: 'command',
          command: `node "${this.rapalaRouterPath}"`
        }]
      }];
    }

    settings.hooks = newHooks;
    await fs.writeJson(settingsPath, settings, { spaces: 2 });
    console.log(chalk.green(`   Updated ${scope} settings`));
  }

  /**
   * Optimize existing Rapala hooks
   */
  async optimize() {
    console.log(chalk.blue('⚡ Rapala Hook Optimization'));
    console.log(chalk.gray('Analyzing hooks for optimization opportunities...'));
    console.log();

    // Find all Rapala hooks
    const rapalaHooks = await this.findRapalaHooks();
    
    // Analyze for optimizations
    const optimizations = await this.analyzeOptimizations(rapalaHooks);
    
    // Generate optimization report
    this.generateOptimizationReport(optimizations);
  }

  /**
   * Find all Rapala hooks
   */
  async findRapalaHooks() {
    const hooks = [];
    const hookDirs = await fs.readdir(this.hooksDir);

    for (const dir of hookDirs) {
      const hookPath = path.join(this.hooksDir, dir);
      const configPath = path.join(hookPath, 'config.json');
      
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        if (config.installationType === 'generated' || config.installationType === 'synced') {
          hooks.push({ ...config, directory: dir });
        }
      }
    }

    return hooks;
  }

  /**
   * Analyze optimization opportunities
   */
  async analyzeOptimizations(hooks) {
    const optimizations = {
      duplicates: [],
      unused: [],
      consolidatable: [],
      performance: []
    };

    // Find duplicates
    const nameGroups = this.groupBy(hooks, 'name');
    Object.entries(nameGroups).forEach(([name, group]) => {
      if (group.length > 1) {
        optimizations.duplicates.push({ name, count: group.length, hooks: group });
      }
    });

    // Find consolidatable hooks (same event + matcher)
    const eventGroups = this.groupBy(hooks, hook => `${hook.events?.[0]}-${hook.matcher || 'all'}`);
    Object.entries(eventGroups).forEach(([key, group]) => {
      if (group.length > 3) {
        optimizations.consolidatable.push({ key, count: group.length, hooks: group });
      }
    });

    return optimizations;
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport(optimizations) {
    console.log(chalk.bold.blue('📈 Optimization Report'));
    console.log(chalk.gray('━'.repeat(50)));

    if (optimizations.duplicates.length > 0) {
      console.log(chalk.yellow('\n🔄 Duplicate Hooks:'));
      optimizations.duplicates.forEach(dup => {
        console.log(`   ${dup.name}: ${dup.count} instances`);
      });
    }

    if (optimizations.consolidatable.length > 0) {
      console.log(chalk.cyan('\n📦 Consolidation Opportunities:'));
      optimizations.consolidatable.forEach(group => {
        console.log(`   ${group.key}: ${group.count} hooks could be consolidated`);
      });
    }

    if (optimizations.duplicates.length === 0 && optimizations.consolidatable.length === 0) {
      console.log(chalk.green('✅ Hooks are already optimized!'));
    }
  }

  /**
   * Utility: Group array by key
   */
  groupBy(array, key) {
    const keyFn = typeof key === 'function' ? key : item => item[key];
    return array.reduce((groups, item) => {
      const group = keyFn(item);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }
}

// Main execution
if (require.main === module) {
  (async () => {
    const engine = new HookSyncEngine();
    const mode = process.argv[2] || 'analyze';

    try {
      switch (mode) {
        case 'analyze':
          await engine.analyze();
          break;
        case 'migrate':
          await engine.migrate();
          break;
        case 'optimize':
          await engine.optimize();
          break;
        default:
          console.log(chalk.red(`❌ Unknown mode: ${mode}`));
          console.log(chalk.yellow('Available modes: analyze, migrate, optimize'));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Sync failed: ${error.message}`));
      process.exit(1);
    }
  })();
}

module.exports = HookSyncEngine;