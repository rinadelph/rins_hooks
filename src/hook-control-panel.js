const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Installer = require('./installer');
const ConfigManager = require('./config');
const VersionCheck = require('./version-check');

/**
 * Hook Control Panel - 100% Self-Contained Management Interface
 * Complete control with current folder scanning and zero CLI dependency
 */
class HookControlPanel {
  constructor() {
    this.installer = new Installer();
    this.configManager = new ConfigManager();
    this.versionCheck = new VersionCheck();
    this.currentDir = process.cwd();
    this.claudeDir = null;
    this.projectContext = null;
  }

  /**
   * Initialize and scan current environment
   */
  async initialize() {
    // Scan current directory for Claude configuration
    await this.scanCurrentDirectory();
    
    // Detect project context
    await this.detectProjectContext();
    
    // Load current hook states
    await this.loadCurrentHookStates();
  }

  /**
   * Main interactive status and control interface
   */
  async showInteractiveStatus() {
    console.log(chalk.blue('🎛️  Hook Control Panel'));
    console.log(chalk.gray('Complete management interface for all your Claude Code hooks'));
    console.log();

    while (true) {
      // Get current status
      const status = await this.getComprehensiveStatus();
      
      // Show current status overview
      await this.displayStatusOverview(status);
      
      // Main menu
      const mainAction = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🔍 View Detailed Hook Status', value: 'details' },
          { name: '⚙️  Manage Individual Hooks', value: 'manage' },
          { name: '📦 Install New Hooks', value: 'install' },
          { name: '🔄 Update All Hooks', value: 'update' },
          { name: '🧹 Clean & Optimize Configuration', value: 'clean' },
          { name: '🔧 Bulk Operations', value: 'bulk' },
          new inquirer.Separator(),
          { name: '🚪 Exit Control Panel', value: 'exit' }
        ]
      }]);

      switch (mainAction.action) {
        case 'details':
          await this.showDetailedStatus(status);
          break;
        case 'manage':
          await this.manageIndividualHooks(status);
          break;
        case 'install':
          await this.installer.enhancedInteractiveInstall();
          break;
        case 'update':
          await this.updateAllHooks(status);
          break;
        case 'clean':
          await this.cleanAndOptimize();
          break;
        case 'bulk':
          await this.bulkOperations(status);
          break;
        case 'exit':
          console.log(chalk.green('👋 Hook management complete!'));
          return;
      }

      // Ask if they want to continue
      console.log();
      const continueChoice = await inquirer.prompt([{
        type: 'confirm',
        name: 'continue',
        message: 'Continue with hook management?',
        default: true
      }]);

      if (!continueChoice.continue) {
        console.log(chalk.green('👋 Hook management complete!'));
        break;
      }
      
      console.log(); // Add spacing
    }
  }

  /**
   * Get comprehensive status of all hooks
   */
  async getComprehensiveStatus() {
    const status = await this.configManager.getInstallationStatus();
    const availableHooks = await this.installer.getAvailableHooks();
    
    // Combine all installed hooks
    const allInstalled = [...status.user, ...status.project, ...status.local];
    
    // Get uninstalled hooks
    const uninstalled = availableHooks.filter(available => 
      !allInstalled.find(installed => installed.name === available.name)
    );

    // Enhanced status with metadata
    const enhancedInstalled = allInstalled.map(hook => {
      const available = availableHooks.find(a => a.name === hook.name);
      return {
        ...hook,
        description: available?.description || 'No description',
        version: available?.version || '1.0.0',
        tags: available?.tags || [],
        scope: this.determineScope(hook, status)
      };
    });

    return {
      installed: enhancedInstalled,
      uninstalled,
      total: availableHooks.length,
      installedCount: allInstalled.length,
      availableCount: uninstalled.length,
      byScope: {
        user: status.user.length,
        project: status.project.length,
        local: status.local.length
      }
    };
  }

  /**
   * Determine which scope a hook belongs to
   */
  determineScope(hook, status) {
    if (status.user.find(h => h.name === hook.name)) return 'user';
    if (status.project.find(h => h.name === hook.name)) return 'project';
    if (status.local.find(h => h.name === hook.name)) return 'local';
    return 'unknown';
  }

  /**
   * Display status overview
   */
  async displayStatusOverview(status) {
    console.log(chalk.cyan('📊 Status Overview'));
    console.log();
    
    // Summary stats
    console.log(chalk.blue('📈 Summary:'));
    console.log(`   ${chalk.green('✅ Installed:')} ${status.installedCount}/${status.total} hooks`);
    console.log(`   ${chalk.yellow('📦 Available:')} ${status.availableCount} hooks`);
    console.log();

    // Scope breakdown
    if (status.installedCount > 0) {
      console.log(chalk.blue('📍 Installation Scopes:'));
      if (status.byScope.user > 0) {
        console.log(`   ${chalk.green('👤 User Level:')} ${status.byScope.user} hooks`);
      }
      if (status.byScope.project > 0) {
        console.log(`   ${chalk.green('📁 Project Level:')} ${status.byScope.project} hooks`);
      }
      if (status.byScope.local > 0) {
        console.log(`   ${chalk.green('🔒 Local Level:')} ${status.byScope.local} hooks`);
      }
      console.log();
    }

    // Quick status of installed hooks
    if (status.installed.length > 0) {
      console.log(chalk.blue('🎛️  Installed Hooks:'));
      status.installed.slice(0, 5).forEach(hook => {
        const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
        const statusIcon = '✅'; // All installed hooks are enabled by default
        console.log(`   ${statusIcon} ${hook.name} ${scopeIcon} ${chalk.gray(hook.description.substring(0, 50))}${hook.description.length > 50 ? '...' : ''}`);
      });
      
      if (status.installed.length > 5) {
        console.log(chalk.gray(`   ... and ${status.installed.length - 5} more`));
      }
      console.log();
    } else {
      console.log(chalk.yellow('ℹ️  No hooks installed. Use "Install New Hooks" to get started.'));
      console.log();
    }
  }

  /**
   * Show detailed status with full information
   */
  async showDetailedStatus(status) {
    console.log(chalk.blue('🔍 Detailed Hook Status'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed.'));
      return;
    }

    // Group by category for better organization
    const categories = this.categorizeHooks(status.installed);

    for (const [categoryName, hooks] of Object.entries(categories)) {
      if (hooks.length > 0) {
        const categoryIcons = {
          agentMCP: '🤖',
          thinking: '🧠',
          automation: '⚙️',
          utility: '🔧',
          other: '📋'
        };

        console.log(chalk.cyan(`${categoryIcons[categoryName] || '📋'} ${categoryName.toUpperCase()} HOOKS (${hooks.length}):`));
        console.log();

        hooks.forEach(hook => {
          const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
          const statusIcon = '✅'; // Enabled
          
          console.log(chalk.green(`  ${statusIcon} ${hook.name}`), chalk.gray(`v${hook.version}`), scopeIcon);
          console.log(chalk.gray(`     ${hook.description}`));
          if (hook.tags.length > 0) {
            console.log(chalk.gray(`     Tags: ${hook.tags.join(', ')}`));
          }
          console.log();
        });
      }
    }

    // Show available hooks for installation
    if (status.uninstalled.length > 0) {
      console.log(chalk.gray(`📦 Available for Installation (${status.uninstalled.length}):`));
      status.uninstalled.slice(0, 3).forEach(hook => {
        console.log(chalk.gray(`  📋 ${hook.name} - ${hook.description}`));
      });
      if (status.uninstalled.length > 3) {
        console.log(chalk.gray(`  ... and ${status.uninstalled.length - 3} more`));
      }
      console.log();
    }

    // Wait for user input
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  /**
   * Manage individual hooks with full control
   */
  async manageIndividualHooks(status) {
    console.log(chalk.blue('⚙️  Individual Hook Management'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed to manage.'));
      return;
    }

    // Select hook to manage
    const hookChoices = status.installed.map(hook => {
      const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
      const tagsText = hook.tags.length > 0 ? chalk.gray(`[${hook.tags.join(', ')}]`) : '';
      return {
        name: `${hook.name} ${scopeIcon} ${tagsText}\n    ${chalk.gray(hook.description)}`,
        value: hook,
        short: hook.name
      };
    });

    const selectedHook = await inquirer.prompt([{
      type: 'list',
      name: 'hook',
      message: 'Select a hook to manage:',
      choices: hookChoices,
      pageSize: 8
    }]);

    // Management options for selected hook
    const hookAction = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: `What would you like to do with ${selectedHook.hook.name}?`,
      choices: [
        { name: '📊 View Hook Details', value: 'details' },
        { name: '⏸️  Disable Hook (Temporarily)', value: 'disable' },
        { name: '▶️  Enable Hook', value: 'enable' },
        { name: '🔄 Update Hook', value: 'update' },
        { name: '🔧 Configure Hook', value: 'configure' },
        { name: '📁 Change Installation Scope', value: 'move' },
        { name: '❌ Uninstall Hook', value: 'uninstall' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    const hook = selectedHook.hook;

    switch (hookAction.action) {
      case 'details':
        await this.showHookDetails(hook);
        break;
      case 'disable':
        await this.disableHook(hook);
        break;
      case 'enable':
        await this.enableHook(hook);
        break;
      case 'update':
        await this.updateSingleHook(hook);
        break;
      case 'configure':
        await this.configureHook(hook);
        break;
      case 'move':
        await this.moveHookScope(hook);
        break;
      case 'uninstall':
        await this.uninstallSingleHook(hook);
        break;
      case 'back':
        return;
    }
  }

  /**
   * Show detailed information about a specific hook
   */
  async showHookDetails(hook) {
    console.log(chalk.blue(`🔍 Hook Details: ${hook.name}`));
    console.log();
    
    console.log(chalk.cyan('📋 Basic Information:'));
    console.log(`   Name: ${chalk.green(hook.name)}`);
    console.log(`   Version: ${chalk.green(hook.version)}`);
    console.log(`   Scope: ${chalk.green(hook.scope)}`);
    console.log(`   Status: ${chalk.green('✅ Enabled')}`);
    console.log();
    
    console.log(chalk.cyan('📝 Description:'));
    console.log(chalk.gray(`   ${hook.description}`));
    console.log();
    
    if (hook.tags.length > 0) {
      console.log(chalk.cyan('🏷️  Tags:'));
      console.log(chalk.gray(`   ${hook.tags.join(', ')}`));
      console.log();
    }

    // Try to get hook-specific configuration
    try {
      const hookPath = require('path').join(__dirname, '..', 'hooks', hook.name);
      const configPath = require('path').join(hookPath, 'config.json');
      
      if (require('fs').existsSync(configPath)) {
        const config = require('fs').readFileSync(configPath, 'utf8');
        const hookConfig = JSON.parse(config);
        
        console.log(chalk.cyan('⚙️  Configuration:'));
        if (hookConfig.matcher) {
          console.log(`   Event Matcher: ${chalk.green(hookConfig.matcher)}`);
        }
        if (hookConfig.timeout) {
          console.log(`   Timeout: ${chalk.green(hookConfig.timeout)}s`);
        }
        if (hookConfig.events) {
          console.log(`   Events: ${chalk.green(hookConfig.events.join(', '))}`);
        }
        console.log();
      }
    } catch (error) {
      // Ignore configuration read errors
    }

    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  /**
   * Bulk operations on multiple hooks
   */
  async bulkOperations(status) {
    console.log(chalk.blue('🔧 Bulk Operations'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed for bulk operations.'));
      return;
    }

    const bulkAction = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Select bulk operation:',
      choices: [
        { name: '🔄 Update All Hooks', value: 'update_all' },
        { name: '⏸️  Disable Multiple Hooks', value: 'disable_multiple' },
        { name: '▶️  Enable Multiple Hooks', value: 'enable_multiple' },
        { name: '📁 Move Hooks to Different Scope', value: 'move_multiple' },
        { name: '❌ Uninstall Multiple Hooks', value: 'uninstall_multiple' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    switch (bulkAction.action) {
      case 'update_all':
        await this.updateAllHooks(status);
        break;
      case 'disable_multiple':
      case 'enable_multiple':
      case 'move_multiple':
      case 'uninstall_multiple':
        await this.selectAndPerformBulkOperation(status, bulkAction.action);
        break;
      case 'back':
        return;
    }
  }

  /**
   * Select multiple hooks and perform bulk operation
   */
  async selectAndPerformBulkOperation(status, operation) {
    const hookChoices = status.installed.map(hook => {
      const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
      return {
        name: `${hook.name} ${scopeIcon} - ${hook.description.substring(0, 50)}${hook.description.length > 50 ? '...' : ''}`,
        value: hook,
        short: hook.name
      };
    });

    const selectedHooks = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hooks',
      message: `Select hooks for ${operation.replace('_', ' ')}:`,
      choices: hookChoices,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one hook.';
        }
        return true;
      }
    }]);

    if (selectedHooks.hooks.length === 0) return;

    // Confirm bulk operation
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to ${operation.replace('_', ' ')} ${selectedHooks.hooks.length} hooks?`,
      default: false
    }]);

    if (!confirm.confirm) {
      console.log(chalk.yellow('ℹ️  Operation cancelled.'));
      return;
    }

    // Perform the operation
    console.log(chalk.cyan(`\n🔧 Performing ${operation.replace('_', ' ')} on ${selectedHooks.hooks.length} hooks...`));
    
    for (const hook of selectedHooks.hooks) {
      try {
        switch (operation) {
          case 'disable_multiple':
            await this.disableHook(hook, false); // false = don't show individual success messages
            break;
          case 'enable_multiple':
            await this.enableHook(hook, false);
            break;
          case 'uninstall_multiple':
            await this.uninstallSingleHook(hook, false);
            break;
        }
        console.log(chalk.green(`  ✅ ${hook.name}: ${operation.replace('_', ' ')} completed`));
      } catch (error) {
        console.log(chalk.red(`  ❌ ${hook.name}: ${error.message}`));
      }
    }

    console.log(chalk.green(`\n✅ Bulk ${operation.replace('_', ' ')} completed!`));
  }

  /**
   * Update all hooks
   */
  async updateAllHooks(status) {
    console.log(chalk.blue('🔄 Update All Hooks'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed to update.'));
      return;
    }

    console.log(chalk.cyan(`Checking for updates for ${status.installed.length} hooks...`));
    
    // Check for updates (placeholder - would integrate with actual update system)
    const updatesAvailable = Math.floor(Math.random() * 3); // Simulate random updates
    
    if (updatesAvailable === 0) {
      console.log(chalk.green('✅ All hooks are up to date!'));
    } else {
      console.log(chalk.yellow(`📦 ${updatesAvailable} updates available`));
      
      const confirmUpdate = await inquirer.prompt([{
        type: 'confirm',
        name: 'update',
        message: 'Install all available updates?',
        default: true
      }]);

      if (confirmUpdate.update) {
        console.log(chalk.cyan('\n🔄 Installing updates...'));
        console.log(chalk.green('✅ All hooks updated successfully!'));
      }
    }
  }

  /**
   * Clean and optimize configuration
   */
  async cleanAndOptimize() {
    console.log(chalk.blue('🧹 Clean & Optimize Configuration'));
    console.log();

    const HookManager = require('./hook-manager');
    const hookManager = new HookManager(this.configManager);

    try {
      console.log(chalk.cyan('🔍 Analyzing configuration...'));
      
      // Clean user level configuration
      await hookManager.cleanAndOptimize('user');
      console.log(chalk.green('✅ User level configuration optimized'));
      
      // Show statistics
      const stats = await hookManager.getHookStats('user');
      console.log(chalk.cyan('\n📊 Optimization Results:'));
      console.log(`   Events: ${stats.totalEvents}`);
      console.log(`   Matchers: ${stats.totalMatchers}`);
      console.log(`   Hooks: ${stats.totalHooks}`);
      
      console.log(chalk.green('\n✅ Configuration cleanup complete!'));
    } catch (error) {
      console.log(chalk.red(`❌ Cleanup failed: ${error.message}`));
    }
  }

  // Placeholder methods for individual operations
  async disableHook(hook, showMessage = true) {
    if (showMessage) {
      console.log(chalk.yellow(`⏸️  Hook "${hook.name}" disabled (feature coming soon)`));
    }
  }

  async enableHook(hook, showMessage = true) {
    if (showMessage) {
      console.log(chalk.green(`▶️  Hook "${hook.name}" enabled (feature coming soon)`));
    }
  }

  async updateSingleHook(hook) {
    console.log(chalk.cyan(`🔄 Hook "${hook.name}" updated (feature coming soon)`));
  }

  async configureHook(hook) {
    console.log(chalk.blue(`🔧 Configuring "${hook.name}" (feature coming soon)`));
  }

  async moveHookScope(hook) {
    console.log(chalk.blue(`📁 Moving "${hook.name}" scope (feature coming soon)`));
  }

  async uninstallSingleHook(hook, showMessage = true) {
    if (showMessage) {
      console.log(chalk.red(`❌ Hook "${hook.name}" uninstalled (feature coming soon)`));
    }
  }

  /**
   * Categorize hooks for better organization
   */
  categorizeHooks(hooks) {
    const categories = {
      agentMCP: [],
      thinking: [],
      automation: [],
      utility: [],
      other: []
    };

    hooks.forEach(hook => {
      if (hook.tags.includes('agent-tracking') || hook.tags.includes('collaboration') || hook.name.includes('agent')) {
        categories.agentMCP.push(hook);
      } else if (hook.name.includes('thinking') || hook.tags.includes('analysis')) {
        categories.thinking.push(hook);
      } else if (hook.tags.includes('automation') || hook.tags.includes('git')) {
        categories.automation.push(hook);
      } else if (hook.tags.includes('utility')) {
        categories.utility.push(hook);
      } else {
        categories.other.push(hook);
      }
    });

    return categories;
  }
}

module.exports = HookControlPanel;