const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const inquirer = require('inquirer');

class ConfigManager {
  constructor() {
    this.userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    this.projectSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    this.localSettingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
  }

  getSettingsPath(scope) {
    switch (scope) {
      case 'user':
        return this.userSettingsPath;
      case 'project':
        return this.projectSettingsPath;
      case 'local':
        return this.localSettingsPath;
      default:
        throw new Error(`Invalid scope: ${scope}`);
    }
  }

  async ensureSettingsFileExists(scope) {
    const settingsPath = this.getSettingsPath(scope);
    const settingsDir = path.dirname(settingsPath);
    
    // Create .claude directory if it doesn't exist
    await fs.ensureDir(settingsDir);
    
    // Create settings file if it doesn't exist
    if (!await fs.pathExists(settingsPath)) {
      await fs.writeJson(settingsPath, {}, { spaces: 2 });
    }
  }

  async loadSettings(scope) {
    try {
      const settingsPath = this.getSettingsPath(scope);
      
      if (!await fs.pathExists(settingsPath)) {
        return {};
      }
      
      return await fs.readJson(settingsPath);
    } catch (error) {
      throw new Error(`Failed to load settings: ${error.message}`);
    }
  }

  async saveSettings(scope, settings) {
    try {
      await this.ensureSettingsFileExists(scope);
      const settingsPath = this.getSettingsPath(scope);
      await fs.writeJson(settingsPath, settings, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  async addHook(eventType, hookConfig, scope) {
    try {
      const settings = await this.loadSettings(scope);
      
      // Initialize hooks structure if it doesn't exist
      if (!settings.hooks) {
        settings.hooks = {};
      }
      
      if (!settings.hooks[eventType]) {
        settings.hooks[eventType] = [];
      }
      
      // Check if hook already exists
      const existingHookIndex = settings.hooks[eventType].findIndex(
        h => h.matcher === hookConfig.matcher
      );
      
      if (existingHookIndex !== -1) {
        // Update existing hook
        settings.hooks[eventType][existingHookIndex] = hookConfig;
      } else {
        // Add new hook
        settings.hooks[eventType].push(hookConfig);
      }
      
      await this.saveSettings(scope, settings);
    } catch (error) {
      throw new Error(`Failed to add hook: ${error.message}`);
    }
  }

  async removeHook(hookName, scope) {
    try {
      const settings = await this.loadSettings(scope);
      
      if (!settings.hooks) {
        return;
      }
      
      // Remove hook from all event types
      for (const eventType of Object.keys(settings.hooks)) {
        settings.hooks[eventType] = settings.hooks[eventType].filter(hook => {
          // Check if this hook belongs to the specified hook name
          return !hook.hooks?.some(h => h.command?.includes(hookName));
        });
        
        // Clean up empty arrays
        if (settings.hooks[eventType].length === 0) {
          delete settings.hooks[eventType];
        }
      }
      
      // Clean up empty hooks object
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
      
      await this.saveSettings(scope, settings);
    } catch (error) {
      throw new Error(`Failed to remove hook: ${error.message}`);
    }
  }

  async getInstallationStatus() {
    try {
      const status = {
        user: [],
        project: [],
        local: []
      };
      
      for (const scope of ['user', 'project', 'local']) {
        const settings = await this.loadSettings(scope);
        
        if (settings.hooks) {
          for (const [eventType, hooks] of Object.entries(settings.hooks)) {
            for (const hook of hooks) {
              if (hook.hooks) {
                for (const hookCommand of hook.hooks) {
                  if (hookCommand.command) {
                    // Extract hook name from command
                    const match = hookCommand.command.match(/\/([^\/]+)\/index\.js/);
                    if (match) {
                      const hookName = match[1];
                      status[scope].push({
                        name: hookName,
                        eventType: eventType,
                        matcher: hook.matcher,
                        status: 'installed'
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      return status;
    } catch (error) {
      throw new Error(`Failed to get installation status: ${error.message}`);
    }
  }

  async createBackup(scope) {
    try {
      const settingsPath = this.getSettingsPath(scope);
      
      if (!await fs.pathExists(settingsPath)) {
        return;
      }
      
      const backupPath = `${settingsPath}.backup.${Date.now()}`;
      await fs.copy(settingsPath, backupPath);
      
      console.log(chalk.blue(`📋 Backup created: ${backupPath}`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to create backup: ${error.message}`));
    }
  }

  async showConfig(hookName) {
    try {
      console.log(chalk.blue('📋 Configuration Status'));
      console.log();
      
      for (const scope of ['user', 'project', 'local']) {
        const settings = await this.loadSettings(scope);
        const scopeTitle = scope.charAt(0).toUpperCase() + scope.slice(1);
        
        console.log(chalk.green(`${scopeTitle} Level:`));
        
        if (settings.hooks) {
          let found = false;
          for (const [eventType, hooks] of Object.entries(settings.hooks)) {
            for (const hook of hooks) {
              if (hookName) {
                // Show specific hook
                if (hook.hooks?.some(h => h.command?.includes(hookName))) {
                  console.log(chalk.cyan(`  Event: ${eventType}`));
                  console.log(chalk.gray(`  Matcher: ${hook.matcher}`));
                  console.log(chalk.gray(`  Command: ${hook.hooks[0].command}`));
                  console.log(chalk.gray(`  Timeout: ${hook.hooks[0].timeout}s`));
                  found = true;
                }
              } else {
                // Show all hooks
                console.log(chalk.cyan(`  Event: ${eventType}`));
                console.log(chalk.gray(`  Matcher: ${hook.matcher}`));
                if (hook.hooks) {
                  hook.hooks.forEach(h => {
                    console.log(chalk.gray(`  Command: ${h.command}`));
                  });
                }
                found = true;
              }
            }
          }
          
          if (!found) {
            if (hookName) {
              console.log(chalk.gray(`  No configuration found for ${hookName}`));
            } else {
              console.log(chalk.gray('  No hooks configured'));
            }
          }
        } else {
          console.log(chalk.gray('  No hooks configured'));
        }
        
        console.log();
      }
    } catch (error) {
      throw new Error(`Failed to show configuration: ${error.message}`);
    }
  }

  async editConfig(hookName) {
    try {
      // This would open an editor for configuration
      // For now, we'll just show the current config
      console.log(chalk.yellow('ℹ️  Configuration editing not yet implemented.'));
      console.log('Current configuration:');
      console.log();
      
      await this.showConfig(hookName);
    } catch (error) {
      throw new Error(`Failed to edit configuration: ${error.message}`);
    }
  }

  async resetConfig(hookName) {
    try {
      if (hookName) {
        // Reset specific hook
        for (const scope of ['user', 'project', 'local']) {
          await this.removeHook(hookName, scope);
        }
        console.log(chalk.green(`✅ Configuration reset for ${hookName}`));
      } else {
        // Reset all hooks
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to reset ALL hook configurations?',
            default: false
          }
        ]);
        
        if (confirm) {
          for (const scope of ['user', 'project', 'local']) {
            const settings = await this.loadSettings(scope);
            if (settings.hooks) {
              delete settings.hooks;
              await this.saveSettings(scope, settings);
            }
          }
          console.log(chalk.green('✅ All hook configurations reset'));
        } else {
          console.log(chalk.yellow('ℹ️  Reset cancelled'));
        }
      }
    } catch (error) {
      throw new Error(`Failed to reset configuration: ${error.message}`);
    }
  }

  async validateConfig(hookName) {
    try {
      console.log(chalk.blue('🔍 Validating Configuration'));
      console.log();
      
      let isValid = true;
      
      for (const scope of ['user', 'project', 'local']) {
        const settings = await this.loadSettings(scope);
        const scopeTitle = scope.charAt(0).toUpperCase() + scope.slice(1);
        
        console.log(chalk.green(`${scopeTitle} Level:`));
        
        if (settings.hooks) {
          for (const [eventType, hooks] of Object.entries(settings.hooks)) {
            for (const hook of hooks) {
              if (hookName) {
                // Validate specific hook
                if (hook.hooks?.some(h => h.command?.includes(hookName))) {
                  const validation = await this.validateHookConfig(hook);
                  if (validation.isValid) {
                    console.log(chalk.green(`  ✅ ${hookName} configuration is valid`));
                  } else {
                    console.log(chalk.red(`  ❌ ${hookName} configuration is invalid:`));
                    validation.errors.forEach(error => {
                      console.log(chalk.red(`     ${error}`));
                    });
                    isValid = false;
                  }
                }
              } else {
                // Validate all hooks
                const validation = await this.validateHookConfig(hook);
                if (validation.isValid) {
                  console.log(chalk.green(`  ✅ Hook configuration is valid`));
                } else {
                  console.log(chalk.red(`  ❌ Hook configuration is invalid:`));
                  validation.errors.forEach(error => {
                    console.log(chalk.red(`     ${error}`));
                  });
                  isValid = false;
                }
              }
            }
          }
        } else {
          console.log(chalk.gray('  No hooks configured'));
        }
        
        console.log();
      }
      
      if (isValid) {
        console.log(chalk.green('✅ All configurations are valid'));
      } else {
        console.log(chalk.red('❌ Some configurations have errors'));
      }
      
    } catch (error) {
      throw new Error(`Failed to validate configuration: ${error.message}`);
    }
  }

  async validateHookConfig(hook) {
    const errors = [];
    
    // Check required fields
    if (!hook.hooks || !Array.isArray(hook.hooks)) {
      errors.push('Missing or invalid hooks array');
    }
    
    if (hook.hooks) {
      for (const hookCommand of hook.hooks) {
        if (!hookCommand.command) {
          errors.push('Missing command');
        }
        
        if (hookCommand.timeout && (typeof hookCommand.timeout !== 'number' || hookCommand.timeout < 0)) {
          errors.push('Invalid timeout value');
        }
        
        // Check if command file exists
        if (hookCommand.command) {
          const commandMatch = hookCommand.command.match(/node\s+"([^"]+)"/);
          if (commandMatch) {
            const scriptPath = commandMatch[1];
            if (!await fs.pathExists(scriptPath)) {
              errors.push(`Hook script not found: ${scriptPath}`);
            }
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  async enableHook(hookName, options) {
    // This would enable a disabled hook
    // For now, we'll just show a message
    console.log(chalk.yellow('ℹ️  Hook enable/disable functionality not yet implemented.'));
    console.log('Use `rins_hooks install` to add hooks or `rins_hooks uninstall` to remove them.');
  }

  async disableHook(hookName, options) {
    // This would disable an enabled hook
    // For now, we'll just show a message
    console.log(chalk.yellow('ℹ️  Hook enable/disable functionality not yet implemented.'));
    console.log('Use `rins_hooks install` to add hooks or `rins_hooks uninstall` to remove them.');
  }
}

module.exports = ConfigManager;