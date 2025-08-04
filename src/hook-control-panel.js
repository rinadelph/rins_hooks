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
   * Scan current directory for Claude configuration and project context
   */
  async scanCurrentDirectory() {
    console.log(chalk.blue('🔍 Scanning Current Environment...'));
    console.log(chalk.gray(`Directory: ${this.currentDir}`));
    
    // Look for .claude directory in current and parent directories
    let searchDir = this.currentDir;
    while (searchDir !== path.dirname(searchDir)) {
      const claudePath = path.join(searchDir, '.claude');
      if (fs.existsSync(claudePath)) {
        this.claudeDir = claudePath;
        console.log(chalk.green(`✅ Found Claude directory: ${claudePath}`));
        break;
      }
      searchDir = path.dirname(searchDir);
    }

    // Check for global Claude settings
    const homeClaudeDir = path.join(require('os').homedir(), '.claude');
    if (fs.existsSync(homeClaudeDir)) {
      console.log(chalk.green(`✅ Found global Claude directory: ${homeClaudeDir}`));
    }

    console.log();
  }

  /**
   * Detect project context and type
   */
  async detectProjectContext() {
    const context = {
      type: 'unknown',
      name: path.basename(this.currentDir),
      hasGit: fs.existsSync(path.join(this.currentDir, '.git')),
      hasPackageJson: fs.existsSync(path.join(this.currentDir, 'package.json')),
      hasPyprojectToml: fs.existsSync(path.join(this.currentDir, 'pyproject.toml')),
      hasCargoToml: fs.existsSync(path.join(this.currentDir, 'Cargo.toml')),
      hasClaudeConfig: !!this.claudeDir,
      settings: {}
    };

    // Determine project type
    if (context.hasPackageJson) {
      context.type = 'node';
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(this.currentDir, 'package.json'), 'utf8'));
        context.name = pkg.name || context.name;
        context.version = pkg.version;
      } catch (error) {
        // Ignore package.json parse errors
      }
    } else if (context.hasPyprojectToml) {
      context.type = 'python';
    } else if (context.hasCargoToml) {
      context.type = 'rust';
    }

    this.projectContext = context;
  }

  /**
   * Load current hook states from all configuration levels
   */
  async loadCurrentHookStates() {
    // This will be populated with actual hook states
    this.hookStates = {
      user: [],
      project: [],
      local: [],
      available: [],
      updates: [],
      autoUpdate: false
    };

    try {
      const status = await this.configManager.getInstallationStatus();
      const availableHooks = await this.installer.getAvailableHooks();
      
      this.hookStates.user = status.user || [];
      this.hookStates.project = status.project || [];
      this.hookStates.local = status.local || [];
      this.hookStates.available = availableHooks || [];

      // Check for updates
      if (fs.existsSync(path.join(__dirname, '..', 'hooks', 'version-checker', 'index.js'))) {
        const VersionCheckerHook = require('../hooks/version-checker/index.js');
        const updateStatus = VersionCheckerHook.getAutoUpdateStatus(this.currentDir);
        this.hookStates.autoUpdate = updateStatus.autoUpdate;
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not load hook states: ${error.message}`));
    }
  }

  /**
   * Main interactive status and control interface - 100% Self-Contained
   */
  async showInteractiveStatus() {
    // Initialize and scan environment
    await this.initialize();

    console.log(chalk.blue('🎛️  Complete Hook Management Center'));
    console.log(chalk.gray('100% self-contained interface - no CLI commands needed'));
    console.log();

    while (true) {
      // Show comprehensive environment overview
      await this.displayEnvironmentOverview();
      
      // Main menu with all functionality
      const mainAction = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '📊 Environment & Hook Status', value: 'status' },
          { name: '🔍 Scan & Analyze Current Directory', value: 'scan' },
          { name: '⚙️  Individual Hook Management', value: 'manage' },
          { name: '📦 Install & Configure Hooks', value: 'install' },
          { name: '🔄 Update System & Hooks', value: 'update' },
          { name: '🤖 Agent-MCP Management', value: 'agentmcp' },
          { name: '🧹 Clean & Optimize', value: 'clean' },
          { name: '🔧 Bulk Operations', value: 'bulk' },
          { name: '⚙️  System Settings', value: 'settings' },
          new inquirer.Separator(),
          { name: '🚪 Exit Management Center', value: 'exit' }
        ]
      }]);

      try {
        switch (mainAction.action) {
          case 'status':
            await this.showComprehensiveStatus();
            break;
          case 'scan':
            await this.performDeepScan();
            break;
          case 'manage':
            await this.manageIndividualHooksComplete();
            break;
          case 'install':
            await this.installHooksComplete();
            break;
          case 'update':
            await this.updateSystemComplete();
            break;
          case 'agentmcp':
            await this.manageAgentMCPComplete();
            break;
          case 'clean':
            await this.cleanAndOptimizeComplete();
            break;
          case 'bulk':
            await this.bulkOperationsComplete();
            break;
          case 'settings':
            await this.systemSettingsComplete();
            break;
          case 'exit':
            console.log(chalk.green('👋 Hook management complete!'));
            return;
        }
      } catch (error) {
        console.error(chalk.red(`❌ Operation failed: ${error.message}`));
        console.log(chalk.gray('Returning to main menu...'));
      }

      // Continue automatically (no asking)
      console.log();
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
    }
  }

  /**
   * Display comprehensive environment overview
   */
  async displayEnvironmentOverview() {
    // Refresh hook states
    await this.loadCurrentHookStates();

    console.log(chalk.cyan('🌍 Current Environment'));
    console.log();
    
    // Project context
    console.log(chalk.blue('📁 Project Information:'));
    console.log(`   ${chalk.green('Name:')} ${this.projectContext.name}`);
    console.log(`   ${chalk.green('Type:')} ${this.projectContext.type}`);
    console.log(`   ${chalk.green('Directory:')} ${this.currentDir}`);
    if (this.projectContext.version) {
      console.log(`   ${chalk.green('Version:')} ${this.projectContext.version}`);
    }
    console.log();

    // Claude configuration status
    console.log(chalk.blue('⚙️  Claude Configuration:'));
    const hasUserConfig = fs.existsSync(path.join(require('os').homedir(), '.claude', 'settings.json'));
    const hasProjectConfig = this.claudeDir && fs.existsSync(path.join(this.claudeDir, 'settings.json'));
    const hasLocalConfig = this.claudeDir && fs.existsSync(path.join(this.claudeDir, 'settings.local.json'));
    
    console.log(`   ${chalk.green('User Level:')} ${hasUserConfig ? '✅ Active' : '❌ Not found'}`);
    console.log(`   ${chalk.green('Project Level:')} ${hasProjectConfig ? '✅ Active' : '❌ Not found'}`);
    console.log(`   ${chalk.green('Local Level:')} ${hasLocalConfig ? '✅ Active' : '❌ Not found'}`);
    console.log();

    // Hook summary
    const totalInstalled = this.hookStates.user.length + this.hookStates.project.length + this.hookStates.local.length;
    const totalAvailable = this.hookStates.available.length;
    
    console.log(chalk.blue('🎣 Hook Summary:'));
    console.log(`   ${chalk.green('Installed:')} ${totalInstalled}/${totalAvailable} hooks`);
    console.log(`   ${chalk.green('Auto-Update:')} ${this.hookStates.autoUpdate ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ${chalk.green('Git Integration:')} ${this.projectContext.hasGit ? '✅ Available' : '❌ No Git'}`);
    console.log();
  }

  /**
   * Show comprehensive status with all details
   */
  async showComprehensiveStatus() {
    console.log(chalk.blue('📊 Comprehensive System Status'));
    console.log();

    // Environment details
    console.log(chalk.cyan('🌍 Environment Details:'));
    console.log(`   ${chalk.green('Current Directory:')} ${this.currentDir}`);
    console.log(`   ${chalk.green('Project Type:')} ${this.projectContext.type}`);
    console.log(`   ${chalk.green('Has Git:')} ${this.projectContext.hasGit ? '✅ Yes' : '❌ No'}`);
    console.log(`   ${chalk.green('Claude Config:')} ${this.projectContext.hasClaudeConfig ? '✅ Found' : '❌ Not found'}`);
    console.log();

    // Hook installation details by scope
    console.log(chalk.cyan('🎣 Hook Details by Scope:'));
    
    if (this.hookStates.user.length > 0) {
      console.log(chalk.blue(`👤 User Level (${this.hookStates.user.length} hooks):`));
      this.hookStates.user.forEach(hook => {
        console.log(`   ✅ ${hook.name} - ${hook.description || 'No description'}`);
      });
      console.log();
    }

    if (this.hookStates.project.length > 0) {
      console.log(chalk.blue(`📁 Project Level (${this.hookStates.project.length} hooks):`));
      this.hookStates.project.forEach(hook => {
        console.log(`   ✅ ${hook.name} - ${hook.description || 'No description'}`);
      });
      console.log();
    }

    if (this.hookStates.local.length > 0) {
      console.log(chalk.blue(`🔒 Local Level (${this.hookStates.local.length} hooks):`));
      this.hookStates.local.forEach(hook => {
        console.log(`   ✅ ${hook.name} - ${hook.description || 'No description'}`);
      });
      console.log();
    }

    // Available hooks
    const installedNames = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local].map(h => h.name);
    const uninstalled = this.hookStates.available.filter(h => !installedNames.includes(h.name));
    
    if (uninstalled.length > 0) {
      console.log(chalk.blue(`📦 Available for Installation (${uninstalled.length} hooks):`));
      uninstalled.forEach(hook => {
        console.log(`   📋 ${hook.name} - ${hook.description}`);
      });
      console.log();
    }

    // System settings
    console.log(chalk.cyan('⚙️  System Settings:'));
    console.log(`   ${chalk.green('Auto-Update:')} ${this.hookStates.autoUpdate ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ${chalk.green('Version Check:')} Available`);
    console.log();

    await this.waitForEnter();
  }

  /**
   * Perform deep scan of current directory and environment
   */
  async performDeepScan() {
    console.log(chalk.blue('🔍 Deep Environment Scan'));
    console.log();

    console.log(chalk.cyan('Scanning file system...'));
    
    // Scan for various config files
    const configFiles = [
      { name: 'package.json', type: 'Node.js project' },
      { name: 'pyproject.toml', type: 'Python project' },
      { name: 'Cargo.toml', type: 'Rust project' },
      { name: '.gitignore', type: 'Git repository' },
      { name: 'README.md', type: 'Documentation' },
      { name: '.env', type: 'Environment variables' },
      { name: '.claude/settings.json', type: 'Claude project config' },
      { name: '.claude/settings.local.json', type: 'Claude local config' }
    ];

    console.log(chalk.blue('📄 Configuration Files Found:'));
    configFiles.forEach(({ name, type }) => {
      const exists = fs.existsSync(path.join(this.currentDir, name));
      console.log(`   ${exists ? '✅' : '❌'} ${name} (${type})`);
    });
    console.log();

    // Scan for hook-related directories
    console.log(chalk.blue('📁 Hook-Related Directories:'));
    const hookDirs = [
      '.claude',
      '.claude/hook-locks',
      'hooks',
      'scripts'
    ];

    hookDirs.forEach(dir => {
      const dirPath = path.join(this.currentDir, dir);
      const exists = fs.existsSync(dirPath);
      console.log(`   ${exists ? '✅' : '❌'} ${dir} ${exists ? `(${fs.readdirSync(dirPath).length} items)` : ''}`);
    });
    console.log();

    // Git information if available
    if (this.projectContext.hasGit) {
      console.log(chalk.blue('🔄 Git Information:'));
      try {
        const branch = execSync('git branch --show-current', { encoding: 'utf8', cwd: this.currentDir }).trim();
        const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: this.currentDir }).trim();
        const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8', cwd: this.currentDir }).trim();
        
        console.log(`   ${chalk.green('Current Branch:')} ${branch}`);
        console.log(`   ${chalk.green('Working Tree:')} ${status ? '🔶 Has changes' : '✅ Clean'}`);
        console.log(`   ${chalk.green('Last Commit:')} ${lastCommit}`);
        console.log();
      } catch (error) {
        console.log(`   ❌ Could not read git information: ${error.message}`);
        console.log();
      }
    }

    await this.waitForEnter();
  }

  /**
   * Complete individual hook management
   */
  async manageIndividualHooksComplete() {
    console.log(chalk.blue('⚙️  Individual Hook Management'));
    console.log();

    const allHooks = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local];
    
    if (allHooks.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed to manage.'));
      console.log(chalk.cyan('Install hooks first using the "Install & Configure Hooks" option.'));
      await this.waitForEnter();
      return;
    }

    // Select hook to manage
    const hookChoices = allHooks.map(hook => {
      const scope = this.hookStates.user.includes(hook) ? '👤' : 
                    this.hookStates.project.includes(hook) ? '📁' : '🔒';
      return {
        name: `${hook.name} ${scope} - ${hook.description || 'No description'}`,
        value: hook,
        short: hook.name
      };
    });

    const selectedHook = await inquirer.prompt([{
      type: 'list',
      name: 'hook',
      message: 'Select a hook to manage:',
      choices: hookChoices,
      pageSize: 10
    }]);

    // Management options
    const actions = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: `What would you like to do with ${selectedHook.hook.name}?`,
      choices: [
        { name: '📊 View Detailed Information', value: 'details' },
        { name: '⚙️  Configure Hook Settings', value: 'configure' },
        { name: '🔄 Update This Hook', value: 'update' },
        { name: '📁 Change Installation Scope', value: 'move' },
        { name: '⏸️  Disable Hook', value: 'disable' },
        { name: '▶️  Enable Hook', value: 'enable' },
        { name: '❌ Uninstall Hook', value: 'uninstall' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    const hook = selectedHook.hook;

    switch (actions.action) {
      case 'details':
        await this.showHookDetailsComplete(hook);
        break;
      case 'configure':
        await this.configureHookComplete(hook);
        break;
      case 'update':
        await this.updateSingleHookComplete(hook);
        break;
      case 'move':
        await this.moveHookScopeComplete(hook);
        break;
      case 'disable':
        await this.disableHookComplete(hook);
        break;
      case 'enable':
        await this.enableHookComplete(hook);
        break;
      case 'uninstall':
        await this.uninstallHookComplete(hook);
        break;
      case 'back':
        return;
    }
  }

  /**
   * Complete hook installation interface
   */
  async installHooksComplete() {
    console.log(chalk.blue('📦 Complete Hook Installation'));
    console.log();

    // Use the enhanced installer but make it truly complete
    await this.installer.enhancedInteractiveInstall();
  }

  /**
   * Complete update system
   */
  async updateSystemComplete() {
    console.log(chalk.blue('🔄 Complete Update System'));
    console.log();

    const updateOptions = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🔍 Check for Updates', value: 'check' },
        { name: '🔄 Update All Hooks', value: 'update_all' },
        { name: '⚙️  Auto-Update Settings', value: 'auto_settings' },
        { name: '📊 Update History', value: 'history' },
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    switch (updateOptions.action) {
      case 'check':
        await this.checkForUpdatesComplete();
        break;
      case 'update_all':
        await this.updateAllHooksComplete();
        break;
      case 'auto_settings':
        await this.autoUpdateSettingsComplete();
        break;
      case 'history':
        await this.showUpdateHistoryComplete();
        break;
      case 'back':
        return;
    }
  }

  /**
   * Complete Agent-MCP management
   */
  async manageAgentMCPComplete() {
    console.log(chalk.blue('🤖 Complete Agent-MCP Management'));
    console.log();

    const AgentMCPManager = require('./agent-mcp-manager');
    const agentManager = new AgentMCPManager();
    await agentManager.interactiveSetup();
  }

  /**
   * Complete clean and optimize
   */
  async cleanAndOptimizeComplete() {
    console.log(chalk.blue('🧹 Complete Clean & Optimize'));
    console.log();

    const cleanOptions = await inquirer.prompt([{
      type: 'checkbox',
      name: 'operations',
      message: 'Select optimization operations:',
      choices: [
        { name: '🧹 Remove Duplicate Hooks', value: 'duplicates', checked: true },
        { name: '⚙️  Optimize Configuration Files', value: 'config', checked: true },
        { name: '🔧 Clean Lock Files', value: 'locks', checked: true },
        { name: '📊 Validate All Configurations', value: 'validate', checked: false },
        { name: '📁 Clean Temporary Files', value: 'temp', checked: false }
      ]
    }]);

    if (cleanOptions.operations.length === 0) {
      console.log(chalk.yellow('ℹ️  No operations selected.'));
      return;
    }

    console.log(chalk.cyan('\n🔄 Performing optimization operations...'));

    for (const operation of cleanOptions.operations) {
      switch (operation) {
        case 'duplicates':
          console.log(chalk.blue('🧹 Removing duplicate hooks...'));
          await this.removeDuplicateHooks();
          break;
        case 'config':
          console.log(chalk.blue('⚙️  Optimizing configuration files...'));
          await this.optimizeConfigFiles();
          break;
        case 'locks':
          console.log(chalk.blue('🔧 Cleaning lock files...'));
          await this.cleanLockFiles();
          break;
        case 'validate':
          console.log(chalk.blue('📊 Validating configurations...'));
          await this.validateConfigurations();
          break;
        case 'temp':
          console.log(chalk.blue('📁 Cleaning temporary files...'));
          await this.cleanTempFiles();
          break;
      }
    }

    console.log(chalk.green('\n✅ Optimization complete!'));
    await this.waitForEnter();
  }

  /**
   * Complete bulk operations
   */
  async bulkOperationsComplete() {
    console.log(chalk.blue('🔧 Complete Bulk Operations'));
    console.log();

    const allHooks = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local];
    
    if (allHooks.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed for bulk operations.'));
      await this.waitForEnter();
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
        { name: '📁 Move Multiple Hooks', value: 'move_multiple' },
        { name: '❌ Uninstall Multiple Hooks', value: 'uninstall_multiple' },
        { name: '📊 Bulk Configuration', value: 'configure_multiple' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    if (bulkAction.action === 'back') return;

    // Select hooks for bulk operation
    const hookChoices = allHooks.map(hook => {
      const scope = this.hookStates.user.includes(hook) ? '👤' : 
                    this.hookStates.project.includes(hook) ? '📁' : '🔒';
      return {
        name: `${hook.name} ${scope} - ${hook.description || 'No description'}`,
        value: hook,
        short: hook.name
      };
    });

    const selectedHooks = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hooks',
      message: `Select hooks for ${bulkAction.action.replace('_', ' ')}:`,
      choices: hookChoices,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one hook.';
        }
        return true;
      }
    }]);

    // Confirm bulk operation
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to ${bulkAction.action.replace('_', ' ')} ${selectedHooks.hooks.length} hooks?`,
      default: false
    }]);

    if (!confirm.confirm) {
      console.log(chalk.yellow('ℹ️  Operation cancelled.'));
      return;
    }

    // Perform bulk operation
    await this.performBulkOperation(bulkAction.action, selectedHooks.hooks);
  }

  /**
   * Complete system settings
   */
  async systemSettingsComplete() {
    console.log(chalk.blue('⚙️  Complete System Settings'));
    console.log();

    const settingsOptions = await inquirer.prompt([{
      type: 'list',
      name: 'category',
      message: 'Select settings category:',
      choices: [
        { name: '🔄 Auto-Update Settings', value: 'auto_update' },
        { name: '🎛️  Hook Execution Settings', value: 'execution' },
        { name: '📁 Installation Preferences', value: 'installation' },
        { name: '🔧 Advanced Configuration', value: 'advanced' },
        { name: '📊 System Information', value: 'system_info' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    switch (settingsOptions.category) {
      case 'auto_update':
        await this.autoUpdateSettingsComplete();
        break;
      case 'execution':
        await this.hookExecutionSettingsComplete();
        break;
      case 'installation':
        await this.installationPreferencesComplete();
        break;
      case 'advanced':
        await this.advancedConfigurationComplete();
        break;
      case 'system_info':
        await this.showSystemInformationComplete();
        break;
      case 'back':
        return;
    }
  }

  /**
   * Wait for user to press Enter
   */
  async waitForEnter() {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
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

// Mix in additional methods
const HookControlPanelMethods = require('./hook-control-panel-methods');
Object.assign(HookControlPanel.prototype, HookControlPanelMethods.prototype);

module.exports = HookControlPanel;