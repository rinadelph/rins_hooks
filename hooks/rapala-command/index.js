#!/usr/bin/env node

/**
 * Rapala Command Manager Hook
 * Manages the /rapala slash command installation and ensures it's available
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

async function main() {
  try {
    // This hook ensures the /rapala slash command is properly installed
    const globalCommandsDir = path.join(os.homedir(), '.claude', 'commands');
    const projectCommandsDir = path.join(process.cwd(), '.claude', 'commands');
    const sourceCommandFile = path.join(__dirname, '..', '..', '..', '.claude', 'commands', 'rapala.md');
    
    const globalCommandFile = path.join(globalCommandsDir, 'rapala.md');
    const projectCommandFile = path.join(projectCommandsDir, 'rapala.md');
    
    // Ensure directories exist
    await fs.ensureDir(globalCommandsDir);
    await fs.ensureDir(projectCommandsDir);
    
    // Check if command files exist and are up to date
    let updated = false;
    
    if (await fs.pathExists(sourceCommandFile)) {
      const sourceContent = await fs.readFile(sourceCommandFile, 'utf8');
      
      // Update global command if different or missing
      if (!await fs.pathExists(globalCommandFile) || 
          (await fs.readFile(globalCommandFile, 'utf8')) !== sourceContent) {
        await fs.writeFile(globalCommandFile, sourceContent);
        updated = true;
      }
      
      // Update project command if different or missing
      if (!await fs.pathExists(projectCommandFile) || 
          (await fs.readFile(projectCommandFile, 'utf8')) !== sourceContent) {
        await fs.writeFile(projectCommandFile, sourceContent);
        updated = true;
      }
    }
    
    if (updated) {
      console.error(chalk.blue('🎣 Rapala Command Manager'));
      console.error(chalk.green('✅ /rapala slash command updated and ready to use'));
      console.error(chalk.gray('   Available globally and in this project'));
      console.error();
      console.error(chalk.cyan('💡 Usage: /rapala "format Python files after editing"'));
    }
    
    // Exit successfully - this hook just ensures the command is available
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red('❌ Rapala command manager failed:'), error.message);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { main };