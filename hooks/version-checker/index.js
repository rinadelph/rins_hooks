#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Version Checker Hook for Claude Code
 * 
 * Features:
 * - Checks all installed hooks for version updates
 * - Maintains version registry and update history
 * - Provides SessionStart notifications for updates
 * - Supports auto-update and manual update modes
 * - Tracks last update check timestamps
 */

class VersionCheckerHook {
  constructor() {
    this.name = 'version-checker';
    this.version = '1.0.0';
  }

  /**
   * Execute the version checker hook
   * @param {Object} input - Hook input from Claude Code
   */
  async execute(input) {
    try {
      if (!input || input.hook_event_name !== 'SessionStart') {
        return this.success();
      }

      const projectDir = input.cwd || process.cwd();
      const versionData = await this.checkVersions(projectDir);
      
      if (versionData.hasUpdates) {
        // Check if auto-update is enabled
        if (versionData.versionData.settings.autoUpdate) {
          return await this.performAutoUpdate(versionData);
        } else {
          return this.reportUpdates(versionData);
        }
      }

      return this.success();

    } catch (error) {
      console.error(`Version checker error: ${error.message}`);
      return this.success(); // Fail gracefully
    }
  }

  /**
   * Check versions of all installed hooks
   * @param {string} projectDir - Project directory path
   */
  async checkVersions(projectDir) {
    const versionFile = path.join(projectDir, '.claude', 'hook-versions.json');
    const hooksDir = path.join(projectDir, 'hooks');
    
    // Load existing version data
    let versionData = this.loadVersionData(versionFile);
    
    // Discover all installed hooks
    const installedHooks = this.discoverHooks(hooksDir);
    
    // Check each hook for updates
    const updates = [];
    for (const hookInfo of installedHooks) {
      const updateInfo = await this.checkHookVersion(hookInfo, versionData);
      if (updateInfo.hasUpdate) {
        updates.push(updateInfo);
      }
    }

    // Update version registry
    versionData.lastChecked = new Date().toISOString();
    versionData.hooks = installedHooks.reduce((acc, hook) => {
      acc[hook.name] = {
        version: hook.version,
        lastChecked: versionData.lastChecked,
        path: hook.path
      };
      return acc;
    }, {});

    // Save updated version data
    this.saveVersionData(versionFile, versionData);

    return {
      hasUpdates: updates.length > 0,
      updates,
      totalHooks: installedHooks.length,
      versionData
    };
  }

