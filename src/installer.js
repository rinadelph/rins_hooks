const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const inquirer = require('inquirer');

const Utils = require('./utils');
const ConfigManager = require('./config');

class Installer {
  constructor() {
    this.utils = new Utils();
    this.configManager = new ConfigManager();
    this.hooksDir = path.join(__dirname, '..', 'hooks');
  }

  async getAvailableHooks() {
    try {
      const hookDirs = await fs.readdir(this.hooksDir);
      const hooks = [];

      for (const hookDir of hookDirs) {
        const hookPath = path.join(this.hooksDir, hookDir);
        const stat = await fs.stat(hookPath);

        if (stat.isDirectory()) {
          const configPath = path.join(hookPath, 'config.json');

          if (await fs.pathExists(configPath)) {
            try {
              const config = await fs.readJson(configPath);
              hooks.push({
                name: config.name || hookDir,
                description: config.description || 'No description available',
                version: config.version || '1.0.0',
                tags: config.tags || [],
                requirements: config.requirements || [],
                platforms: config.platforms || ['linux', 'darwin', 'win32'],
                matcher: config.matcher || '',
                timeout: config.timeout || 60
              });
            } catch (error) {
              console.warn(chalk.yellow(`⚠️  Could not load config for hook: ${hookDir}`));
            }
          }
        }
      }

      return hooks;
    } catch (error) {
      throw new Error(`Failed to get available hooks: ${error.message}`);
    }
  }

