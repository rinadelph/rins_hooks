#!/usr/bin/env node

/**
 * Rapala Slash Command Hook
 * Enables /rapala "description" commands in Claude Code for generating hooks
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// Import the hook generator
const HookGenerator = require('../../src/hook-generator');

async function main() {
  try {
    // Parse command line arguments from Claude Code
    const args = process.argv.slice(2);
    const userInput = args.join(' ');
    
    // Check if this is a /rapala command
    const rapalaMatch = userInput.match(/\/rapala\s+"([^"]+)"|\/rapala\s+(.+)/);
    
    if (!rapalaMatch) {
      // Not a rapala command, exit silently
      process.exit(0);
    }
    
    // Extract the rule description
    const description = rapalaMatch[1] || rapalaMatch[2];
    
    if (!description) {
      console.log(chalk.red('❌ No hook description provided'));
      console.log(chalk.yellow('Usage: /rapala "format Python files after editing"'));
      process.exit(1);
    }
    
    console.log(chalk.blue('🎣 Rapala Hook Generator'));
    console.log(chalk.cyan(`💬 Processing: "${description}"`));
    console.log();
    
    // Generate the hook configuration
    const generator = new HookGenerator();
    const hookConfig = await generator.generateHook(description, process.cwd(), true); // silent mode
    
    if (!hookConfig) {
      console.log(chalk.red('❌ Could not parse hook description'));
      console.log(chalk.yellow('💡 Try descriptions like:'));
      console.log(chalk.gray('  /rapala "Format Python files after editing"'));
      console.log(chalk.gray('  /rapala "Run tests before committing"'));
      console.log(chalk.gray('  /rapala "Check for secrets before saving files"'));
      process.exit(1);
    }
    
    // Display the generated configuration
    console.log(chalk.green('✅ Generated hook configuration:'));
    console.log();
    console.log(chalk.cyan('📋 Hook Details:'));
    console.log(chalk.gray(`  Description: ${hookConfig.description}`));
    console.log(chalk.gray(`  Event: ${hookConfig.event}`));
    console.log(chalk.gray(`  Matcher: ${hookConfig.matcher || '(all tools)'}`));
    console.log(chalk.gray(`  Command: ${hookConfig.command}`));
    console.log();
    
    // Show the Claude Code JSON configuration
    const claudeCodeConfig = {
      [hookConfig.event]: [{
        matcher: hookConfig.matcher,
        hooks: [{
          type: 'command',
          command: hookConfig.command
        }]
      }]
    };
    
    // Remove undefined matcher
    if (!hookConfig.matcher) {
      delete claudeCodeConfig[hookConfig.event][0].matcher;
    }
    
    console.log(chalk.blue('⚙️ Claude Code Configuration:'));
    console.log(chalk.white(JSON.stringify(claudeCodeConfig, null, 2)));
    console.log();
    
    console.log(chalk.green('📦 To install this hook:'));
    console.log(chalk.gray('1. Copy the JSON configuration above'));
    console.log(chalk.gray('2. Add it to your Claude Code settings.json file'));
    console.log(chalk.gray('3. Or use: rapala status → Install → Manual configuration'));
    console.log();
    
    console.log(chalk.cyan('💡 Hook generation complete! You can now create hooks directly in Claude Code with /rapala commands.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Rapala command failed:'), error.message);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { main };