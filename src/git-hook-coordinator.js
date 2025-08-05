#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Git Hook Coordinator - Prevents conflicts between multiple git hooks
 * 
 * Features:
 * - Detects conflicting git hooks in Claude Code settings
 * - Provides automatic conflict resolution
 * - Ensures only one git hook runs per tool operation
 * - Smart hook prioritization and deduplication
 * - Validates hook configurations for git compatibility
 */

class GitHookCoordinator {
  constructor() {
    this.settingsPath = path.join(process.env.HOME, '.claude', 'settings.json');
    this.conflictTypes = {
      DUPLICATE_GIT_HOOKS: 'duplicate_git_hooks',
      STAGING_CONFLICTS: 'staging_conflicts',
      LOCK_CONFLICTS: 'lock_conflicts',
      VERSION_MISMATCHES: 'version_mismatches'
    };
    
    // Known git hooks and their priorities (higher = more preferred)
    this.gitHookPriority = {
      'git-agentmcp': 100,  // Most advanced, preferred
      'auto-commit': 50,    // Basic functionality
      'git-commit': 30      // Legacy
    };
  }

  /**
   * Scan Claude Code settings for git hook conflicts
   */
  async scanForConflicts() {
    const conflicts = [];
    
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return { conflicts: [], status: 'no_settings' };
      }

      const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      
      if (!settings.hooks || !settings.hooks.PostToolUse) {
        return { conflicts: [], status: 'no_hooks' };
      }

      // Check for duplicate git hooks in PostToolUse
      const postToolUseHooks = settings.hooks.PostToolUse;
      const gitHookConflicts = this.detectGitHookConflicts(postToolUseHooks);
      
      if (gitHookConflicts.length > 0) {
        conflicts.push({
          type: this.conflictTypes.DUPLICATE_GIT_HOOKS,
          severity: 'high',
          description: 'Multiple git hooks detected that will conflict',
          details: gitHookConflicts,
          autoFixable: true
        });
      }

      // Check for staging conflicts
      const stagingConflicts = this.detectStagingConflicts(postToolUseHooks);
      if (stagingConflicts.length > 0) {
        conflicts.push({
          type: this.conflictTypes.STAGING_CONFLICTS,
          severity: 'medium',
          description: 'Hooks may interfere with git staging',
          details: stagingConflicts,
          autoFixable: true
        });
      }

