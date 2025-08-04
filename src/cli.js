#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { version } = require('../package.json');

const Installer = require('./installer');
const ConfigManager = require('./config');
const Utils = require('./utils');
const VersionCheck = require('./version-check');
const HookManager = require('./hook-manager');

const program = new Command();

/**
 * Run version check before any command
 */
async function runVersionCheck() {
  try {
    const versionCheck = new VersionCheck();
    await versionCheck.quickCheck();
  } catch (error) {
    // Fail silently - don't interrupt main commands
  }
}

// Global configuration
program
  .name('rapala')
  .description('🎣 Rapala - Universal Claude Code Enhancement Center: Hooks, Tools, Resources, Prompts & MCPs')
  .version(version)
  .hook('preAction', runVersionCheck);

// Install command
program
  .command('install [hooks...]')
  .description('Install Claude Code hooks')
  .option('-a, --all', 'Install all available hooks')
  .option('-i, --interactive', 'Interactive installation with rich TUI')
  .option('-u, --user', 'Install at user level (~/.claude/settings.json)')
  .option('-p, --project', 'Install at project level (.claude/settings.json)')
  .option('-l, --local', 'Install at local level (.claude/settings.local.json)')
  .option('--dry-run', 'Show what would be installed without making changes')
  .action(async (hooks, options) => {
    try {
      const installer = new Installer();

      // If no arguments, show interactive TUI by default
      if (hooks.length === 0 && !options.all && !options.interactive) {
        console.log(chalk.blue('🚀 Welcome to Rins Hooks!'));
        console.log(chalk.gray('Starting interactive installation...'));
        console.log();
        await installer.enhancedInteractiveInstall(options);
        return;
      }

      console.log(chalk.blue('🔧 Rins Hooks Installer'));
      console.log();

      if (options.interactive) {
        await installer.enhancedInteractiveInstall(options);
      } else if (options.all) {
        await installer.installAll(options);
      } else if (hooks.length > 0) {
        await installer.installHooks(hooks, options);
      }
    } catch (error) {
      console.error(chalk.red('❌ Installation failed:'), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List available hooks')
  .action(async () => {
    try {
      const installer = new Installer();
      const hooks = await installer.getAvailableHooks();

      console.log(chalk.blue('📋 Available Claude Code Hooks'));
      console.log();

      hooks.forEach(hook => {
        console.log(chalk.green(`📌 ${hook.name}`));
        console.log(chalk.gray(`   ${hook.description}`));
        if (hook.tags && hook.tags.length > 0) {
          console.log(chalk.cyan(`   Tags: ${hook.tags.join(', ')}`));
        }
        console.log();
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to list hooks:'), error.message);
      process.exit(1);
    }
  });

// Status command - Enhanced interactive control panel
program
  .command('status')
  .description('Interactive hook management control panel')
  .option('-s, --simple', 'Show simple status without interactive menu')
  .option('--debug', 'Enable debug logging for navigation issues')
  .action(async (options) => {
    try {
      if (options.simple) {
        // Simple status display
        const configManager = new ConfigManager();
        const status = await configManager.getInstallationStatus();

        console.log(chalk.blue('📊 Installation Status'));
        console.log();

        if (status.user.length > 0) {
          console.log(chalk.green('👤 User Level Hooks:'));
          status.user.forEach(hook => {
            console.log(chalk.green(`  ✅ ${hook.name}`), chalk.gray(`- ${hook.status}`));
          });
          console.log();
        }

        if (status.project.length > 0) {
          console.log(chalk.green('📁 Project Level Hooks:'));
          status.project.forEach(hook => {
            console.log(chalk.green(`  ✅ ${hook.name}`), chalk.gray(`- ${hook.status}`));
          });
          console.log();
        }

        if (status.local.length > 0) {
          console.log(chalk.green('🔒 Local Level Hooks:'));
          status.local.forEach(hook => {
            console.log(chalk.green(`  ✅ ${hook.name}`), chalk.gray(`- ${hook.status}`));
          });
          console.log();
        }

        if (status.user.length === 0 && status.project.length === 0 && status.local.length === 0) {
          console.log(chalk.yellow('ℹ️  No hooks installed.'));
          console.log(chalk.cyan('Run `rapala install` to get started.'));
        }
      } else {
        // Interactive control panel
        const HookControlPanel = require('./hook-control-panel');
        const controlPanel = new HookControlPanel();
        await controlPanel.showInteractiveStatus(options.debug);
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config [hook]')
  .description('Manage hook configuration')
  .option('-s, --show', 'Show current configuration')
  .option('-e, --edit', 'Edit configuration')
  .option('-r, --reset', 'Reset to default configuration')
  .option('-v, --validate', 'Validate configuration')
  .action(async (hook, options) => {
    try {
      const configManager = new ConfigManager();

      if (options.show) {
        await configManager.showConfig(hook);
      } else if (options.edit) {
        await configManager.editConfig(hook);
      } else if (options.reset) {
        await configManager.resetConfig(hook);
      } else if (options.validate) {
        await configManager.validateConfig(hook);
      } else {
        console.log(chalk.yellow('ℹ️  Please specify a configuration action.'));
        console.log('Use --show, --edit, --reset, or --validate');
      }
    } catch (error) {
      console.error(chalk.red('❌ Configuration failed:'), error.message);
      process.exit(1);
    }
  });

// Enable command
program
  .command('enable <hook>')
  .description('Enable a specific hook')
  .option('-u, --user', 'Enable at user level')
  .option('-p, --project', 'Enable at project level')
  .option('-l, --local', 'Enable at local level')
  .action(async (hook, options) => {
    try {
      const configManager = new ConfigManager();
      await configManager.enableHook(hook, options);
      console.log(chalk.green(`✅ Hook '${hook}' enabled successfully.`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to enable hook:'), error.message);
      process.exit(1);
    }
  });

// Disable command
program
  .command('disable <hook>')
  .description('Disable a specific hook')
  .option('-u, --user', 'Disable at user level')
  .option('-p, --project', 'Disable at project level')
  .option('-l, --local', 'Disable at local level')
  .action(async (hook, options) => {
    try {
      const configManager = new ConfigManager();
      await configManager.disableHook(hook, options);
      console.log(chalk.green(`✅ Hook '${hook}' disabled successfully.`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to disable hook:'), error.message);
      process.exit(1);
    }
  });

// Uninstall command
program
  .command('uninstall [hooks...]')
  .description('Uninstall Claude Code hooks')
  .option('-a, --all', 'Uninstall all hooks')
  .option('-u, --user', 'Uninstall from user level')
  .option('-p, --project', 'Uninstall from project level')
  .option('-l, --local', 'Uninstall from local level')
  .option('--dry-run', 'Show what would be uninstalled without making changes')
  .action(async (hooks, options) => {
    try {
      const installer = new Installer();

      if (options.all) {
        await installer.uninstallAll(options);
      } else if (hooks.length > 0) {
        await installer.uninstallHooks(hooks, options);
      } else {
        console.log(chalk.yellow('ℹ️  No hooks specified. Use --all or specify hook names.'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Uninstallation failed:'), error.message);
      process.exit(1);
    }
  });

// Doctor command
program
  .command('doctor')
  .description('Diagnose installation and configuration issues')
  .action(async () => {
    try {
      console.log(chalk.blue('🔍 Rins Hooks Doctor'));
      console.log();

      const utils = new Utils();
      const diagnostics = await utils.runDiagnostics();

      diagnostics.forEach(diagnostic => {
        const icon = diagnostic.status === 'ok' ? '✅' : diagnostic.status === 'warning' ? '⚠️' : '❌';
        console.log(`${icon} ${diagnostic.check}: ${diagnostic.message}`);
      });

      console.log();
      const hasErrors = diagnostics.some(d => d.status === 'error');
      if (hasErrors) {
        console.log(chalk.red('❌ Some issues found. Please address them before using rapala.'));
      } else {
        console.log(chalk.green('✅ Everything looks good!'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Doctor failed:'), error.message);
      process.exit(1);
    }
  });

// Clean command
program
  .command('clean')
  .description('Clean and optimize hook configuration')
  .option('-u, --user', 'Clean user level hooks')
  .option('-p, --project', 'Clean project level hooks') 
  .option('-l, --local', 'Clean local level hooks')
  .option('-a, --all', 'Clean all levels')
  .option('--validate', 'Validate configuration after cleaning')
  .option('--stats', 'Show hook statistics')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const hookManager = new HookManager(configManager);
      
      const scopes = [];
      if (options.all) {
        scopes.push('user', 'project', 'local');
      } else {
        if (options.user) scopes.push('user');
        if (options.project) scopes.push('project');
        if (options.local) scopes.push('local');
        if (scopes.length === 0) scopes.push('user'); // default
      }

      for (const scope of scopes) {
        console.log(chalk.blue(`\n🧹 Cleaning ${scope} level hooks...`));
        await hookManager.cleanAndOptimize(scope);
        
        if (options.stats) {
          const stats = await hookManager.getHookStats(scope);
          console.log(chalk.cyan(`\n📊 ${scope.toUpperCase()} Stats:`));
          console.log(`  Events: ${stats.totalEvents}, Matchers: ${stats.totalMatchers}, Hooks: ${stats.totalHooks}`);
        }
        
        if (options.validate) {
          await hookManager.validateConfiguration(scope);
        }
      }
      
      console.log(chalk.green('\n✅ Cleaning complete!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Clean failed:'), error.message);
      process.exit(1);
    }
  });

// Agent-MCP command
program
  .command('agentmcp')
  .description('Manage Agent-MCP collaboration hooks')
  .option('-i, --install [hooks...]', 'Install Agent-MCP hooks (all, or specify: registry, locking, tasks, git)')
  .option('-s, --status', 'Show Agent-MCP hooks status')
  .option('-u, --user', 'Install at user level (~/.claude/settings.json)')
  .option('-p, --project', 'Install at project level (.claude/settings.json)')
  .option('-l, --local', 'Install at local level (.claude/settings.local.json)')
  .option('--interactive', 'Interactive Agent-MCP setup with TUI')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🤖 Agent-MCP Hook Manager'));
      console.log(chalk.gray('Multi-agent collaboration system for Claude Code'));
      console.log();

      const AgentMCPManager = require('./agent-mcp-manager');
      const manager = new AgentMCPManager();

      if (options.status) {
        await manager.showStatus();
      } else if (options.interactive) {
        await manager.interactiveSetup(options);
      } else if (options.install) {
        const hooks = Array.isArray(options.install) ? options.install : ['all'];
        await manager.installHooks(hooks, options);
      } else {
        // Default: show interactive menu
        await manager.interactiveSetup(options);
      }
    } catch (error) {
      console.error(chalk.red('❌ Agent-MCP command failed:'), error.message);
      process.exit(1);
    }
  });

// Update command
program
  .command('update')
  .description('Check for and manage hook updates')
  .option('-c, --check', 'Check for available updates')
  .option('-u, --update [hook]', 'Update all hooks or specific hook')
  .option('-l, --list', 'List all hooks with versions')
  .option('-r, --reset', 'Reset version tracking')
  .option('--auto-on', 'Enable automatic updates')
  .option('--auto-off', 'Disable automatic updates')
  .option('--auto-status', 'Show auto-update status')
  .action(async (options) => {
    try {
      const versionCheckerPath = path.join(__dirname, '..', 'hooks', 'version-checker', 'index.js');
      
      if (!require('fs').existsSync(versionCheckerPath)) {
        console.log(chalk.yellow('⚠️  Version checker hook not found.'));
        console.log(chalk.cyan('Install it with: rapala install version-checker'));
        return;
      }

      // Handle auto-update options
      if (options.autoOn) {
        const { spawn } = require('child_process');
        const child = spawn('node', [versionCheckerPath, '--enable-auto-update'], {
          stdio: 'inherit'
        });
        child.on('exit', (code) => process.exit(code));
        return;
      }

      if (options.autoOff) {
        const { spawn } = require('child_process');
        const child = spawn('node', [versionCheckerPath, '--disable-auto-update'], {
          stdio: 'inherit'
        });
        child.on('exit', (code) => process.exit(code));
        return;
      }

      if (options.autoStatus) {
        const { spawn } = require('child_process');
        const child = spawn('node', [versionCheckerPath, '--status'], {
          stdio: 'inherit'
        });
        child.on('exit', (code) => process.exit(code));
        return;
      }

      // Handle update operations
      console.log(chalk.blue('🔄 Hook Update Manager'));
      console.log();

      if (options.check || (!options.update && !options.list && !options.reset)) {
        console.log(chalk.cyan('🔍 Checking for hook updates...'));
        console.log(chalk.gray('This will check all installed hooks for available updates.'));
        console.log();
        
        // Show current auto-update status
        const VersionCheckerHook = require('../hooks/version-checker/index.js');
        const status = VersionCheckerHook.getAutoUpdateStatus();
        console.log(chalk.blue('📊 Auto-Update Status:'), status.autoUpdate ? chalk.green('✅ ENABLED') : chalk.red('❌ DISABLED'));
        
        if (!status.autoUpdate) {
          console.log(chalk.yellow('ℹ️  Auto-update is disabled. Use --auto-on to enable automatic updates.'));
        }
        console.log();
      }

      // Legacy update script fallback
      const updateScript = path.join(__dirname, '..', 'hooks', 'version-checker', 'update.js');
      if (require('fs').existsSync(updateScript)) {
        const { spawn } = require('child_process');
        
        let command = 'check'; // default
        if (options.update) {
          command = typeof options.update === 'string' ? `update ${options.update}` : 'update';
        } else if (options.list) {
          command = 'list';
        } else if (options.reset) {
          command = 'reset';
        }

        const child = spawn('node', [updateScript, ...command.split(' ')], {
          stdio: 'inherit',
          cwd: process.cwd()
        });

        child.on('exit', (code) => {
          process.exit(code);
        });
      } else {
        console.log(chalk.gray('💡 Use the control panel for comprehensive hook management:'));
        console.log(chalk.cyan('   rapala status'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Update command failed:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show interactive control panel if no command provided
if (!process.argv.slice(2).length) {
  (async () => {
    try {
      console.log(chalk.blue('🎣 Welcome to Rapala!'));
      console.log(chalk.gray('Starting interactive control panel...'));
      console.log();
      
      const HookControlPanel = require('./hook-control-panel');
      const controlPanel = new HookControlPanel();
      await controlPanel.showInteractiveStatus();
    } catch (error) {
      console.error(chalk.red('❌ Control panel failed:'), error.message);
      program.outputHelp();
    }
  })();
}
