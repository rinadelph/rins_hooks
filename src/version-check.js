const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Version Check Utility
 * Checks for hook updates when rapala is run
 */

class VersionCheck {
  constructor() {
    this.projectDir = process.cwd();
    this.packageDir = path.join(__dirname, '..');
    this.hooksDir = path.join(this.packageDir, 'hooks');
  }

  /**
   * Quick check for updates - runs on every rapala command
   */
  async quickCheck() {
    try {
      // Only check if we're in a directory with hooks installed
      const versionFile = path.join(this.projectDir, '.claude', 'hook-versions.json');
      
      if (!fs.existsSync(versionFile)) {
        // No version file means no hooks installed here
        return;
      }

      // Check if we should skip (already checked recently)
      const lastCheck = this.getLastCheckTime(versionFile);
      const now = Date.now();
      const checkInterval = 6 * 60 * 60 * 1000; // 6 hours
      
      if (lastCheck && (now - lastCheck) < checkInterval) {
        return; // Skip check if done recently
      }

      // Quick version check
      const updateInfo = await this.checkForUpdates();
      
      if (updateInfo.hasUpdates) {
        this.displayUpdateNotification(updateInfo);
      }

      // Update last check time
      this.updateLastCheckTime(versionFile);

    } catch (error) {
      // Fail silently - don't interrupt the main command
      if (process.env.DEBUG) {
        console.error(chalk.gray(`Version check failed: ${error.message}`));
      }
    }
  }

  /**
   * Get last check timestamp from version file
   */
  getLastCheckTime(versionFile) {
    try {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      return data.lastUpdateCheck ? new Date(data.lastUpdateCheck).getTime() : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update last check timestamp
   */
  updateLastCheckTime(versionFile) {
    try {
      let data = {};
      if (fs.existsSync(versionFile)) {
        data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      }
      
      data.lastUpdateCheck = new Date().toISOString();
      
      const dir = path.dirname(versionFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(versionFile, JSON.stringify(data, null, 2));
    } catch (error) {
      // Ignore write errors
    }
  }

  /**
   * Check for available updates
   */
  async checkForUpdates() {
    const versionFile = path.join(this.projectDir, '.claude', 'hook-versions.json');
    
    // Load current version data
    let versionData = { hooks: {} };
    if (fs.existsSync(versionFile)) {
      try {
        versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      } catch (error) {
        // Use default empty data
      }
    }

    // Discover installed hooks
    const installedHooks = this.discoverHooks();
    
    // Check for updates
    const updates = [];
    for (const hook of installedHooks) {
      const stored = versionData.hooks[hook.name];
      if (!stored || this.compareVersions(hook.version, stored.version) > 0) {
        updates.push({
          name: hook.name,
          currentVersion: hook.version,
          previousVersion: stored?.version || 'none',
          description: hook.description,
          updateType: this.getUpdateType(hook.version, stored?.version)
        });
      }
    }

    return {
      hasUpdates: updates.length > 0,
      updates,
      totalHooks: installedHooks.length
    };
  }

  /**
   * Discover installed hooks
   */
  discoverHooks() {
    const hooks = [];
    
    if (!fs.existsSync(this.hooksDir)) {
      return hooks;
    }

    const hookDirs = fs.readdirSync(this.hooksDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const hookName of hookDirs) {
      const configPath = path.join(this.hooksDir, hookName, 'config.json');
      
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          hooks.push({
            name: hookName,
            version: config.version || '0.0.0',
            description: config.description || ''
          });
        } catch (error) {
          // Skip malformed configs
        }
      }
    }

    return hooks;
  }

  /**
   * Compare semantic versions
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
   * Get update type
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
   * Display update notification
   */
  displayUpdateNotification(updateInfo) {
    const { updates } = updateInfo;
    
    console.log(chalk.yellow('┌────────────────────────────────────────┐'));
    console.log(chalk.yellow('│') + chalk.bold.cyan('  🔄 Hook Updates Available!           ') + chalk.yellow('│'));
    console.log(chalk.yellow('└────────────────────────────────────────┘'));
    console.log();

    // Show up to 3 most important updates
    const displayUpdates = updates
      .sort((a, b) => {
        const priority = { major: 3, minor: 2, patch: 1, new: 0 };
        return priority[b.updateType] - priority[a.updateType];
      })
      .slice(0, 3);

    for (const update of displayUpdates) {
      const emoji = this.getUpdateEmoji(update.updateType);
      const versionChange = update.previousVersion === 'none' 
        ? chalk.green(`v${update.currentVersion}`)
        : chalk.yellow(`${update.previousVersion}`) + ' → ' + chalk.green(`${update.currentVersion}`);
      
      console.log(`  ${emoji} ${chalk.bold(update.name)} ${versionChange}`);
    }

    if (updates.length > 3) {
      console.log(chalk.gray(`  ... and ${updates.length - 3} more update(s)`));
    }

    console.log();
    console.log(chalk.cyan('💡 Run'), chalk.bold('node hooks/version-checker/update.js check'), chalk.cyan('for details'));
    console.log(chalk.cyan('💡 Run'), chalk.bold('node hooks/version-checker/update.js update'), chalk.cyan('to update all'));
    console.log();
  }

  /**
   * Get emoji for update type
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

module.exports = VersionCheck;