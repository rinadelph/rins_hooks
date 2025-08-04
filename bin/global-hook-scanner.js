#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Global Hook Version Scanner
 * 
 * Scans all rins_hooks installations across projects and identifies:
 * - Outdated hook versions
 * - Missing hooks
 * - Version mismatches
 * - Projects with old hook systems
 */

class GlobalHookScanner {
  constructor() {
    this.masterHookPath = __dirname.replace('/bin', '');
    this.projectPaths = [];
    this.scanResults = {
      projects: [],
      outdatedHooks: [],
      missingHooks: [],
      summary: {}
    };
  }

  /**
   * Find all rins_hooks installations
   */
  findRinsHooksProjects(searchPath = '/home/alejandro/Code') {
    const projects = [];
    
    try {
      const findCommand = `find "${searchPath}" -type d -name "rins_hooks" 2>/dev/null`;
      const output = execSync(findCommand, { encoding: 'utf8' });
      
      output.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && fs.existsSync(path.join(trimmed, 'hooks')) && trimmed !== this.masterHookPath) {
          projects.push(trimmed);
        }
      });
    } catch (error) {
      console.error(`Error scanning for projects: ${error.message}`);
    }

    return projects;
  }

  /**
   * Get master hook versions from the main installation
   */
  getMasterHookVersions() {
    const masterVersions = {};
    const hooksDir = path.join(this.masterHookPath, 'hooks');
    
    try {
      const hookDirs = fs.readdirSync(hooksDir).filter(dir => {
        const hookPath = path.join(hooksDir, dir);
        return fs.statSync(hookPath).isDirectory();
      });

      for (const hookDir of hookDirs) {
        const configPath = path.join(hooksDir, hookDir, 'config.json');
        if (fs.existsSync(configPath)) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            masterVersions[hookDir] = {
              version: config.version || '1.0.0',
              name: config.name || hookDir,
              description: config.description || '',
              events: config.events || [],
              lastModified: fs.statSync(configPath).mtime
            };
          } catch (error) {
            console.warn(`Warning: Could not parse config for ${hookDir}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading master hooks: ${error.message}`);
    }

    return masterVersions;
  }

  /**
   * Scan a single project for hook versions
   */
  scanProject(projectPath) {
    const projectResult = {
      path: projectPath,
      name: path.basename(path.dirname(projectPath)),
      hooks: {},
      issues: [],
      status: 'unknown'
    };

    try {
      const hooksDir = path.join(projectPath, 'hooks');
      
      if (!fs.existsSync(hooksDir)) {
        projectResult.issues.push('No hooks directory found');
        projectResult.status = 'missing_hooks';
        return projectResult;
      }

      const hookDirs = fs.readdirSync(hooksDir).filter(dir => {
        const hookPath = path.join(hooksDir, dir);
        return fs.statSync(hookPath).isDirectory();
      });

      for (const hookDir of hookDirs) {
        const configPath = path.join(hooksDir, hookDir, 'config.json');
        const indexPath = path.join(hooksDir, hookDir, 'index.js');
        
        if (fs.existsSync(configPath)) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            projectResult.hooks[hookDir] = {
              version: config.version || 'unknown',
              name: config.name || hookDir,
              hasIndex: fs.existsSync(indexPath),
              lastModified: fs.statSync(configPath).mtime,
              config: config
            };
          } catch (error) {
            projectResult.hooks[hookDir] = {
              version: 'parse_error',
              error: error.message,
              hasIndex: fs.existsSync(indexPath)
            };
          }
        } else if (fs.existsSync(indexPath)) {
          // Legacy hook without config
          projectResult.hooks[hookDir] = {
            version: 'legacy',
            name: hookDir,
            hasIndex: true,
            lastModified: fs.statSync(indexPath).mtime,
            legacy: true
          };
        }
      }

      projectResult.status = 'scanned';

    } catch (error) {
      projectResult.issues.push(`Scan error: ${error.message}`);
      projectResult.status = 'error';
    }

    return projectResult;
  }

  /**
   * Compare versions and identify issues
   */
  analyzeResults(masterVersions, projectResults) {
    const outdatedHooks = [];
    const missingHooks = [];
    
    for (const project of projectResults) {
      if (project.status !== 'scanned') continue;

      // Check for outdated hooks
      for (const [hookName, hookInfo] of Object.entries(project.hooks)) {
        if (masterVersions[hookName]) {
          const masterVersion = masterVersions[hookName].version;
          const projectVersion = hookInfo.version;
          
          if (projectVersion === 'legacy' || this.isVersionOutdated(projectVersion, masterVersion)) {
            outdatedHooks.push({
              project: project.path,
              projectName: project.name,
              hookName,
              currentVersion: projectVersion,
              latestVersion: masterVersion,
              masterInfo: masterVersions[hookName]
            });
          }
        }
      }

      // Check for missing hooks
      for (const [hookName, masterInfo] of Object.entries(masterVersions)) {
        if (!project.hooks[hookName]) {
          missingHooks.push({
            project: project.path,
            projectName: project.name,
            hookName,
            latestVersion: masterInfo.version,
            masterInfo
          });
        }
      }
    }

    return { outdatedHooks, missingHooks };
  }

  /**
   * Simple version comparison
   */
  isVersionOutdated(current, latest) {
    if (current === 'unknown' || current === 'legacy' || current === 'parse_error') {
      return true;
    }

    // Simple semantic version comparison
    const currentParts = current.split('.').map(n => parseInt(n) || 0);
    const latestParts = latest.split('.').map(n => parseInt(n) || 0);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const c = currentParts[i] || 0;
      const l = latestParts[i] || 0;
      
      if (c < l) return true;
      if (c > l) return false;
    }

    return false;
  }

  /**
   * Generate update commands for outdated hooks
   */
  generateUpdateCommands(outdatedHooks, missingHooks) {
    const commands = [];
    const projectGroups = {};

    // Group by project
    [...outdatedHooks, ...missingHooks].forEach(item => {
      if (!projectGroups[item.project]) {
        projectGroups[item.project] = {
          outdated: [],
          missing: []
        };
      }
      
      if (outdatedHooks.includes(item)) {
        projectGroups[item.project].outdated.push(item);
      } else {
        projectGroups[item.project].missing.push(item);
      }
    });

    // Generate commands for each project
    for (const [projectPath, issues] of Object.entries(projectGroups)) {
      const projectName = path.basename(path.dirname(projectPath));
      
      commands.push(`# Update hooks for project: ${projectName}`);
      commands.push(`cd "${projectPath}"`);
      
      if (issues.outdated.length > 0) {
        commands.push(`echo "Updating ${issues.outdated.length} outdated hooks..."`);
        for (const hook of issues.outdated) {
          commands.push(`cp -r "${this.masterHookPath}/hooks/${hook.hookName}" hooks/`);
        }
      }
      
      if (issues.missing.length > 0) {
        commands.push(`echo "Installing ${issues.missing.length} missing hooks..."`);
        for (const hook of issues.missing) {
          commands.push(`cp -r "${this.masterHookPath}/hooks/${hook.hookName}" hooks/`);
        }
      }
      
      commands.push('');
    }

    return commands;
  }

  /**
   * Print formatted results
   */
  printResults() {
    const { projects, outdatedHooks, missingHooks, summary } = this.scanResults;

    console.log('\n🔍 Global Hook Version Scanner Results');
    console.log('=====================================\n');

    // Summary
    console.log(`📊 Summary:`);
    console.log(`   • Projects scanned: ${projects.length}`);
    console.log(`   • Outdated hooks: ${outdatedHooks.length}`);
    console.log(`   • Missing hooks: ${missingHooks.length}`);
    console.log(`   • Master hook location: ${this.masterHookPath}\n`);

    // Projects overview
    console.log(`📁 Projects with rins_hooks:`);
    projects.forEach(project => {
      const hookCount = Object.keys(project.hooks).length;
      const status = project.status === 'scanned' ? '✅' : '❌';
      console.log(`   ${status} ${project.name} (${hookCount} hooks) - ${project.path}`);
      
      if (project.issues.length > 0) {
        project.issues.forEach(issue => {
          console.log(`      ⚠️  ${issue}`);
        });
      }
    });

    // Outdated hooks
    if (outdatedHooks.length > 0) {
      console.log(`\n🔄 Outdated Hooks (${outdatedHooks.length}):`);
      outdatedHooks.forEach(hook => {
        console.log(`   📦 ${hook.projectName}/${hook.hookName}`);
        console.log(`      Current: ${hook.currentVersion} → Latest: ${hook.latestVersion}`);
        console.log(`      Project: ${hook.project}`);
      });
    }

    // Missing hooks
    if (missingHooks.length > 0) {
      console.log(`\n➕ Missing Hooks (${missingHooks.length}):`);
      missingHooks.forEach(hook => {
        console.log(`   📦 ${hook.projectName} missing ${hook.hookName} v${hook.latestVersion}`);
        console.log(`      ${hook.masterInfo.description}`);
        console.log(`      Project: ${hook.project}`);
      });
    }

    // Update commands
    if (outdatedHooks.length > 0 || missingHooks.length > 0) {
      console.log(`\n🛠️  Auto-Update Commands:`);
      console.log('=====================================');
      const commands = this.generateUpdateCommands(outdatedHooks, missingHooks);
      commands.forEach(cmd => console.log(cmd));
      
      console.log(`\n💡 Quick update all:`);
      console.log(`   node "${path.join(this.masterHookPath, 'bin', 'global-hook-scanner.js')}" --update-all`);
    }

    if (outdatedHooks.length === 0 && missingHooks.length === 0) {
      console.log(`\n✅ All hooks are up to date across all projects!`);
    }
  }

  /**
   * Auto-update all outdated hooks
   */
  async autoUpdateAll() {
    const { outdatedHooks, missingHooks } = this.scanResults;
    const allUpdates = [...outdatedHooks, ...missingHooks];
    
    if (allUpdates.length === 0) {
      console.log('✅ No updates needed - all hooks are current!');
      return;
    }

    console.log(`🔄 Auto-updating ${allUpdates.length} hooks across ${new Set(allUpdates.map(h => h.project)).size} projects...\n`);

    const projectGroups = {};
    allUpdates.forEach(item => {
      if (!projectGroups[item.project]) {
        projectGroups[item.project] = [];
      }
      projectGroups[item.project].push(item);
    });

    for (const [projectPath, hooks] of Object.entries(projectGroups)) {
      const projectName = path.basename(path.dirname(projectPath));
      console.log(`📁 Updating ${projectName} (${hooks.length} hooks):`);

      for (const hook of hooks) {
        try {
          const sourcePath = path.join(this.masterHookPath, 'hooks', hook.hookName);
          const destPath = path.join(projectPath, 'hooks', hook.hookName);
          
          // Ensure destination directory exists
          if (!fs.existsSync(path.dirname(destPath))) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
          }

          // Copy hook
          execSync(`cp -r "${sourcePath}" "${path.dirname(destPath)}"`);
          
          console.log(`   ✅ ${hook.hookName}: ${hook.currentVersion || 'missing'} → ${hook.latestVersion}`);
        } catch (error) {
          console.log(`   ❌ ${hook.hookName}: Update failed - ${error.message}`);
        }
      }
      
      console.log('');
    }

    console.log('🎉 Auto-update complete!');
  }

  /**
   * Main scan execution
   */
  async scan() {
    console.log('🔍 Scanning for rins_hooks installations...');
    
    // Find all projects
    this.projectPaths = this.findRinsHooksProjects();
    console.log(`Found ${this.projectPaths.length} projects with rins_hooks`);

    // Get master versions
    const masterVersions = this.getMasterHookVersions();
    console.log(`Master installation has ${Object.keys(masterVersions).length} hooks`);

    // Scan each project
    const projectResults = [];
    for (const projectPath of this.projectPaths) {
      const result = this.scanProject(projectPath);
      projectResults.push(result);
    }

    // Analyze results
    const { outdatedHooks, missingHooks } = this.analyzeResults(masterVersions, projectResults);

    // Store results
    this.scanResults = {
      projects: projectResults,
      outdatedHooks,
      missingHooks,
      masterVersions,
      summary: {
        totalProjects: projectResults.length,
        totalOutdated: outdatedHooks.length,
        totalMissing: missingHooks.length
      }
    };

    return this.scanResults;
  }
}

// CLI execution
async function main() {
  const scanner = new GlobalHookScanner();
  
  const args = process.argv.slice(2);
  const shouldAutoUpdate = args.includes('--update-all') || args.includes('-u');

  try {
    await scanner.scan();
    
    if (shouldAutoUpdate) {
      await scanner.autoUpdateAll();
    } else {
      scanner.printResults();
    }
  } catch (error) {
    console.error(`Scanner error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = GlobalHookScanner;