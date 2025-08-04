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
      console.log(chalk.cyan('Run `rapala status` to verify the installation.'));

    } catch (error) {
      throw new Error(`Interactive installation failed: ${error.message}`);
    }
  }

  /**
   * Enhanced interactive installation with rich TUI like AgentMCP
   */
  async enhancedInteractiveInstall(options = {}) {
    console.log(chalk.blue('🎣 Rapala Interactive Manager'));
    console.log(chalk.gray('Comprehensive hook management with intelligent installation'));
    console.log();

    // Check current status
    const status = await this.configManager.getInstallationStatus();
    const allInstalledHooks = [...status.user, ...status.project, ...status.local];
    const availableHooks = await this.getAvailableHooks();
    
    // Categorize hooks
    const categories = this.categorizeHooks(availableHooks, allInstalledHooks);

    // Main menu
    const mainChoice = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📦 Install Hooks', value: 'install' },
        { name: '🤖 Agent-MCP Suite', value: 'agentmcp' },
        { name: '📊 Show Installation Status', value: 'status' },
        { name: '🔧 Manage Existing Hooks', value: 'manage' },
        { name: '❌ Uninstall Hooks', value: 'uninstall' },
        { name: '🚪 Exit', value: 'exit' }
      ]
    }]);

    switch (mainChoice.action) {
      case 'install':
        await this.richInstallationFlow(categories, options);
        break;
      case 'agentmcp':
        const AgentMCPManager = require('./agent-mcp-manager');
        const agentManager = new AgentMCPManager();
        await agentManager.interactiveSetup(options);
        break;
      case 'status':
        await this.showEnhancedStatus(categories);
        break;
      case 'manage':
        await this.manageExistingHooks(allInstalledHooks);
        break;
      case 'uninstall':
        await this.interactiveUninstall(allInstalledHooks);
        break;
      case 'exit':
        console.log(chalk.green('👋 Hook management complete!'));
        break;
    }
  }

  /**
   * Categorize hooks by type and installation status
   */
  categorizeHooks(availableHooks, installedHooks) {
    const categories = {
      agentMCP: [],
      thinking: [],
      automation: [],
      utility: [],
      installed: [],
      uninstalled: []
    };

    availableHooks.forEach(hook => {
      const isInstalled = installedHooks.find(installed => installed.name === hook.name);
      
      if (isInstalled) {
        categories.installed.push(hook);
      } else {
        categories.uninstalled.push(hook);
      }

      // Categorize by type
      if (hook.tags.includes('agent-tracking') || hook.tags.includes('collaboration')) {
        categories.agentMCP.push(hook);
      } else if (hook.name.includes('thinking') || hook.tags.includes('analysis')) {
        categories.thinking.push(hook);
      } else if (hook.tags.includes('automation') || hook.tags.includes('git')) {
        categories.automation.push(hook);
      } else {
        categories.utility.push(hook);
      }
    });

    return categories;
  }

  /**
   * Rich installation flow with categorized options
   */
  async richInstallationFlow(categories, options) {
    console.log(chalk.blue('📦 Hook Installation'));
    console.log();

    if (categories.uninstalled.length === 0) {
      console.log(chalk.green('✅ All available hooks are already installed!'));
      return;
    }

    // Installation type selection
    const installType = await inquirer.prompt([{
      type: 'list',
      name: 'type',
      message: 'How would you like to install hooks?',
      choices: [
        { name: '🎯 By Category (recommended)', value: 'category' },
        { name: '📋 Individual Selection', value: 'individual' }
      ]
    }]);

    if (installType.type === 'category') {
      await this.categoryInstallation(categories, options);
    } else {
      await this.individualInstallation(categories.uninstalled, options);
    }
  }

  /**
   * Category-based installation
   */
  async categoryInstallation(categories, options) {
    const categoryChoices = [];
    
    if (categories.agentMCP.filter(h => !categories.installed.includes(h)).length > 0) {
      categoryChoices.push({
        name: `🤖 Agent-MCP Suite (${categories.agentMCP.filter(h => !categories.installed.includes(h)).length} hooks)\n    Multi-agent collaboration, git tracking, file locking`,
        value: 'agentMCP'
      });
    }

    if (categories.thinking.filter(h => !categories.installed.includes(h)).length > 0) {
      categoryChoices.push({
        name: `🧠 Thinking & Analysis (${categories.thinking.filter(h => !categories.installed.includes(h)).length} hooks)\n    Extended thinking, bias checking, reflection`,
        value: 'thinking'
      });
    }

    if (categories.automation.filter(h => !categories.installed.includes(h)).length > 0) {
      categoryChoices.push({
        name: `⚙️ Automation & Git (${categories.automation.filter(h => !categories.installed.includes(h)).length} hooks)\n    Auto-commit, formatting, version control`,
        value: 'automation'
      });
    }

    if (categories.utility.filter(h => !categories.installed.includes(h)).length > 0) {
      categoryChoices.push({
        name: `🔧 Utilities (${categories.utility.filter(h => !categories.installed.includes(h)).length} hooks)\n    Notifications, diagnostics, system tools`,
        value: 'utility'
      });
    }

    if (categoryChoices.length === 0) {
      console.log(chalk.green('✅ All hooks are already installed!'));
      return;
    }

    const categorySelection = await inquirer.prompt([{
      type: 'checkbox',
      name: 'categories',
      message: 'Select categories to install:',
      choices: categoryChoices
    }]);

    if (categorySelection.categories.length === 0) {
      console.log(chalk.yellow('ℹ️  No categories selected.'));
      return;
    }

    // Install selected categories
    const scope = await this.selectScope(options);
    
    for (const category of categorySelection.categories) {
      const hooksToInstall = categories[category]
        .filter(hook => !categories.installed.includes(hook))
        .map(hook => hook.name);
      
      if (hooksToInstall.length > 0) {
        console.log(chalk.cyan(`\n📦 Installing ${category} hooks...`));
        await this.installHooks(hooksToInstall, { ...options, [scope]: true });
      }
    }
  }

  /**
   * Individual hook selection with rich display - Rapala categorized view
   */
  async individualInstallation(uninstalledHooks, options) {
    // Get ALL hooks with installation status and categorize using Rapala system
    const status = await this.configManager.getInstallationStatus();
    const allInstalledHooks = [...status.user, ...status.project, ...status.local];
    const availableHooks = await this.getAvailableHooks();
    
    const choices = availableHooks.map(hook => {
      const isInstalled = allInstalledHooks.find(installed => installed.name === hook.name);
      const installStatus = isInstalled ? 
        chalk.green('✅ (installed)') : 
        chalk.cyan('📦 (available)');
      
      // Determine Rapala category
      const category = this.determineRapalaCategory(hook);
      const categoryIcon = this.getCategoryIcon(category);
      
      const tagsText = hook.tags.length > 0 ? chalk.gray(`[${hook.tags.join(', ')}]`) : '';
      const name = `${categoryIcon} ${hook.name} ${installStatus} ${tagsText}\n    ${chalk.gray(hook.description)}`;
      
      return {
        name,
        value: hook.name,
        disabled: isInstalled ? 'Already installed' : false
      };
    });

    const selection = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hooks',
      message: 'Select enhancements to install (🔗=Hook, 🔧=Tool, 📚=Resource, 💬=Prompt, 🤖=MCP):',
      choices,
      pageSize: 15
    }]);

    if (selection.hooks.length === 0) {
      console.log(chalk.yellow('ℹ️  No enhancements selected.'));
      return;
    }

    const scope = await this.selectScope(options);
    await this.installHooks(selection.hooks, { ...options, [scope]: true });
  }

  /**
   * Determine Rapala category for a hook
   */
  determineRapalaCategory(hook) {
    const name = hook.name || '';
    const tags = hook.tags || [];
    const description = hook.description || '';

    if (this.isHook(name, tags, description)) return 'hooks';
    if (this.isTool(name, tags, description)) return 'tools';
    if (this.isResource(name, tags, description)) return 'resources';
    if (this.isPrompt(name, tags, description)) return 'prompts';
    if (this.isMCP(name, tags, description)) return 'mcps';
    return 'hooks'; // Default fallback
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category) {
    const icons = {
      hooks: '🔗',
      tools: '🔧',
      resources: '📚',
      prompts: '💬',
      mcps: '🤖'
    };
    return icons[category] || '🔗';
  }

  /**
   * Classification methods for Rapala categories
   */
  isHook(name, tags, description) {
    const hookIndicators = [
      'hook', 'extended-thinking', 'notification', 'auto-commit', 'git-agentmcp', 
      'code-formatter', 'version-checker', 'debug-git'
    ];
    const hookTags = ['automation', 'git', 'commit', 'formatting', 'notification', 'debug'];
    
    return hookIndicators.some(indicator => name.includes(indicator)) ||
           hookTags.some(tag => tags.includes(tag)) ||
           description.toLowerCase().includes('hook');
  }

  isTool(name, tags, description) {
    const toolIndicators = ['task-blocker', 'no-coauthor', 'file-locking'];
    const toolTags = ['block', 'permissions', 'locking', 'settings'];
    
    return toolIndicators.some(indicator => name.includes(indicator)) ||
           toolTags.some(tag => tags.includes(tag)) ||
           description.toLowerCase().includes('block') ||
           description.toLowerCase().includes('disable') ||
           description.toLowerCase().includes('prevent');
  }

  isResource(name, tags, description) {
    const resourceIndicators = ['resource', 'doc', 'guide', 'template'];
    const resourceTags = ['documentation', 'reference', 'template', 'guide'];
    
    return resourceIndicators.some(indicator => name.includes(indicator)) ||
           resourceTags.some(tag => tags.includes(tag));
  }

  isPrompt(name, tags, description) {
    const promptIndicators = ['prompt', 'context', 'instruction'];
    const promptTags = ['prompt', 'context', 'instruction', 'template'];
    
    return promptIndicators.some(indicator => name.includes(indicator)) ||
           promptTags.some(tag => tags.includes(tag));
  }

  isMCP(name, tags, description) {
    const mcpIndicators = ['agent-registry', 'mcp'];
    const mcpTags = ['agent-tracking', 'registry', 'session-management', 'collaboration', 'multi-agent', 'agent-mcp'];
    
    return mcpIndicators.some(indicator => name.includes(indicator)) ||
           mcpTags.some(tag => tags.includes(tag)) ||
           description.toLowerCase().includes('agent') ||
           description.toLowerCase().includes('multi-agent');
  }

  /**
   * Enhanced scope selection
   */
  async selectScope(options) {
    if (options.user) return 'user';
    if (options.project) return 'project';
    if (options.local) return 'local';

    const scopeChoice = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Installation scope:',
      choices: [
        { 
          name: '👤 User Level - All Claude Code projects\n    ~/.claude/settings.json', 
          value: 'user',
          short: 'User'
        },
        { 
          name: '📁 Project Level - This project only (committed)\n    .claude/settings.json', 
          value: 'project',
          short: 'Project' 
        },
        { 
          name: '🔒 Local Level - This project only (not committed)\n    .claude/settings.local.json', 
          value: 'local',
          short: 'Local'
        }
      ],
      default: 'user'
    }]);

    return scopeChoice.scope;
  }

  /**
   * Show enhanced status with categorization
   */
  async showEnhancedStatus(categories) {
    console.log(chalk.blue('📊 Hook Installation Status'));
    console.log();

    if (categories.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed.'));
      console.log(chalk.cyan('Run interactive installation to get started!'));
      return;
    }

    // Show installed hooks by category
    const installedByCategory = {
      agentMCP: categories.installed.filter(h => categories.agentMCP.includes(h)),
      thinking: categories.installed.filter(h => categories.thinking.includes(h)),
      automation: categories.installed.filter(h => categories.automation.includes(h)),
      utility: categories.installed.filter(h => categories.utility.includes(h))
    };

    for (const [categoryName, hooks] of Object.entries(installedByCategory)) {
      if (hooks.length > 0) {
        const categoryIcons = {
          agentMCP: '🤖',
          thinking: '🧠', 
          automation: '⚙️',
          utility: '🔧'
        };
        
        console.log(chalk.cyan(`${categoryIcons[categoryName]} ${categoryName.toUpperCase()} (${hooks.length} hooks):`));
        hooks.forEach(hook => {
          console.log(chalk.green(`  ✅ ${hook.name}`), chalk.gray(`- ${hook.description}`));
        });
        console.log();
      }
    }

    // Show available for installation
    if (categories.uninstalled.length > 0) {
      console.log(chalk.gray(`📋 Available for installation: ${categories.uninstalled.length} hooks`));
      console.log(chalk.cyan('Run `rapala install` to add more hooks.'));
    }
  }

  /**
   * Manage existing hooks
   */
  async manageExistingHooks(installedHooks) {
    console.log(chalk.blue('🔧 Manage Existing Hooks'));
    console.log();
    console.log(chalk.gray('Hook management features coming soon...'));
  }

  /**
   * Interactive uninstallation
   */
  async interactiveUninstall(installedHooks) {
    console.log(chalk.blue('❌ Uninstall Hooks'));
    console.log();
    console.log(chalk.gray('Uninstallation features coming soon...'));
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
      const hookConfig = await this.loadHookConfig(hook.name);

      // Check if this is a permission-based hook
      if (hookConfig.installationType === 'permissions') {
        await this.installPermissionHook(hook, scope);
        return;
      }

      // Generate absolute path to hook script
      const hookScriptPath = path.resolve(this.hooksDir, hook.name, 'index.js');

      // Special handling for extended-thinking hook (multiple events)
      if (hook.name === 'extended-thinking') {
        const multiEventConfig = {
          matcher: hook.matcher || '',
          hooks: [
            {
              type: 'command',
              command: `node "${hookScriptPath}"`,
              timeout: hook.timeout || 30
            }
          ]
        };

        // Register for multiple events
        const events = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse'];
        for (const eventType of events) {
          await this.configManager.addHook(eventType, multiEventConfig, scope);
        }
      } else {
        // Single event handling for other hooks
        let eventType = 'PostToolUse'; // Default
        if (hook.name === 'notification') {
          eventType = 'Notification';
        } else if (hook.name === 'subagent-controller') {
          eventType = 'PreToolUse';
        } else if (hook.name === 'task-blocker') {
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
      }

      if (hook.name === 'extended-thinking') {
        console.log(chalk.green(`  ✅ ${hook.name} installed successfully`));
        console.log(chalk.gray('    Events: UserPromptSubmit, PreToolUse, PostToolUse'));
        console.log(chalk.gray(`    Matcher: ${hook.matcher || '(all)'}`));
        console.log(chalk.gray(`    Command: node "${hookScriptPath}"`));
      }

    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to install ${hook.name}: ${error.message}`));
    }
  }

  async installPermissionHook(hook, scope) {
    try {
      // For task-blocker, add Task tool to deny list
      if (hook.name === 'task-blocker') {
        await this.configManager.addPermissionDeny('Task', scope);
        console.log(chalk.green(`  ✅ ${hook.name} installed successfully`));
        console.log(chalk.gray('    Type: Permission Deny'));
        console.log(chalk.gray('    Blocks: Task tool'));
        console.log(chalk.gray(`    Scope: ${scope}`));
      }
    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to install permission hook ${hook.name}: ${error.message}`));
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
        // Check if it's a permission-based hook
        if (hookName === 'task-blocker') {
          await this.configManager.removePermissionDeny('Task', scope);
          console.log(chalk.green(`  ✅ ${hookName} uninstalled successfully (removed Task permission deny)`));
        } else {
          await this.configManager.removeHook(hookName, scope);
          console.log(chalk.green(`  ✅ ${hookName} uninstalled successfully`));
        }
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
