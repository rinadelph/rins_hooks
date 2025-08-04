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
   * Return success result
   */
  success() {
    return { continue: true };
  }
}

// When run directly, parse input and execute
if (require.main === module) {
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