      return { 
        conflicts, 
        status: conflicts.length > 0 ? 'conflicts_detected' : 'clean',
        totalConflicts: conflicts.length
      };

    } catch (error) {
      return { 
        conflicts: [], 
        status: 'error', 
        error: error.message 
      };
    }
  }

  /**
   * Detect multiple git hooks that will conflict
   */
  detectGitHookConflicts(postToolUseHooks) {
    const gitHooks = [];
    const conflicts = [];

    for (const hookGroup of postToolUseHooks) {
      if (hookGroup.matcher && hookGroup.matcher.includes('Edit|Write|MultiEdit')) {
        for (const hook of hookGroup.hooks || []) {
          const hookName = this.extractHookName(hook.command);
          if (this.isGitHook(hookName)) {
            gitHooks.push({
              name: hookName,
              command: hook.command,
              matcher: hookGroup.matcher,
              priority: this.gitHookPriority[hookName] || 0
            });
          }
        }
      }
    }

    // If more than one git hook found, it's a conflict
    if (gitHooks.length > 1) {
      conflicts.push({
        conflictingHooks: gitHooks,
        recommended: gitHooks.sort((a, b) => b.priority - a.priority)[0],
        toRemove: gitHooks.sort((a, b) => b.priority - a.priority).slice(1)
      });
    }

    return conflicts;
  }

  /**
   * Detect staging conflicts (hooks that manipulate git staging)
   */
  detectStagingConflicts(postToolUseHooks) {
    const stagingHooks = [];
    
    for (const hookGroup of postToolUseHooks) {
      for (const hook of hookGroup.hooks || []) {
        const hookName = this.extractHookName(hook.command);
        if (this.manipulatesGitStaging(hookName)) {
          stagingHooks.push({
            name: hookName,
            command: hook.command
          });
        }
      }
    }

    return stagingHooks.length > 1 ? [{ hooks: stagingHooks }] : [];
  }

  /**
   * Extract hook name from command path
   */
  extractHookName(command) {
    const match = command.match(/hooks\/([^\/]+)\/index\.js/);
    return match ? match[1] : null;
  }

  /**
   * Check if hook is a git hook
   */
  isGitHook(hookName) {
    const gitHookPatterns = [
      'git-agentmcp',
      'auto-commit', 
      'git-commit',
      'commit-hook',
      'git-auto'
    ];
    
    return gitHookPatterns.some(pattern => 
      hookName && hookName.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if hook manipulates git staging
   */
  manipulatesGitStaging(hookName) {
    const stagingHooks = [
      'git-agentmcp',
      'auto-commit',
      'file-locking' // Can interfere with git operations
    ];
    
    return stagingHooks.includes(hookName);
  }

  /**
   * Automatically fix detected conflicts
   */
  async autoFixConflicts(conflicts) {
    const fixResults = [];

    try {
      const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      let modified = false;

      for (const conflict of conflicts) {
        if (!conflict.autoFixable) continue;

        switch (conflict.type) {
          case this.conflictTypes.DUPLICATE_GIT_HOOKS:
            const gitFixResult = this.fixDuplicateGitHooks(settings, conflict.details[0]);
            if (gitFixResult.success) {
              fixResults.push(gitFixResult);
              modified = true;
            }
            break;

          case this.conflictTypes.STAGING_CONFLICTS:
            const stagingFixResult = this.fixStagingConflicts(settings, conflict.details[0]);
            if (stagingFixResult.success) {
              fixResults.push(stagingFixResult);
              modified = true;
            }
            break;
        }
      }

      if (modified) {
        // Backup original settings
        const backupPath = `${this.settingsPath}.backup.${Date.now()}`;
        fs.copyFileSync(this.settingsPath, backupPath);

        // Write fixed settings
        fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
        
        fixResults.push({
          type: 'backup_created',
          message: `Original settings backed up to: ${backupPath}`
        });
      }

      return {
        success: modified,
        fixes: fixResults,
        backupCreated: modified
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        fixes: fixResults
      };
    }
  }

  /**
   * Fix duplicate git hooks by keeping the highest priority one
   */
  fixDuplicateGitHooks(settings, conflictDetails) {
    const { conflictingHooks, recommended, toRemove } = conflictDetails;
    
    try {
      let removedCount = 0;
      
      // Remove lower priority hooks from PostToolUse
      for (const hookGroup of settings.hooks.PostToolUse) {
        if (hookGroup.hooks) {
          const originalLength = hookGroup.hooks.length;
          hookGroup.hooks = hookGroup.hooks.filter(hook => {
            const hookName = this.extractHookName(hook.command);
            const shouldRemove = toRemove.some(tr => tr.name === hookName);
            if (shouldRemove) removedCount++;
            return !shouldRemove;
          });
        }
      }

      return {
        success: removedCount > 0,
        type: 'duplicate_git_hooks_fixed',
        message: `Removed ${removedCount} conflicting git hooks, kept: ${recommended.name}`,
        details: {
          kept: recommended.name,
          removed: toRemove.map(h => h.name),
          removedCount
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fix staging conflicts by optimizing hook order
   */
  fixStagingConflicts(settings, conflictDetails) {
    try {
      // Sort hooks by priority in PostToolUse to minimize conflicts
      for (const hookGroup of settings.hooks.PostToolUse) {
        if (hookGroup.hooks && hookGroup.hooks.length > 1) {
          hookGroup.hooks.sort((a, b) => {
            const aName = this.extractHookName(a.command);
            const bName = this.extractHookName(b.command);
            const aPriority = this.gitHookPriority[aName] || 0;
            const bPriority = this.gitHookPriority[bName] || 0;
            return bPriority - aPriority; // Higher priority first
          });
        }
      }

      return {
        success: true,
        type: 'staging_conflicts_fixed',
        message: 'Optimized hook execution order to minimize staging conflicts'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a comprehensive report
   */
  generateReport(scanResults, fixResults = null) {
    const report = {
      timestamp: new Date().toISOString(),
      status: scanResults.status,
      conflicts: scanResults.conflicts,
      recommendations: []
    };

    // Add recommendations based on conflicts
    for (const conflict of scanResults.conflicts) {
      switch (conflict.type) {
        case this.conflictTypes.DUPLICATE_GIT_HOOKS:
          report.recommendations.push({
            priority: 'high',
            action: 'Remove duplicate git hooks',
            description: 'Multiple git hooks will cause lock conflicts and failed commits',
            autoFixAvailable: true
          });
          break;

        case this.conflictTypes.STAGING_CONFLICTS:
          report.recommendations.push({
            priority: 'medium', 
            action: 'Optimize hook execution order',
            description: 'Hooks may interfere with git staging operations',
            autoFixAvailable: true
          });
          break;
      }
    }

    if (fixResults) {
      report.fixes = fixResults;
    }

    return report;
  }

  /**
   * Get recommended git hook setup
   */
  getRecommendedSetup() {
    return {
      recommended: {
        PostToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [
              {
                type: "command",
                command: "node \"/path/to/hooks/git-agentmcp/index.js\"",
                timeout: 30,
                description: "Advanced git commits with PID tracking and conflict resolution"
              },
              {
                type: "command", 
                command: "node \"/path/to/hooks/debug-git/index.js\"",
                timeout: 10,
                description: "Debug git issues and show errors to model"
              }
            ]
          }
        ]
      },
      explanation: {
        why: "git-agentmcp provides comprehensive git functionality with built-in conflict resolution",
        avoided: "Removed auto-commit to prevent duplicate commits and lock conflicts",
        benefits: [
          "Single git hook eliminates conflicts",
          "Advanced PID tracking for easy reverts", 
          "Built-in lock conflict resolution",
          "No co-author attribution spam"
        ]
      }
    };
  }
}

// CLI interface
async function main() {
  const coordinator = new GitHookCoordinator();
  const args = process.argv.slice(2);

  try {
    if (args.includes('--scan') || args.length === 0) {
      console.log('🔍 Scanning for git hook conflicts...\n');
      const scanResults = await coordinator.scanForConflicts();
      
      if (scanResults.status === 'clean') {
        console.log('✅ No git hook conflicts detected!');
        return;
      }

      const report = coordinator.generateReport(scanResults);
      
      console.log(`📊 Status: ${scanResults.status}`);
      console.log(`⚠️  Conflicts found: ${scanResults.totalConflicts}\n`);

      // Show conflicts
      for (const conflict of scanResults.conflicts) {
        console.log(`🚨 ${conflict.description}`);
        console.log(`   Severity: ${conflict.severity}`);
        console.log(`   Auto-fixable: ${conflict.autoFixable ? '✅ Yes' : '❌ No'}\n`);
      }

      // Show recommendations
      if (report.recommendations.length > 0) {
        console.log('💡 Recommendations:');
        for (const rec of report.recommendations) {
          console.log(`   ${rec.priority === 'high' ? '🔴' : '🟡'} ${rec.action}`);
          console.log(`      ${rec.description}`);
        }
        console.log('');
      }

      if (scanResults.conflicts.some(c => c.autoFixable)) {
        console.log('🛠️  Run with --fix to automatically resolve conflicts');
      }
    }

    if (args.includes('--fix')) {
      console.log('🔧 Auto-fixing git hook conflicts...\n');
      
      const scanResults = await coordinator.scanForConflicts();
      if (scanResults.conflicts.length === 0) {
        console.log('✅ No conflicts to fix!');
        return;
      }

      const fixResults = await coordinator.autoFixConflicts(scanResults.conflicts);
      
      if (fixResults.success) {
        console.log('✅ Conflicts successfully resolved!');
        console.log(`📝 Applied ${fixResults.fixes.length} fixes:\n`);
        
        for (const fix of fixResults.fixes) {
          console.log(`   ✅ ${fix.message}`);
        }
        
        if (fixResults.backupCreated) {
          console.log('\n💾 Original settings have been backed up');
        }
      } else {
        console.log('❌ Failed to fix conflicts:', fixResults.error);
      }
    }

    if (args.includes('--recommend')) {
      console.log('💡 Recommended Git Hook Setup:\n');
      const setup = coordinator.getRecommendedSetup();
      
      console.log('📋 Configuration:');
      console.log(JSON.stringify(setup.recommended, null, 2));
      
      console.log('\n🎯 Why this setup:');
      console.log(`   ${setup.explanation.why}`);
      
      console.log('\n✅ Benefits:');
      for (const benefit of setup.explanation.benefits) {
        console.log(`   • ${benefit}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = GitHookCoordinator;