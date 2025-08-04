const chalk = require('chalk');
const inquirer = require('inquirer');
const Installer = require('./installer');
const ConfigManager = require('./config');

/**
 * Agent-MCP Hook Manager
 * Specialized manager for Agent-MCP collaboration hooks
 */
class AgentMCPManager {
  constructor() {
    this.installer = new Installer();
    this.configManager = new ConfigManager();
    
    // Define Agent-MCP hook ecosystem
    this.agentMCPHooks = {
      'git-agentmcp': {
        name: 'git-agentmcp',
        description: 'Multi-agent git integration with session tracking',
        tags: ['git', 'agent-tracking', 'collaboration', 'core'],
        required: true, // Core component
        events: ['PostToolUse'],
        matcher: 'Edit|Write|MultiEdit'
      },
      'agent-registry': {
        name: 'agent-registry', 
        description: 'Agent session registry for tracking active agents',
        tags: ['registry', 'session-management', 'tracking'],
        required: false,
        events: ['SessionStart', 'UserPromptSubmit'],
        matcher: ''
      },
      'file-locking': {
        name: 'file-locking',
        description: 'File-level locking for multi-agent collaboration',
        tags: ['locking', 'conflict-prevention', 'coordination'],
        required: false,
        events: ['PreToolUse', 'PostToolUse'],
        matcher: 'Edit|Write|MultiEdit'
      },
      'task-blocker': {
        name: 'task-blocker',
        description: 'Task management and workflow coordination',
        tags: ['task-management', 'workflow', 'coordination'],
        required: false,
        events: ['UserPromptSubmit', 'PreToolUse'],
        matcher: ''
      }
    };
  }

  /**
   * Show Agent-MCP ecosystem status
   */
  async showStatus() {
    console.log(chalk.blue('🤖 Agent-MCP Ecosystem Status'));
    console.log();

    // Check installation status for each hook
    const status = await this.configManager.getInstallationStatus();
    const allHooks = [...status.user, ...status.project, ...status.local];

    console.log(chalk.cyan('📋 Agent-MCP Hooks:'));
    console.log();

    for (const [hookId, hookInfo] of Object.entries(this.agentMCPHooks)) {
      const installed = allHooks.find(h => h.name === hookId);
      const icon = installed ? '✅' : '❌';
      const statusText = installed ? chalk.green('INSTALLED') : chalk.red('NOT INSTALLED');
      const requiredText = hookInfo.required ? chalk.yellow('(REQUIRED)') : chalk.gray('(OPTIONAL)');
      
      console.log(`${icon} ${chalk.bold(hookInfo.name)} ${statusText} ${requiredText}`);
      console.log(`   ${chalk.gray(hookInfo.description)}`);
      console.log(`   ${chalk.gray('Events:')} ${hookInfo.events.join(', ')}`);
      if (hookInfo.matcher) {
        console.log(`   ${chalk.gray('Matcher:')} ${hookInfo.matcher}`);
      }
      console.log();
    }

    // Show coordination status
    await this.showCoordinationStatus();
  }

  /**
   * Show hook coordination status
   */
  async showCoordinationStatus() {
    console.log(chalk.cyan('🔧 Coordination Status:'));
    console.log();

    try {
      const HookCoordination = require('../hooks/extended-thinking/coordination');
      const coord = new HookCoordination(process.cwd());
      const stats = coord.getStats();

      console.log(`📊 Active coordination locks: ${stats.activeLocks}`);
      if (stats.activeLocks > 0) {
        console.log(chalk.gray('   Current operations being coordinated:'));
        stats.lockFiles.forEach(lock => {
          if (lock.valid && lock.data) {
            console.log(chalk.gray(`   • ${lock.data.hookName} (${lock.data.eventType})`));
          }
        });
      }
      console.log();
    } catch (error) {
      console.log(chalk.gray('   Coordination system: Not available'));
      console.log();
    }
  }

