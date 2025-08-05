#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');

/**
 * Global Git Hook Conflict Scanner
 * 
 * Scans all rins_hooks installations and detects git hook conflicts
 * across projects, then provides automated fixes.
 */

class GlobalGitConflictScanner {
  constructor() {
    this.masterPath = path.join(__dirname, '..');
    this.coordinatorPath = path.join(this.masterPath, 'src', 'git-hook-coordinator.js');
    this.globalScannerPath = path.join(this.masterPath, 'bin', 'global-hook-scanner.js');
  }

  /**
   * Find all rins_hooks projects
   */
  findProjects() {
    try {
      const output = execSync(`node "${this.globalScannerPath}"`, { encoding: 'utf8' });
      const projects = [];
      
      // Parse the global scanner output to find project paths
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('✅') && line.includes('hooks)') && line.includes(' - ')) {
          const pathMatch = line.match(/ - (.+)$/);
          if (pathMatch) {
            projects.push(pathMatch[1]);
          }
        }
      }
      
      return projects;
    } catch (error) {
      console.error('Error finding projects:', error.message);
      return [];
    }
  }

  /**
   * Scan all projects for git conflicts
   */
  async scanAllProjects() {
    console.log('🔍 Scanning all rins_hooks projects for git hook conflicts...\n');
    
    const projects = this.findProjects();
    if (projects.length === 0) {
      console.log('❌ No rins_hooks projects found');
      return;
    }

    console.log(`📁 Found ${projects.length} projects to scan:\n`);

    const results = [];
    
    for (const projectPath of projects) {
      const projectName = path.basename(path.dirname(projectPath));
      console.log(`🔍 Scanning ${projectName}...`);
      
      try {
        // Run the coordinator for each project
        const output = execSync(`node "${this.coordinatorPath}" --scan`, {
          encoding: 'utf8',
          cwd: projectPath
        });
        
        if (output.includes('No git hook conflicts detected')) {
          console.log(`   ✅ Clean - no conflicts`);
          results.push({ project: projectName, path: projectPath, status: 'clean' });
        } else {
          console.log(`   ⚠️  Conflicts detected`);
          results.push({ 
            project: projectName, 
            path: projectPath, 
            status: 'conflicts',
            output: output 
          });
        }
      } catch (error) {
        console.log(`   ❌ Error scanning: ${error.message}`);
        results.push({ 
          project: projectName, 
          path: projectPath, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    console.log('\n📊 Summary:');
    const clean = results.filter(r => r.status === 'clean').length;
    const conflicts = results.filter(r => r.status === 'conflicts').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`   ✅ Clean projects: ${clean}`);
    console.log(`   ⚠️  Projects with conflicts: ${conflicts}`);
    console.log(`   ❌ Projects with errors: ${errors}`);

    // Show detailed conflict information
    const conflictProjects = results.filter(r => r.status === 'conflicts');
    if (conflictProjects.length > 0) {
      console.log('\n🚨 Projects with conflicts:');
      for (const project of conflictProjects) {
        console.log(`\n📁 ${project.project}:`);
        console.log(project.output.split('\n').map(line => `   ${line}`).join('\n'));
      }
      
      console.log('\n🛠️  Run with --fix to automatically resolve all conflicts');
    }

    return results;
  }

  /**
   * Fix conflicts in all projects
   */
  async fixAllConflicts() {
    console.log('🔧 Fixing git hook conflicts across all projects...\n');
    
    const projects = this.findProjects();
    const results = [];

    for (const projectPath of projects) {
      const projectName = path.basename(path.dirname(projectPath));
      console.log(`🔧 Fixing ${projectName}...`);
      
      try {
        const output = execSync(`node "${this.coordinatorPath}" --fix`, {
          encoding: 'utf8',
          cwd: projectPath
        });
        
        if (output.includes('No conflicts to fix')) {
          console.log(`   ✅ No conflicts to fix`);
        } else if (output.includes('successfully resolved')) {
          console.log(`   ✅ Conflicts resolved`);
          results.push({ project: projectName, status: 'fixed' });
        } else {
          console.log(`   ⚠️  Partial fix or issues`);
          results.push({ project: projectName, status: 'partial' });
        }
      } catch (error) {
        console.log(`   ❌ Error fixing: ${error.message}`);
        results.push({ project: projectName, status: 'error', error: error.message });
      }
    }

    console.log('\n🎉 Fix Summary:');
    const fixed = results.filter(r => r.status === 'fixed').length;
    const partial = results.filter(r => r.status === 'partial').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`   ✅ Successfully fixed: ${fixed} projects`);
    console.log(`   ⚠️  Partial fixes: ${partial} projects`);
    console.log(`   ❌ Errors: ${errors} projects`);

    return results;
  }

  /**
   * Show recommended setup
   */
  showRecommendations() {
    console.log('💡 Recommended Git Hook Setup for All Projects:\n');
    
    try {
      const output = execSync(`node "${this.coordinatorPath}" --recommend`, {
        encoding: 'utf8'
      });
      console.log(output);
    } catch (error) {
      console.error('Error getting recommendations:', error.message);
    }
  }

  /**
   * Update all projects with fixed hooks
   */
  async updateAllProjects() {
    console.log('🔄 Updating all projects with latest hooks and fixes...\n');
    
    try {
      // First update all hooks to latest versions
      console.log('1️⃣ Updating hook versions...');
      execSync(`node "${this.globalScannerPath}" --update-all`, { 
        encoding: 'utf8',
        stdio: 'inherit'
      });
      
      console.log('\n2️⃣ Fixing git hook conflicts...');
      await this.fixAllConflicts();
      
      console.log('\n✅ All projects updated with latest hooks and conflict fixes!');
      
    } catch (error) {
      console.error('Error during update:', error.message);
    }
  }
}

// CLI
async function main() {
  const scanner = new GlobalGitConflictScanner();
  const args = process.argv.slice(2);

  try {
    if (args.includes('--scan') || args.length === 0) {
      await scanner.scanAllProjects();
    }
    
    if (args.includes('--fix')) {
      await scanner.fixAllConflicts();
    }
    
    if (args.includes('--recommend')) {
      scanner.showRecommendations();
    }
    
    if (args.includes('--update-all')) {
      await scanner.updateAllProjects();
    }
    
    if (args.includes('--help')) {
      console.log(`
🔧 Global Git Hook Conflict Scanner

Usage:
  node git-conflict-scanner.js [options]

Options:
  --scan          Scan all projects for git hook conflicts (default)
  --fix           Automatically fix conflicts in all projects  
  --recommend     Show recommended git hook setup
  --update-all    Update all projects and fix conflicts
  --help          Show this help message

Examples:
  node git-conflict-scanner.js                    # Scan for conflicts
  node git-conflict-scanner.js --fix              # Fix all conflicts
  node git-conflict-scanner.js --update-all       # Full update and fix
      `);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = GlobalGitConflictScanner;