  async interactiveInstall(options = {}) {
    try {
      console.log(chalk.blue('🚀 Interactive Installation'));
      console.log();

      // Get available hooks
      const availableHooks = await this.getAvailableHooks();

      if (availableHooks.length === 0) {
        console.log(chalk.red('❌ No hooks available for installation.'));
        return;
      }

      // Show scope information
      console.log(chalk.blue('📍 Installation Scope Options:'));
      console.log(chalk.gray('  👤 User Level: ~/.claude/settings.json (affects all Claude Code projects)'));
      console.log(chalk.gray('  📁 Project Level: .claude/settings.json (current project only, committed to git)'));
      console.log(chalk.gray('  🔒 Local Level: .claude/settings.local.json (current project, NOT committed to git)'));
      console.log();

      // Select installation scope
      const { scope } = await inquirer.prompt([
        {
          type: 'list',
          name: 'scope',
          message: 'Where would you like to install the hooks?',
          choices: [
            {
              name: '👤 User Level (applies to all projects)',
              value: 'user'
            },
            {
              name: '📁 Project Level (current project only)',
              value: 'project'
            },
            {
              name: '🔒 Local Level (not committed to git)',
              value: 'local'
            }
          ]
        }
      ]);

      // Select hooks to install
      const { selectedHooks } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedHooks',
          message: 'Select hooks to install:',
          choices: availableHooks.map(hook => ({
            name: `${hook.name} - ${hook.description}`,
            value: hook.name,
            checked: false
          }))
        }
      ]);

      if (selectedHooks.length === 0) {
        console.log(chalk.yellow('ℹ️  No hooks selected. Installation cancelled.'));
        return;
      }

      // Configure installation options
      const installOptions = { ...options, [scope]: true };

      // Install selected hooks
      await this.installHooks(selectedHooks, installOptions);

      console.log();
      console.log(chalk.green('✅ Interactive installation completed!'));
      console.log(chalk.cyan('Run `rins_hooks status` to verify the installation.'));

    } catch (error) {
      throw new Error(`Interactive installation failed: ${error.message}`);
    }
  }

  async installHooks(hookNames, options = {}) {
    try {
      console.log(chalk.blue(`📦 Installing hooks: ${hookNames.join(', ')}`));
      console.log();

      const availableHooks = await this.getAvailableHooks();
      const hooksToInstall = [];

      // Validate hook names
      for (const hookName of hookNames) {
        const hook = availableHooks.find(h => h.name === hookName);
        if (!hook) {
          console.error(chalk.red(`❌ Hook '${hookName}' not found.`));
          continue;
        }
        hooksToInstall.push(hook);
      }

      if (hooksToInstall.length === 0) {
        throw new Error('No valid hooks to install');
      }

      // Check platform compatibility
      const currentPlatform = os.platform();
      const incompatibleHooks = hooksToInstall.filter(hook =>
        hook.platforms && !hook.platforms.includes(currentPlatform)
      );

      if (incompatibleHooks.length > 0) {
        console.warn(chalk.yellow('⚠️  Platform compatibility warning:'));
        incompatibleHooks.forEach(hook => {
          console.warn(chalk.yellow(`   ${hook.name} supports: ${hook.platforms.join(', ')}`));
        });

        const { continueInstall } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueInstall',
            message: 'Continue with installation?',
            default: false
          }
        ]);

        if (!continueInstall) {
          console.log(chalk.yellow('ℹ️  Installation cancelled.'));
          return;
        }
      }

      // Check requirements
      await this.checkRequirements(hooksToInstall);

      // Determine installation scope
      const scope = this.determineScope(options);
      console.log(chalk.blue(`📍 Installation scope: ${scope}`));

      // Dry run check
      if (options.dryRun) {
        console.log(chalk.yellow('🔍 DRY RUN - No changes will be made'));
        console.log();

        for (const hook of hooksToInstall) {
          console.log(chalk.cyan(`Would install: ${hook.name}`));
          console.log(chalk.gray(`  Description: ${hook.description}`));
          console.log(chalk.gray(`  Matcher: ${hook.matcher}`));
          console.log(chalk.gray(`  Timeout: ${hook.timeout}s`));
          console.log();
        }
        return;
      }

      // Create backup
      await this.configManager.createBackup(scope);

      // Install hooks
      for (const hook of hooksToInstall) {
        await this.installSingleHook(hook, scope, options);
      }

      console.log();
      console.log(chalk.green('✅ All hooks installed successfully!'));

    } catch (error) {
      throw new Error(`Hook installation failed: ${error.message}`);
    }
  }

  async installAll(options = {}) {
    try {
      const availableHooks = await this.getAvailableHooks();
      const hookNames = availableHooks.map(hook => hook.name);

      if (hookNames.length === 0) {
        console.log(chalk.yellow('ℹ️  No hooks available to install.'));
        return;
      }

      await this.installHooks(hookNames, options);
    } catch (error) {
      throw new Error(`Install all failed: ${error.message}`);
    }
  }

  async installSingleHook(hook, scope) {
    try {
      console.log(chalk.blue(`🔧 Installing ${hook.name}...`));

      // Load hook configuration
      await this.loadHookConfig(hook.name);

      // Generate absolute path to hook script
      const hookScriptPath = path.resolve(this.hooksDir, hook.name, 'index.js');

      // Determine event type based on hook name and config
      let eventType = 'PostToolUse'; // Default
      if (hook.name === 'notification') {
        eventType = 'Notification';
      }

      // Generate Claude Code hook configuration
      const claudeConfig = {
        matcher: hook.matcher || '',
        hooks: [
          {
            type: 'command',
            command: `node "${hookScriptPath}"`,
            timeout: hook.timeout || 30
          }
        ]
      };

      // Add to Claude Code settings
      await this.configManager.addHook(eventType, claudeConfig, scope);

      console.log(chalk.green(`  ✅ ${hook.name} installed successfully`));
      console.log(chalk.gray(`    Event: ${eventType}`));
      console.log(chalk.gray(`    Matcher: ${hook.matcher || '(all)'}`));
      console.log(chalk.gray(`    Command: node "${hookScriptPath}"`));

    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to install ${hook.name}: ${error.message}`));
    }
  }

  async loadHookConfig(hookName) {
    try {
      const configPath = path.join(this.hooksDir, hookName, 'config.json');
      return await fs.readJson(configPath);
    } catch (error) {
      throw new Error(`Failed to load hook config: ${error.message}`);
    }
  }

  async checkRequirements(hooks) {
    const allRequirements = [...new Set(hooks.flatMap(hook => hook.requirements))];

    if (allRequirements.length === 0) {
      return;
    }

    console.log(chalk.blue('🔍 Checking requirements...'));

    for (const requirement of allRequirements) {
      const isAvailable = await this.utils.checkCommandAvailable(requirement);

      if (isAvailable) {
        console.log(chalk.green(`  ✅ ${requirement} is available`));
      } else {
        console.log(chalk.red(`  ❌ ${requirement} is not available`));

        // Provide installation suggestions
        const suggestion = this.getInstallationSuggestion(requirement);
        if (suggestion) {
          console.log(chalk.yellow(`     Try: ${suggestion}`));
        }
      }
    }

    console.log();
  }

  getInstallationSuggestion(command) {
    const suggestions = {
      'git': 'Install Git from https://git-scm.com/',
      'node': 'Install Node.js from https://nodejs.org/',
      'npm': 'Install npm (comes with Node.js)',
      'jq': 'Install jq: sudo apt-get install jq (Linux) or brew install jq (macOS)',
      'prettier': 'Install Prettier: npm install -g prettier',
      'eslint': 'Install ESLint: npm install -g eslint'
    };

    return suggestions[command] || null;
  }

  determineScope(options) {
    if (options.user) return 'user';
    if (options.project) return 'project';
    if (options.local) return 'local';

    // Default to project level
    return 'project';
  }

  async uninstallHooks(hookNames, options = {}) {
    try {
      console.log(chalk.blue(`🗑️  Uninstalling hooks: ${hookNames.join(', ')}`));
      console.log();

      const scope = this.determineScope(options);

      if (options.dryRun) {
        console.log(chalk.yellow('🔍 DRY RUN - No changes will be made'));
        console.log();

        for (const hookName of hookNames) {
          console.log(chalk.cyan(`Would uninstall: ${hookName} from ${scope} level`));
        }
        return;
      }

      // Create backup
      await this.configManager.createBackup(scope);

      // Remove hooks
      for (const hookName of hookNames) {
        await this.configManager.removeHook(hookName, scope);
        console.log(chalk.green(`  ✅ ${hookName} uninstalled successfully`));
      }

      console.log();
      console.log(chalk.green('✅ All hooks uninstalled successfully!'));

    } catch (error) {
      throw new Error(`Hook uninstallation failed: ${error.message}`);
    }
  }

  async uninstallAll(options = {}) {
    try {
      const status = await this.configManager.getInstallationStatus();
      const scope = this.determineScope(options);

      let installedHooks = [];

      switch (scope) {
        case 'user':
          installedHooks = status.user.map(h => h.name);
          break;
        case 'project':
          installedHooks = status.project.map(h => h.name);
          break;
        case 'local':
          installedHooks = status.local.map(h => h.name);
          break;
      }

      if (installedHooks.length === 0) {
        console.log(chalk.yellow(`ℹ️  No hooks installed at ${scope} level.`));
        return;
      }

      await this.uninstallHooks(installedHooks, options);

    } catch (error) {
      throw new Error(`Uninstall all failed: ${error.message}`);
    }
  }
}

module.exports = Installer;