  /**
   * Interactive Agent-MCP setup with TUI
   */
  async interactiveSetup(options = {}) {
    console.log(chalk.blue('🚀 Interactive Agent-MCP Setup'));
    console.log(chalk.gray('Configure your multi-agent collaboration environment'));
    console.log();

    // Check current status
    const status = await this.configManager.getInstallationStatus();
    const allHooks = [...status.user, ...status.project, ...status.local];
    const installedHooks = Object.keys(this.agentMCPHooks).filter(hookId => 
      allHooks.find(h => h.name === hookId)
    );

    // Main menu
    const mainChoice = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📦 Install Agent-MCP Hooks', value: 'install' },
        { name: '📊 Show Current Status', value: 'status' },
        { name: '🔧 Configure Existing Hooks', value: 'configure' },
        { name: '❌ Uninstall Hooks', value: 'uninstall' },
        { name: '🚪 Exit', value: 'exit' }
      ]
    }]);

    switch (mainChoice.action) {
      case 'install':
        await this.interactiveInstall(options, installedHooks);
        break;
      case 'status':
        await this.showStatus();
        break;
      case 'configure':
        await this.interactiveConfigure(installedHooks);
        break;
      case 'uninstall':
        await this.interactiveUninstall(installedHooks);
        break;
      case 'exit':
        console.log(chalk.green('👋 Agent-MCP setup complete!'));
        break;
    }
  }

  /**
   * Interactive installation with better TUI
   */
  async interactiveInstall(options = {}, currentlyInstalled = []) {
    console.log(chalk.blue('📦 Agent-MCP Hook Installation'));
    console.log();

    // Show overview
    const uninstalled = Object.keys(this.agentMCPHooks).filter(hookId => 
      !currentlyInstalled.includes(hookId)
    );

    if (uninstalled.length === 0) {
      console.log(chalk.green('✅ All Agent-MCP hooks are already installed!'));
      return;
    }

    // Installation scope
    const scope = await this.selectInstallationScope(options);

    // Hook selection with rich display
    const choices = uninstalled.map(hookId => {
      const hook = this.agentMCPHooks[hookId];
      const requiredText = hook.required ? chalk.red('[REQUIRED]') : chalk.gray('[OPTIONAL]');
      const name = `${hook.name} ${requiredText}\n    ${chalk.gray(hook.description)}`;
      return {
        name,
        value: hookId,
        checked: hook.required // Auto-select required hooks
      };
    });

    choices.push(new inquirer.Separator());
    choices.push({ name: chalk.cyan('📦 Install All Remaining'), value: 'all' });

    const selection = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hooks',
      message: 'Select Agent-MCP hooks to install:',
      choices,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one hook to install.';
        }
        return true;
      }
    }]);

    // Install selected hooks
    const hooksToInstall = selection.hooks.includes('all') ? 
      uninstalled : selection.hooks;

    await this.installHooks(hooksToInstall, { ...options, [scope]: true });
  }

  /**
   * Select installation scope with user guidance
   */
  async selectInstallationScope(options = {}) {
    // If scope already specified, use it
    if (options.user) return 'user';
    if (options.project) return 'project';
    if (options.local) return 'local';

    const scopeChoice = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Installation scope:',
      choices: [
        { 
          name: '👤 User Level - Apply to all Claude Code usage', 
          value: 'user',
          short: 'User'
        },
        { 
          name: '📁 Project Level - Apply to this project only', 
          value: 'project',
          short: 'Project' 
        },
        { 
          name: '🔒 Local Level - Apply to this directory only', 
          value: 'local',
          short: 'Local'
        }
      ],
      default: 'user'
    }]);

    return scopeChoice.scope;
  }

  /**
   * Install Agent-MCP hooks
   */
  async installHooks(hooks, options = {}) {
    console.log(chalk.blue('🔧 Installing Agent-MCP Hooks...'));
    console.log();

    // Handle 'all' keyword
    if (hooks.includes('all')) {
      hooks = Object.keys(this.agentMCPHooks);
    }

    // Validate hook names
    const validHooks = hooks.filter(hookId => this.agentMCPHooks[hookId]);
    const invalidHooks = hooks.filter(hookId => !this.agentMCPHooks[hookId]);

    if (invalidHooks.length > 0) {
      console.log(chalk.yellow(`⚠️  Unknown hooks: ${invalidHooks.join(', ')}`));
      console.log(chalk.cyan(`Available: ${Object.keys(this.agentMCPHooks).join(', ')}`));
    }

    if (validHooks.length === 0) {
      console.log(chalk.red('❌ No valid hooks to install.'));
      return;
    }

    // Install each hook
    for (const hookId of validHooks) {
      const hookInfo = this.agentMCPHooks[hookId];
      console.log(chalk.cyan(`📦 Installing ${hookInfo.name}...`));
      console.log(chalk.gray(`   ${hookInfo.description}`));

      try {
        await this.installer.installHooks([hookId], options);
        console.log(chalk.green(`✅ ${hookInfo.name} installed successfully`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to install ${hookInfo.name}: ${error.message}`));
      }
      console.log();
    }

    console.log(chalk.green('🎉 Agent-MCP installation complete!'));
    console.log();
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray('• Use Claude Code as normal - hooks will activate automatically'));
    console.log(chalk.gray('• Check status: rins_hooks agentmcp --status')); 
    console.log(chalk.gray('• View coordination: rins_hooks agentmcp'));
  }

  /**
   * Interactive configuration
   */
  async interactiveConfigure(installedHooks) {
    if (installedHooks.length === 0) {
      console.log(chalk.yellow('⚠️  No Agent-MCP hooks installed to configure.'));
      return;
    }

    console.log(chalk.blue('🔧 Configure Agent-MCP Hooks'));
    console.log();

    // Implementation for hook configuration
    console.log(chalk.gray('Configuration options coming soon...'));
  }

  /**
   * Interactive uninstallation
   */
  async interactiveUninstall(installedHooks) {
    if (installedHooks.length === 0) {
      console.log(chalk.yellow('⚠️  No Agent-MCP hooks installed to uninstall.'));
      return;
    }

    console.log(chalk.blue('❌ Uninstall Agent-MCP Hooks'));
    console.log();

    // Implementation for hook uninstallation
    console.log(chalk.gray('Uninstallation options coming soon...'));
  }
}

module.exports = AgentMCPManager;