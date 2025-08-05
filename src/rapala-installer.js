#!/usr/bin/env node

/**
 * Rapala Global Installer
 * Installs core Rapala infrastructure (router + command) into user and project settings
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class RapalaInstaller {
  constructor() {
    this.coreHooks = {
      "SessionStart": [{
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": `node "${path.join(__dirname, '../hooks/rapala-router/index.js')}"`
          },
          {
            "type": "command", 
            "command": `node "${path.join(__dirname, '../hooks/rapala-command/index.js')}"`
          }
        ]
      }]
    };
  }

  async install() {
    console.log('🚀 Installing Rapala globally...');
    
    // Install to user-level settings
    await this.installToUserLevel();
    
    // Install to current project
    await this.installToProject();
    
    console.log('✅ Rapala installation complete!');
    console.log('   - User-level: ~/.claude/settings.json');
    console.log('   - Project-level: ./.claude/settings.json');
    console.log('\nRapala is now available everywhere Claude Code runs.');
  }

  async installToUserLevel() {
    const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    await this.installToSettingsFile(userSettingsPath, 'User-level');
  }

  async installToProject() {
    const projectSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    await this.installToSettingsFile(projectSettingsPath, 'Project-level');
  }

  async installToSettingsFile(settingsPath, level) {
    try {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(settingsPath));
      
      // Read existing settings or create new
      let settings = {};
      if (await fs.pathExists(settingsPath)) {
        try {
          settings = await fs.readJson(settingsPath);
        } catch (e) {
          console.log(`⚠️  ${level} settings file corrupted, creating backup...`);
          await fs.copy(settingsPath, `${settingsPath}.backup.${Date.now()}`);
          settings = {};
        }
      }

      // Check if Rapala is already installed
      if (this.isRapalaInstalled(settings)) {
        console.log(`✓ ${level} already has Rapala installed`);
        return;
      }

      // Create backup
      if (await fs.pathExists(settingsPath)) {
        await fs.copy(settingsPath, `${settingsPath}.backup.${Date.now()}`);
      }

      // Merge core hooks
      settings = this.mergeSettings(settings, this.coreHooks);

      // Write updated settings
      await fs.writeJson(settingsPath, settings, { spaces: 2 });
      console.log(`✅ ${level} settings updated`);

    } catch (error) {
      console.error(`❌ Failed to install to ${level}: ${error.message}`);
    }
  }

  isRapalaInstalled(settings) {
    if (!settings.SessionStart || !Array.isArray(settings.SessionStart)) {
      return false;
    }

    return settings.SessionStart.some(sessionStart => 
      sessionStart.hooks && sessionStart.hooks.some(hook => 
        hook.command && hook.command.includes('rapala-router')
      )
    );
  }

  mergeSettings(existing, newSettings) {
    const merged = { ...existing };

    for (const [event, hooks] of Object.entries(newSettings)) {
      if (!merged[event]) {
        merged[event] = hooks;
      } else {
        // Merge with existing hooks, avoiding duplicates
        merged[event] = [...merged[event], ...hooks];
      }
    }

    return merged;
  }
}

// Run installer
if (require.main === module) {
  const installer = new RapalaInstaller();
  installer.install().catch(console.error);
}

module.exports = RapalaInstaller;