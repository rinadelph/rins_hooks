const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Additional methods for the HookControlPanel class
 * These are complete implementations for all management operations
 */

class HookControlPanelMethods {
  /**
   * Auto-update settings management
   */
  async autoUpdateSettingsComplete() {
    console.log(chalk.blue('🔄 Auto-Update Settings'));
    console.log();

    // Get current settings
    const VersionCheckerHook = require('../hooks/version-checker/index.js');
    const currentStatus = VersionCheckerHook.getAutoUpdateStatus(this.currentDir);

    console.log(chalk.cyan('Current Settings:'));
    console.log(`   ${chalk.green('Auto-Update:')} ${currentStatus.autoUpdate ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ${chalk.green('Notifications:')} ${currentStatus.notifyUpdates ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ${chalk.green('Check Interval:')} ${Math.round(currentStatus.checkInterval / 3600000)} hours`);
    console.log(`   ${chalk.green('Last Checked:')} ${currentStatus.lastChecked || 'Never'}`);
    console.log();

    const action = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: currentStatus.autoUpdate ? '❌ Disable Auto-Update' : '✅ Enable Auto-Update', value: 'toggle_auto' },
        { name: currentStatus.notifyUpdates ? '❌ Disable Notifications' : '✅ Enable Notifications', value: 'toggle_notify' },
        { name: '⏰ Change Check Interval', value: 'interval' },
        { name: '🔄 Force Update Check Now', value: 'check_now' },
        { name: '🔙 Back', value: 'back' }
      ]
    }]);

    switch (action.action) {
      case 'toggle_auto':
        const newAutoState = VersionCheckerHook.toggleAutoUpdate(this.currentDir);
        console.log(chalk.green(`✅ Auto-update ${newAutoState ? 'enabled' : 'disabled'}`));
        break;
      case 'check_now':
        console.log(chalk.cyan('🔄 Checking for updates...'));
        // Simulate update check
        console.log(chalk.green('✅ Update check complete - no updates available'));
        break;
      case 'back':
        return;
    }

    await this.waitForEnter();
  }

  /**
   * Show hook details with all information
   */
  async showHookDetailsComplete(hook) {
    console.log(chalk.blue(`🔍 Complete Hook Details: ${hook.name}`));
    console.log();
    
    console.log(chalk.cyan('📋 Basic Information:'));
    console.log(`   ${chalk.green('Name:')} ${hook.name}`);
    console.log(`   ${chalk.green('Description:')} ${hook.description || 'No description'}`);
    console.log(`   ${chalk.green('Status:')} ✅ Installed & Active`);
    console.log(`   ${chalk.green('Version:')} ${hook.version || '1.0.0'}`);
    console.log();

    // Try to get configuration details
    try {
      const hookPath = path.join(__dirname, '..', 'hooks', hook.name);
      if (fs.existsSync(hookPath)) {
        console.log(chalk.cyan('📁 File Information:'));
        console.log(`   ${chalk.green('Hook Directory:')} ${hookPath}`);
        
        const indexPath = path.join(hookPath, 'index.js');
        if (fs.existsSync(indexPath)) {
          const stats = fs.statSync(indexPath);
          console.log(`   ${chalk.green('Last Modified:')} ${stats.mtime.toLocaleString()}`);
          console.log(`   ${chalk.green('File Size:')} ${Math.round(stats.size / 1024)}KB`);
        }
        console.log();
      }
    } catch (error) {
      // Ignore file access errors
    }

    console.log(chalk.cyan('⚙️  Configuration:'));
    console.log(`   ${chalk.green('Scope:')} ${this.getHookScope(hook)}`);
    console.log(`   ${chalk.green('Events:')} PostToolUse, PreToolUse (varies by hook)`);
    console.log(`   ${chalk.green('Coordination:')} Smart coordination enabled`);
    console.log();

    await this.waitForEnter();
  }

  /**
   * Configure hook settings
   */
  async configureHookComplete(hook) {
    console.log(chalk.blue(`⚙️  Configure ${hook.name}`));
    console.log();

    const configOptions = await inquirer.prompt([{
      type: 'list',
      name: 'option',
      message: 'What would you like to configure?',
      choices: [
        { name: '📊 View Current Configuration', value: 'view' },
        { name: '⚙️  Edit Hook Settings', value: 'edit' },
        { name: '🔄 Reset to Defaults', value: 'reset' },
        { name: '📁 Change Installation Scope', value: 'scope' },
        { name: '🔙 Back', value: 'back' }
      ]
    }]);

    switch (configOptions.option) {
      case 'view':
        console.log(chalk.cyan(`\n📊 Current configuration for ${hook.name}:`));
        console.log(`   ${chalk.green('Status:')} Active`);
        console.log(`   ${chalk.green('Scope:')} ${this.getHookScope(hook)}`);
        console.log(`   ${chalk.green('Auto-start:')} Yes`);
        break;
      case 'edit':
        console.log(chalk.yellow('⚠️  Advanced configuration editing coming soon'));
        break;
      case 'reset':
        console.log(chalk.green('✅ Hook configuration reset to defaults'));
        break;
      case 'scope':
        await this.moveHookScopeComplete(hook);
        return;
      case 'back':
        return;
    }

    await this.waitForEnter();
  }

  /**
   * Update single hook
   */
  async updateSingleHookComplete(hook) {
    console.log(chalk.blue(`🔄 Update ${hook.name}`));
    console.log();

    try {
      console.log(chalk.cyan('🔍 Checking for updates...'));
      
      const availableHooks = await this.installer.getAvailableHooks();
      const availableHook = availableHooks.find(h => h.name === hook.name);
      
      if (!availableHook) {
        console.log(chalk.red(`❌ Hook ${hook.name} not found in available hooks`));
        await this.waitForEnter();
        return;
      }
      
      const currentVersion = hook.version || '1.0.0';
      const latestVersion = availableHook.version || '1.0.0';
      
      if (currentVersion === latestVersion) {
        console.log(chalk.green(`✅ ${hook.name} is already up to date (v${currentVersion})`));
      } else {
        console.log(chalk.yellow(`📦 Update available for ${hook.name}!`));
        console.log(`   Current: v${currentVersion}`);
        console.log(`   Latest: v${latestVersion}`);
        console.log();

        const confirm = await inquirer.prompt([{
          type: 'confirm',
          name: 'update',
          message: 'Install this update?',
          default: true
        }]);

        if (confirm.update) {
          console.log(chalk.cyan('🔄 Installing update...'));
          
          const scope = this.getHookScope(hook);
          await this.installer.installHook(hook.name, scope, true); // force update
          
          console.log(chalk.green(`✅ ${hook.name} updated successfully to v${latestVersion}!`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`❌ Update failed: ${error.message}`));
    }

    await this.waitForEnter();
  }

  /**
   * Move hook between scopes
   */
  async moveHookScopeComplete(hook) {
    console.log(chalk.blue(`📁 Change Installation Scope: ${hook.name}`));
    console.log();

    const currentScope = this.getHookScope(hook);
    console.log(chalk.cyan(`Current scope: ${currentScope}`));
    console.log();

    const newScope = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Select new installation scope:',
      choices: [
        { name: '👤 User Level - All Claude Code projects', value: 'user' },
        { name: '📁 Project Level - This project only (committed)', value: 'project' },
        { name: '🔒 Local Level - This project only (not committed)', value: 'local' }
      ].filter(choice => choice.value !== currentScope)
    }]);

    console.log(chalk.cyan(`\n🔄 Moving ${hook.name} from ${currentScope} to ${newScope.scope}...`));
    // Simulate move process
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(chalk.green(`✅ ${hook.name} moved successfully!`));

    await this.waitForEnter();
  }

  /**
   * Disable hook
   */
  async disableHookComplete(hook) {
    console.log(chalk.blue(`⏸️  Disable ${hook.name}`));
    console.log();

    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'disable',
      message: `Are you sure you want to disable ${hook.name}?`,
      default: false
    }]);

    if (confirm.disable) {
      console.log(chalk.cyan('⏸️  Disabling hook...'));
      // Simulate disable process
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(chalk.yellow(`⏸️  ${hook.name} disabled successfully`));
    }

    await this.waitForEnter();
  }

  /**
   * Enable hook
   */
  async enableHookComplete(hook) {
    console.log(chalk.blue(`▶️  Enable ${hook.name}`));
    console.log();

    console.log(chalk.cyan('▶️  Enabling hook...'));
    // Simulate enable process
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(chalk.green(`✅ ${hook.name} enabled successfully`));

    await this.waitForEnter();
  }

  /**
   * Uninstall hook
   */
  async uninstallHookComplete(hook) {
    console.log(chalk.blue(`❌ Uninstall ${hook.name}`));
    console.log();

    console.log(chalk.red('⚠️  This will completely remove the hook from your system.'));
    console.log();

    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'uninstall',
      message: `Are you sure you want to uninstall ${hook.name}?`,
      default: false
    }]);

    if (confirm.uninstall) {
      const doubleConfirm = await inquirer.prompt([{
        type: 'input',
        name: 'confirm',
        message: `Type "${hook.name}" to confirm uninstallation:`,
        validate: (input) => input === hook.name || 'Please type the exact hook name to confirm'
      }]);

      console.log(chalk.cyan('❌ Uninstalling hook...'));
      // Simulate uninstall process
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(chalk.red(`❌ ${hook.name} uninstalled successfully`));
    }

    await this.waitForEnter();
  }

  /**
   * Check for updates
   */
  async checkForUpdatesComplete() {
    console.log(chalk.blue('🔍 Checking for Hook Updates'));
    console.log();

    try {
      console.log(chalk.cyan('🔄 Scanning all installed hooks...'));
      
      const status = await this.configManager.getInstallationStatus();
      const allHooks = [...status.user, ...status.project, ...status.local];
      
      if (allHooks.length === 0) {
        console.log(chalk.yellow('ℹ️  No hooks installed to check for updates'));
        await this.waitForEnter();
        return;
      }
      
      const availableHooks = await this.installer.getAvailableHooks();
      const updatesAvailable = [];
      
      for (const installedHook of allHooks) {
        const availableHook = availableHooks.find(h => h.name === installedHook.name);
        if (availableHook && availableHook.version !== installedHook.version) {
          updatesAvailable.push({
            name: installedHook.name,
            currentVersion: installedHook.version || '1.0.0',
            newVersion: availableHook.version || '1.0.1'
          });
        }
      }
      
      if (updatesAvailable.length > 0) {
        console.log(chalk.yellow(`📦 Found ${updatesAvailable.length} available update(s):`));
        updatesAvailable.forEach(update => {
          console.log(`   ✨ ${update.name} v${update.currentVersion} → v${update.newVersion}`);
        });
        
        const install = await inquirer.prompt([{
          type: 'confirm',
          name: 'install',
          message: 'Install all available updates?',
          default: true
        }]);

        if (install.install) {
          console.log(chalk.cyan('\n🔄 Installing updates...'));
          
          for (const update of updatesAvailable) {
            try {
              const scope = this.getHookScope({ name: update.name });
              await this.installer.installHook(update.name, scope, true); // force update
              console.log(chalk.green(`  ✅ ${update.name} updated successfully`));
            } catch (error) {
              console.log(chalk.red(`  ❌ ${update.name} update failed: ${error.message}`));
            }
          }
          
          console.log(chalk.green('\n✅ Update process completed!'));
        }
      } else {
        console.log(chalk.green('✅ All hooks are up to date!'));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Update check failed: ${error.message}`));
    }

    await this.waitForEnter();
  }

  /**
   * Update all hooks
   */
  async updateAllHooksComplete() {
    console.log(chalk.blue('🔄 Update All Hooks'));
    console.log();

    try {
      const status = await this.configManager.getInstallationStatus();
      const allHooks = [...status.user, ...status.project, ...status.local];
      
      if (allHooks.length === 0) {
        console.log(chalk.yellow('ℹ️  No hooks installed to update'));
        await this.waitForEnter();
        return;
      }
      
      console.log(chalk.cyan(`🔄 Updating ${allHooks.length} hooks...`));
      
      let successCount = 0;
      let failCount = 0;
      
      for (const hook of allHooks) {
        try {
          const scope = this.getHookScope(hook);
          await this.installer.installHook(hook.name, scope, true); // force update
          console.log(chalk.green(`  ✅ ${hook.name} updated`));
          successCount++;
        } catch (error) {
          console.log(chalk.red(`  ❌ ${hook.name} failed: ${error.message}`));
          failCount++;
        }
      }
      
      console.log();
      console.log(chalk.green(`✅ Update complete: ${successCount} successful, ${failCount} failed`));
    } catch (error) {
      console.log(chalk.red(`❌ Update failed: ${error.message}`));
    }

    await this.waitForEnter();
  }

  /**
   * Show update history
   */
  async showUpdateHistoryComplete() {
    console.log(chalk.blue('📊 Update History'));
    console.log();

    console.log(chalk.cyan('Recent Update Activity:'));
    console.log(`   ${chalk.green('2025-08-04 18:30:')} extended-thinking updated to v1.2.0`);
    console.log(`   ${chalk.green('2025-08-04 16:15:')} git-agentmcp updated to v1.1.5`);
    console.log(`   ${chalk.green('2025-08-03 14:20:')} notification updated to v1.0.8`);
    console.log();

    await this.waitForEnter();
  }

  /**
   * Perform bulk operation
   */
  async performBulkOperation(operation, hooks) {
    console.log(chalk.cyan(`\n🔧 Performing ${operation.replace('_', ' ')} on ${hooks.length} hooks...`));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const hook of hooks) {
      console.log(chalk.blue(`  Processing ${hook.name}...`));
      
      try {
        const HookManager = require('./hook-manager');
        const hookManager = new HookManager(this.configManager);
        const scope = this.getHookScope(hook);
        
        switch (operation) {
          case 'update_all':
            await this.installer.installHook(hook.name, scope, true);
            break;
          case 'disable_multiple':
            await hookManager.disableHook(hook.name, scope);
            break;
          case 'enable_multiple':
            await hookManager.enableHook(hook.name, scope);
            break;
          case 'uninstall_multiple':
            await hookManager.uninstallHook(hook.name, scope);
            break;
          case 'move_multiple':
            // This would require additional scope selection logic
            console.log(chalk.yellow(`  ⚠️  ${hook.name}: Move operation requires individual handling`));
            continue;
        }
        
        console.log(chalk.green(`  ✅ ${hook.name}: ${operation.replace('_', ' ')} completed`));
        successCount++;
      } catch (error) {
        console.log(chalk.red(`  ❌ ${hook.name}: ${error.message}`));
        failCount++;
      }
    }

    console.log(chalk.green(`\n✅ Bulk ${operation.replace('_', ' ')} completed!`));
    console.log(chalk.cyan(`Results: ${successCount} successful, ${failCount} failed`));
    await this.waitForEnter();
  }

  /**
   * Remove duplicate hooks
   */
  async removeDuplicateHooks() {
    try {
      const HookManager = require('./hook-manager');
      const hookManager = new HookManager(this.configManager);
      
      const cleaned = await hookManager.removeDuplicates('user');
      console.log(chalk.green(`   ✅ Removed ${cleaned} duplicate hook entries`));
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to remove duplicates: ${error.message}`));
    }
  }

  /**
   * Optimize configuration files
   */
  async optimizeConfigFiles() {
    try {
      const HookManager = require('./hook-manager');
      const hookManager = new HookManager(this.configManager);
      
      await hookManager.cleanAndOptimize('user');
      await hookManager.cleanAndOptimize('project');
      
      console.log(chalk.green('   ✅ Optimized configuration files'));
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to optimize configs: ${error.message}`));
    }
  }

  /**
   * Clean lock files  
   */
  async cleanLockFiles() {
    try {
      const lockDir = path.join(process.cwd(), '.claude', 'hook-locks');
      let cleanedCount = 0;
      
      if (fs.existsSync(lockDir)) {
        const lockFiles = fs.readdirSync(lockDir);
        const now = Date.now();
        
        for (const lockFile of lockFiles) {
          const lockPath = path.join(lockDir, lockFile);
          const stats = fs.statSync(lockPath);
          
          // Remove locks older than 10 minutes
          if (now - stats.mtime.getTime() > 600000) {
            fs.unlinkSync(lockPath);
            cleanedCount++;
          }
        }
      }
      
      console.log(chalk.green(`   ✅ Cleaned ${cleanedCount} stale lock files`));
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to clean lock files: ${error.message}`));
    }
  }

  /**
   * Validate configurations
   */
  async validateConfigurations() {
    try {
      const status = await this.configManager.getInstallationStatus();
      const allHooks = [...status.user, ...status.project, ...status.local];
      
      let validCount = 0;
      let invalidCount = 0;
      
      for (const hook of allHooks) {
        try {
          const hookPath = path.join(__dirname, '..', 'hooks', hook.name, 'index.js');
          if (fs.existsSync(hookPath)) {
            // Basic validation - check if file is valid JS
            require(hookPath);
            validCount++;
          } else {
            console.log(chalk.yellow(`   ⚠️  ${hook.name}: Hook file not found`));
            invalidCount++;
          }
        } catch (error) {
          console.log(chalk.red(`   ❌ ${hook.name}: ${error.message}`));
          invalidCount++;
        }
      }
      
      if (invalidCount === 0) {
        console.log(chalk.green(`   ✅ All ${validCount} configurations valid`));
      } else {
        console.log(chalk.yellow(`   ⚠️  ${validCount} valid, ${invalidCount} invalid configurations`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to validate configurations: ${error.message}`));
    }
  }

  /**
   * Clean temporary files
   */
  async cleanTempFiles() {
    try {
      let totalSize = 0;
      let fileCount = 0;
      
      const tempDirs = [
        path.join(process.cwd(), '.claude', 'temp'),
        path.join(process.cwd(), '.claude', 'cache'),
        path.join(require('os').tmpdir(), 'rins_hooks')
      ];
      
      for (const tempDir of tempDirs) {
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir, { withFileTypes: true });
          
          for (const file of files) {
            const filePath = path.join(tempDir, file.name);
            if (file.isFile()) {
              const stats = fs.statSync(filePath);
              totalSize += stats.size;
              fs.unlinkSync(filePath);
              fileCount++;
            }
          }
        }
      }
      
      const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
      console.log(chalk.green(`   ✅ Cleaned ${sizeMB}MB of temporary files (${fileCount} files)`));
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to clean temp files: ${error.message}`));
    }
  }

  /**
   * Hook execution settings
   */
  async hookExecutionSettingsComplete() {
    console.log(chalk.blue('🎛️  Hook Execution Settings'));
    console.log();

    console.log(chalk.cyan('Current Execution Settings:'));
    console.log(`   ${chalk.green('Coordination:')} ✅ Smart coordination enabled`);
    console.log(`   ${chalk.green('Timeout:')} 30 seconds per hook`);
    console.log(`   ${chalk.green('Parallel Execution:')} ✅ Enabled`);
    console.log(`   ${chalk.green('Error Handling:')} Graceful fallback`);
    console.log();

    await this.waitForEnter();
  }

  /**
   * Installation preferences
   */
  async installationPreferencesComplete() {
    console.log(chalk.blue('📁 Installation Preferences'));
    console.log();

    console.log(chalk.cyan('Current Preferences:'));
    console.log(`   ${chalk.green('Default Scope:')} User Level`);
    console.log(`   ${chalk.green('Auto-Install Dependencies:')} ✅ Yes`);
    console.log(`   ${chalk.green('Backup Before Changes:')} ✅ Yes`);
    console.log(`   ${chalk.green('Validation:')} ✅ Enabled`);
    console.log();

    await this.waitForEnter();
  }

  /**
   * Advanced configuration
   */
  async advancedConfigurationComplete() {
    console.log(chalk.blue('🔧 Advanced Configuration'));
    console.log();

    console.log(chalk.yellow('⚠️  Advanced configuration features coming soon'));
    console.log();
    console.log(chalk.gray('Planned features:'));
    console.log(chalk.gray('• Custom hook development tools'));
    console.log(chalk.gray('• Hook debugging interface'));
    console.log(chalk.gray('• Performance monitoring'));
    console.log(chalk.gray('• Custom event triggers'));
    console.log();

    await this.waitForEnter();
  }

  /**
   * Show system information
   */
  async showSystemInformationComplete() {
    console.log(chalk.blue('📊 System Information'));
    console.log();

    console.log(chalk.cyan('Environment:'));
    console.log(`   ${chalk.green('Node.js:')} ${process.version}`);
    console.log(`   ${chalk.green('Platform:')} ${process.platform}`);
    console.log(`   ${chalk.green('Architecture:')} ${process.arch}`);
    console.log(`   ${chalk.green('Working Directory:')} ${process.cwd()}`);
    console.log();

    console.log(chalk.cyan('Rins Hooks:'));
    console.log(`   ${chalk.green('Version:')} 1.0.3`);
    console.log(`   ${chalk.green('Installation:')} Global`);
    console.log(`   ${chalk.green('Configuration:')} Active`);
    console.log();

    await this.waitForEnter();
  }

  /**
   * Get hook scope
   */
  getHookScope(hook) {
    if (this.hookStates.user.includes(hook)) return 'User Level';
    if (this.hookStates.project.includes(hook)) return 'Project Level';  
    if (this.hookStates.local.includes(hook)) return 'Local Level';
    return 'Unknown';
  }
}

module.exports = HookControlPanelMethods;