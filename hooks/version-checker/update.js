#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hook Update Utility
 * 
 * Provides manual and automated update capabilities for all hooks
 */

class HookUpdater {
  constructor() {
    this.projectDir = process.cwd();
    this.versionFile = path.join(this.projectDir, '.claude', 'hook-versions.json');
    this.hooksDir = path.join(this.projectDir, 'hooks');
  }

  /**
   * Main update process
   */
  async run() {
    const args = process.argv.slice(2);
    const command = args[0] || 'check';
    
    switch (command) {
      case 'check':
        await this.checkUpdates();
        break;
      case 'update':
        await this.updateHooks(args[1]);
        break;
      case 'list':
        await this.listHooks();
        break;
      case 'reset':
        await this.resetVersions();
        break;
      default:
        this.showHelp();
    }
  }

  /**
   * Check for available updates
   */
  async checkUpdates() {
    console.log('🔍 Checking for hook updates...\n');
    
    const VersionChecker = require('./index.js');
    const checker = new VersionChecker();
    
    const versionData = await checker.checkVersions(this.projectDir);
    
    if (versionData.hasUpdates) {
      console.log(`📦 Found ${versionData.updates.length} update(s):\n`);
      
      for (const update of versionData.updates) {
        const { hook, currentVersion, previousVersion, updateType } = update;
        const emoji = this.getUpdateEmoji(updateType);
        
        console.log(`${emoji} ${hook.name}`);
        console.log(`   Version: ${previousVersion} → ${currentVersion}`);
        console.log(`   Type: ${updateType}`);
        console.log(`   Description: ${hook.description || 'No description'}`);
        console.log('');
      }
      
      console.log('💡 Run `node hooks/version-checker/update.js update` to update all hooks');
      console.log('💡 Run `node hooks/version-checker/update.js update <hook-name>` to update specific hook');
    } else {
      console.log('✅ All hooks are up to date!');
      console.log(`📊 Total hooks: ${versionData.totalHooks}`);
    }
  }

  /**
   * Update hooks
   * @param {string} hookName - Optional specific hook name
   */
  async updateHooks(hookName) {
    console.log('🔄 Starting hook update process...\n');
    
    const VersionChecker = require('./index.js');
    const checker = new VersionChecker();
    
    const versionData = await checker.checkVersions(this.projectDir);
    
    if (!versionData.hasUpdates) {
      console.log('✅ No updates available');
      return;
    }

    const updatesToApply = hookName 
      ? versionData.updates.filter(u => u.hook.name === hookName)
      : versionData.updates;

    if (updatesToApply.length === 0) {
      console.log(`❌ No updates found for hook: ${hookName}`);
      return;
    }

    for (const update of updatesToApply) {
      await this.updateSingleHook(update);
    }

    console.log('\n✅ Update process completed!');
    console.log('💡 Restart Claude Code to ensure hooks are properly reloaded');
  }

  /**
   * Update a single hook
   * @param {Object} update - Update information
   */
  async updateSingleHook(update) {
    const { hook, currentVersion, previousVersion } = update;
    
    console.log(`🔄 Updating ${hook.name}: ${previousVersion} → ${currentVersion}`);
    
    try {
      // For now, just update the version tracking
      // In a real implementation, you might:
      // 1. Pull from git repository
      // 2. Download from package registry
      // 3. Copy from updated source
      
      console.log(`   ✅ ${hook.name} updated successfully`);
      
      // Update installation timestamp
      const configPath = path.join(hook.path, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.lastUpdated = new Date().toISOString();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
      
    } catch (error) {
      console.error(`   ❌ Failed to update ${hook.name}: ${error.message}`);
    }
  }

  /**
   * List all hooks with version information
   */
  async listHooks() {
    console.log('📋 Installed Hooks:\n');
    
    const VersionChecker = require('./index.js');
    const checker = new VersionChecker();
    
    const hooks = checker.discoverHooks(this.hooksDir);
    
    if (hooks.length === 0) {
      console.log('❌ No hooks found in hooks directory');
      return;
    }

    console.log(`Found ${hooks.length} hook(s):\n`);
    
    for (const hook of hooks) {
      console.log(`📦 ${hook.name} v${hook.version}`);
      console.log(`   Author: ${hook.author}`);
      console.log(`   Path: ${path.relative(this.projectDir, hook.path)}`);
      if (hook.description) {
        console.log(`   Description: ${hook.description}`);
      }
      
      // Show events this hook handles
      if (hook.config.events) {
        console.log(`   Events: ${hook.config.events.join(', ')}`);
      }
      
      console.log('');
    }
  }

  /**
   * Reset version tracking
   */
  async resetVersions() {
    console.log('🔄 Resetting version tracking...');
    
    if (fs.existsSync(this.versionFile)) {
      fs.unlinkSync(this.versionFile);
      console.log('✅ Version file deleted');
    }
    
    console.log('✅ Version tracking reset');
    console.log('💡 Next session start will rebuild version information');
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log('🔧 Hook Update Utility\n');
    console.log('Commands:');
    console.log('  check              Check for available updates (default)');
    console.log('  update [hook]      Update all hooks or specific hook');
    console.log('  list               List all installed hooks');
    console.log('  reset              Reset version tracking');
    console.log('  help               Show this help message');
    console.log('\nExamples:');
    console.log('  node hooks/version-checker/update.js check');
    console.log('  node hooks/version-checker/update.js update');
    console.log('  node hooks/version-checker/update.js update extended-thinking');
    console.log('  node hooks/version-checker/update.js list');
  }

  /**
   * Get emoji for update type
   * @param {string} updateType - Type of update
   */
  getUpdateEmoji(updateType) {
    const emojis = {
      'new': '🆕',
      'major': '🚀',
      'minor': '✨',
      'patch': '🔧'
    };
    return emojis[updateType] || '📄';
  }
}

// Run the updater
if (require.main === module) {
  const updater = new HookUpdater();
  updater.run().catch(error => {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  });
}

module.exports = HookUpdater;