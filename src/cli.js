#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');

const Installer = require('./installer');
const ConfigManager = require('./config');
const Utils = require('./utils');

const program = new Command();

// Global configuration
program
  .name('rins_hooks')
  .description('Universal Claude Code hooks collection with cross-platform installer')
  .version(version);

// Install command
program
  .command('install [hooks...]')
  .description('Install Claude Code hooks')
  .option('-a, --all', 'Install all available hooks')
  .option('-i, --interactive', 'Interactive installation')
  .option('-u, --user', 'Install at user level (~/.claude/settings.json)')
  .option('-p, --project', 'Install at project level (.claude/settings.json)')
  .option('-l, --local', 'Install at local level (.claude/settings.local.json)')
  .option('--dry-run', 'Show what would be installed without making changes')
  .action(async (hooks, options) => {
    try {
      console.log(chalk.blue('🔧 Rins Hooks Installer'));
      console.log();

      const installer = new Installer();

      if (options.interactive) {
        await installer.interactiveInstall(options);
      } else if (options.all) {
        await installer.installAll(options);
      } else if (hooks.length > 0) {
        await installer.installHooks(hooks, options);
      } else {
        console.log(chalk.yellow('ℹ️  No hooks specified. Use --interactive or --all, or specify hook names.'));
        console.log();
        console.log('Available hooks:');
        const availableHooks = await installer.getAvailableHooks();
        availableHooks.forEach(hook => {
          console.log(chalk.green(`  • ${hook.name}`), chalk.gray(`- ${hook.description}`));
        });
        console.log();
        console.log(chalk.cyan('Example: rins_hooks install auto-commit notification'));
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

// Status command
program
  .command('status')
  .description('Show installed hooks status')
  .action(async () => {
    try {
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
        console.log(chalk.cyan('Run `rins_hooks install --interactive` to get started.'));
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
        console.log(chalk.red('❌ Some issues found. Please address them before using rins_hooks.'));
      } else {
        console.log(chalk.green('✅ Everything looks good!'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Doctor failed:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