  /**
   * Discover all installed hooks
   * @param {string} hooksDir - Hooks directory path
   */
  discoverHooks(hooksDir) {
    const hooks = [];
    
    if (!fs.existsSync(hooksDir)) {
      return hooks;
    }

    const hookDirs = fs.readdirSync(hooksDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const hookName of hookDirs) {
      const hookPath = path.join(hooksDir, hookName);
      const configPath = path.join(hookPath, 'config.json');
      
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          hooks.push({
            name: hookName,
            version: config.version || '0.0.0',
            description: config.description || '',
            author: config.author || 'unknown',
            path: hookPath,
            config
          });
        } catch (error) {
          console.warn(`Warning: Could not parse config for hook ${hookName}: ${error.message}`);
        }
      }
    }

    return hooks;
  }

  /**
   * Check if a specific hook has updates available
   * @param {Object} hookInfo - Hook information
   * @param {Object} versionData - Current version data
   */
  async checkHookVersion(hookInfo, versionData) {
    const stored = versionData.hooks[hookInfo.name];
    
    // If hook is new or version changed
    const hasUpdate = !stored || this.compareVersions(hookInfo.version, stored.version) > 0;
    
    return {
      hasUpdate,
      hook: hookInfo,
      currentVersion: hookInfo.version,
      previousVersion: stored?.version || 'none',
      updateType: this.getUpdateType(hookInfo.version, stored?.version)
    };
  }

  /**
   * Compare two semantic versions
   * @param {string} version1 - First version
   * @param {string} version2 - Second version  
   * @returns {number} -1, 0, or 1
   */
  compareVersions(version1, version2) {
    if (!version2) return 1;
    
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * Determine update type (major, minor, patch)
   * @param {string} newVersion - New version
   * @param {string} oldVersion - Old version
   */
  getUpdateType(newVersion, oldVersion) {
    if (!oldVersion) return 'new';
    
    const newParts = newVersion.split('.').map(Number);
    const oldParts = oldVersion.split('.').map(Number);
    
    if (newParts[0] > oldParts[0]) return 'major';
    if (newParts[1] > oldParts[1]) return 'minor';
    if (newParts[2] > oldParts[2]) return 'patch';
    
    return 'none';
  }

  /**
   * Load version data from file
   * @param {string} versionFile - Path to version file
   */
  loadVersionData(versionFile) {
    const defaultData = {
      hooks: {},
      lastChecked: null,
      checkInterval: 86400000, // 24 hours
      settings: {
        autoUpdate: true,  // Enable automatic updates
        notifyUpdates: true
      }
    };

    if (!fs.existsSync(versionFile)) {
      return defaultData;
    }

    try {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      return { ...defaultData, ...data };
    } catch (error) {
      console.warn(`Warning: Could not load version data: ${error.message}`);
      return defaultData;
    }
  }

  /**
   * Save version data to file
   * @param {string} versionFile - Path to version file
   * @param {Object} versionData - Version data to save
   */
  saveVersionData(versionFile, versionData) {
    const dir = path.dirname(versionFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
    } catch (error) {
      console.warn(`Warning: Could not save version data: ${error.message}`);
    }
  }

  /**
   * Report available updates
   * @param {Object} versionData - Version check results
   */
  reportUpdates(versionData) {
    const context = this.buildUpdateContext(versionData);
    
    const result = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context
      }
    };

    console.log(JSON.stringify(result));
    process.exit(0);
  }

  /**
   * Build context message for updates
   * @param {Object} versionData - Version check results
   */
  buildUpdateContext(versionData) {
    const { updates, totalHooks } = versionData;
    
    let context = `## 🔄 Hook Updates Available\n\n`;
    context += `Found ${updates.length} update(s) out of ${totalHooks} installed hooks:\n\n`;

    for (const update of updates) {
      const { hook, currentVersion, previousVersion, updateType } = update;
      const emoji = this.getUpdateEmoji(updateType);
      
      context += `${emoji} **${hook.name}** ${previousVersion} → ${currentVersion}\n`;
      context += `   ${hook.description || 'No description available'}\n`;
      if (updateType === 'major') {
        context += `   ⚠️  Major version update - please review changelog\n`;
      }
      context += `\n`;
    }

    context += `### 📋 Available Commands:\n`;
    context += `- Use \`/hooks\` to review hook configurations\n`;
    context += `- Run \`rins_hooks update\` to update hooks\n`;
    context += `- Run \`rins_hooks agentmcp\` for Agent-MCP management\n`;
    context += `- Check \`.claude/hook-versions.json\` for version history\n\n`;
    
    context += `*Version check completed at ${new Date().toLocaleString()}*`;

    return context;
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

  /**
   * Perform automatic update of hooks
   * @param {Object} versionData - Version check results
   */
  async performAutoUpdate(versionData) {
    const { updates, totalHooks } = versionData;
    
    try {
      // Find the rins_hooks installation
      const rinsHooksCmd = this.findRinsHooksCommand();
      
      let context = `## 🔄 Auto-Updating Hooks\n\n`;
      context += `Found ${updates.length} update(s) out of ${totalHooks} installed hooks. Auto-updating...\n\n`;

      const updateResults = [];
      
      for (const update of updates) {
        const { hook, currentVersion, previousVersion, updateType } = update;
        const emoji = this.getUpdateEmoji(updateType);
        
        try {
          // Attempt to update this hook
          context += `${emoji} **${hook.name}** ${previousVersion} → ${currentVersion}\n`;
          context += `   ${hook.description || 'No description available'}\n`;
          
          // Use rins_hooks to install/update the hook
          if (rinsHooksCmd) {
            execSync(`${rinsHooksCmd} install ${hook.name} --user`, { 
              stdio: 'pipe',
              timeout: 30000 
            });
            context += `   ✅ Updated successfully\n`;
            updateResults.push({ hook: hook.name, status: 'success' });
          } else {
            context += `   ⚠️  Could not find rins_hooks command - skipping\n`;
            updateResults.push({ hook: hook.name, status: 'skipped' });
          }
        } catch (updateError) {
          context += `   ❌ Update failed: ${updateError.message}\n`;
          updateResults.push({ hook: hook.name, status: 'failed', error: updateError.message });
        }
        
        context += `\n`;
      }

      // Summary
      const successful = updateResults.filter(r => r.status === 'success').length;
      const failed = updateResults.filter(r => r.status === 'failed').length;
      const skipped = updateResults.filter(r => r.status === 'skipped').length;

      context += `### 📊 Update Summary:\n`;
      if (successful > 0) context += `- ✅ Successfully updated: ${successful} hooks\n`;
      if (failed > 0) context += `- ❌ Failed to update: ${failed} hooks\n`;
      if (skipped > 0) context += `- ⚠️  Skipped: ${skipped} hooks\n`;
      context += `\n`;

      context += `### 📋 Management Commands:\n`;
      context += `- Run \`rins_hooks status\` for hook control panel\n`;
      context += `- Run \`rins_hooks agentmcp\` for Agent-MCP management\n`;
      context += `- Use \`/hooks\` to review configurations\n\n`;
      
      context += `*Auto-update completed at ${new Date().toLocaleString()}*`;

      // Return the update context
      const result = {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: context
        }
      };

      console.log(JSON.stringify(result));
      process.exit(0);

    } catch (error) {
      // Fall back to notification if auto-update fails
      console.error(`Auto-update failed: ${error.message}`);
      return this.reportUpdates(versionData);
    }
  }

  /**
   * Find the rins_hooks command (global or local)
   */
  findRinsHooksCommand() {
    try {
      // Try global installation first
      execSync('which rins_hooks', { stdio: 'pipe' });
      return 'rins_hooks';
    } catch (error) {
      try {
        // Try npx for local installation
        execSync('which npx', { stdio: 'pipe' });
        return 'npx rins_hooks';
      } catch (npxError) {
        // Check if we're running from the rins_hooks project directory
        const localCmd = path.join(process.cwd(), 'src', 'cli.js');
        if (fs.existsSync(localCmd)) {
          return `node ${localCmd}`;
        }
        return null;
      }
    }
  }

  /**
   * Toggle auto-update setting
   * @param {string} projectDir - Project directory
   * @param {boolean} enabled - Enable or disable auto-update
   */
  static toggleAutoUpdate(projectDir = process.cwd(), enabled = null) {
    const versionFile = path.join(projectDir, '.claude', 'hook-versions.json');
    const hook = new VersionCheckerHook();
    
    let versionData = hook.loadVersionData(versionFile);
    
    if (enabled === null) {
      // Toggle current setting
      versionData.settings.autoUpdate = !versionData.settings.autoUpdate;
    } else {
      // Set specific value
      versionData.settings.autoUpdate = enabled;
    }
    
    hook.saveVersionData(versionFile, versionData);
    
    return versionData.settings.autoUpdate;
  }

  /**
   * Get auto-update status
   * @param {string} projectDir - Project directory
   */
  static getAutoUpdateStatus(projectDir = process.cwd()) {
    const versionFile = path.join(projectDir, '.claude', 'hook-versions.json');
    const hook = new VersionCheckerHook();
    const versionData = hook.loadVersionData(versionFile);
    
    return {
      autoUpdate: versionData.settings.autoUpdate,
      notifyUpdates: versionData.settings.notifyUpdates,
      lastChecked: versionData.lastChecked,
      checkInterval: versionData.checkInterval
    };
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
  const args = process.argv.slice(2);
  
  // Handle command-line arguments for auto-update control
  if (args.includes('--toggle-auto-update')) {
    const currentStatus = VersionCheckerHook.toggleAutoUpdate();
    console.log(`🔄 Auto-update is now: ${currentStatus ? '✅ ENABLED' : '❌ DISABLED'}`);
    process.exit(0);
  }
  
  if (args.includes('--enable-auto-update')) {
    VersionCheckerHook.toggleAutoUpdate(process.cwd(), true);
    console.log('🔄 Auto-update: ✅ ENABLED');
    process.exit(0);
  }
  
  if (args.includes('--disable-auto-update')) {
    VersionCheckerHook.toggleAutoUpdate(process.cwd(), false);
    console.log('🔄 Auto-update: ❌ DISABLED');
    process.exit(0);
  }
  
  if (args.includes('--status')) {
    const status = VersionCheckerHook.getAutoUpdateStatus();
    console.log('📊 Version Checker Status:');
    console.log(`   Auto-update: ${status.autoUpdate ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   Notifications: ${status.notifyUpdates ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   Last checked: ${status.lastChecked || 'Never'}`);
    console.log(`   Check interval: ${Math.round(status.checkInterval / 3600000)} hours`);
    process.exit(0);
  }
  
  // Default hook execution
  const hook = new VersionCheckerHook();
  
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
      console.error(`Version checker hook error: ${error.message}`);
      process.exit(1);
    }
  });
}

module.exports = VersionCheckerHook;