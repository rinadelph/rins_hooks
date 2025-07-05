#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// Simple build script that ensures hooks are executable
async function buildHooks() {
  console.log(chalk.blue('🔨 Building hooks...'));
  
  const hooksDir = path.join(__dirname, '..', 'hooks');
  
  try {
    const hookDirs = await fs.readdir(hooksDir);
    
    for (const hookDir of hookDirs) {
      const hookPath = path.join(hooksDir, hookDir);
      const stat = await fs.stat(hookPath);
      
      if (stat.isDirectory()) {
        const indexPath = path.join(hookPath, 'index.js');
        
        if (await fs.pathExists(indexPath)) {
          // Make hook executable
          await fs.chmod(indexPath, 0o755);
          console.log(chalk.green(`  ✅ ${hookDir}/index.js`));
        }
      }
    }
    
    console.log(chalk.green('✅ All hooks built successfully!'));
  } catch (error) {
    console.error(chalk.red('❌ Build failed:'), error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  buildHooks();
}

module.exports = buildHooks;