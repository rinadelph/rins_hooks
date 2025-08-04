#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Git Agent-MCP Hook for Claude Code - Multi-Agent Git Integration
 *
 * Features:
 * - PID tracking in commit messages for easy revert
 * - Session-based agent identification
 * - Agent-MCP .agent directory integration
 * - Multi-agent coordination and activity logging
 * - Built-in git hook conflict detection and coordination
 * - Direct Claude Code compliance (no HookBase dependency)
 */

// ========================================
// GIT HOOK COORDINATION SYSTEM
// ========================================

/**
 * Git Hook Coordinator - Embedded conflict prevention
 * Prevents multiple git hooks from running simultaneously
 */
class GitHookCoordinator {
  constructor() {
    this.hookName = 'git-agentmcp';
    this.priority = 100; // Highest priority git hook
    this.lockFile = path.join(process.cwd(), '.agent', 'git-hook.lock');
    this.settingsPath = path.join(process.env.HOME, '.claude', 'settings.json');
    
    // Known git hooks and their priorities
    this.gitHookPriority = {
      'git-agentmcp': 100,  // This hook - highest priority
      'auto-commit': 50,    // Basic functionality
      'git-commit': 30      // Legacy
    };
  }

  /**
   * Check if this hook should run or defer to another
   */
  async shouldRunHook() {
    try {
      // Check for active git hook lock
      if (this.isGitHookLocked()) {
        console.log(`Git hook coordination: Another git hook is running, deferring...`);
        return false;
      }

      // Quick check for obvious conflicts in settings
      const conflictingHooks = this.detectQuickConflicts();
      if (conflictingHooks.length > 0) {
        const higherPriorityExists = conflictingHooks.some(h => 
          this.gitHookPriority[h] > this.priority
        );
        
        if (higherPriorityExists) {
          console.log(`Git hook coordination: Higher priority hook detected, deferring...`);
          return false;
        }
      }

      // Create lock to indicate this hook is running
      this.createGitHookLock();
      return true;

    } catch (error) {
      // If coordination fails, default to running (safe fallback)
      console.warn(`Git hook coordination warning: ${error.message}`);
      return true;
    }
  }

  /**
   * Check if another git hook is currently running
   */
  isGitHookLocked() {
    try {
      if (!fs.existsSync(this.lockFile)) {
        return false;
      }

      const stats = fs.statSync(this.lockFile);
      const ageMs = Date.now() - stats.mtime.getTime();
      
      // If lock is older than 2 minutes, consider it stale
      if (ageMs > 120000) {
        fs.unlinkSync(this.lockFile);
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create lock file to indicate this hook is running
   */
  createGitHookLock() {
    try {
      const lockDir = path.dirname(this.lockFile);
      if (!fs.existsSync(lockDir)) {
        fs.mkdirSync(lockDir, { recursive: true });
      }

      fs.writeFileSync(this.lockFile, JSON.stringify({
        hook: this.hookName,
        pid: process.pid,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      // Ignore lock creation errors
    }
  }

  /**
   * Release the git hook lock
   */
  releaseGitHookLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
    } catch (error) {
      // Ignore lock cleanup errors
    }
  }

  /**
   * Quick detection of conflicting git hooks in settings
   */
  detectQuickConflicts() {
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return [];
      }

      const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      const gitHooks = [];

      if (settings.hooks && settings.hooks.PostToolUse) {
        for (const hookGroup of settings.hooks.PostToolUse) {
          if (hookGroup.matcher && hookGroup.matcher.includes('Edit|Write|MultiEdit')) {
            for (const hook of hookGroup.hooks || []) {
              const hookName = this.extractHookName(hook.command);
              if (this.isGitHook(hookName) && hookName !== this.hookName) {
                gitHooks.push(hookName);
              }
            }
          }
        }
      }

      return gitHooks;
    } catch (error) {
      return [];
    }
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
}

// Configuration
const CONFIG = {
  enabled: true,
  lockTimeout: 600, // 10 minutes
  commitMessageTemplate: `{{action}}: {{toolName}} modified {{fileName}}

Session: {{sessionId}}
PID: {{pid}} (parent: {{parentPid}})
Tmux: {{tmuxInfo}}
Timestamp: {{timestamp}}
File: {{filePath}}
Tool: {{toolName}}

# Revert: git log --grep="PID: {{pid}}"`,
  excludePatterns: [
    /\.log$/,
    /\.tmp$/,
    /\.temp$/,
    /\.lock$/,
    /\.env/,
    /\.git\//,
    /\.agent/,
    /node_modules\//,
    /\.pyc$/,
    /__pycache__\//
  ],
  skipEmptyCommits: true,
  maxCommitMessageLength: 800
};

// Utility functions
function ensureAgentDirectory() {
  const agentDir = path.join(process.cwd(), '.agent');

  try {
    if (!fs.existsSync(agentDir)) {
      // Create .agent directory with standard structure
      fs.mkdirSync(agentDir, { recursive: true });

      // Create subdirectories that don't conflict with Agent-MCP
      const subdirs = ['session-activity'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(agentDir, subdir);
        if (!fs.existsSync(subdirPath)) {
          fs.mkdirSync(subdirPath, { recursive: true });
        }
      }

      // Create minimal config if none exists (compatible with Agent-MCP)
      const configPath = path.join(agentDir, 'config.json');
      if (!fs.existsSync(configPath)) {
        const minimalConfig = {
          project_name: path.basename(process.cwd()),
          created_at: new Date().toISOString(),
          created_by: 'rins_hooks_auto_commit',
          hook_version: '1.0.0'
        };
        fs.writeFileSync(configPath, JSON.stringify(minimalConfig, null, 2));
      }
    }

    return true;
  } catch (error) {
    // Silent failure - don't block git operations
    return false;
  }
}

function extractFilePath(toolInput) {
  return toolInput.file_path ||
         toolInput.filePath ||
         (toolInput.edits && toolInput.edits[0] && toolInput.edits[0].file_path) ||
         null;
}

function extractAgentId(input) {
  return input.session_id || `session-${process.ppid}`;
}

function shouldExcludeFile(filePath) {
  const fileName = path.basename(filePath);
  const relativePath = path.relative(process.cwd(), filePath);
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // Exclude files outside the git repository
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return true;
  }

  return CONFIG.excludePatterns.some(pattern => {
    const regex = new RegExp(pattern.source.replace(/\*\*/g, '.*').replace(/\*/g, '[^/\\\\]*'));
    return regex.test(fileName) || regex.test(normalizedPath);
  });
}

function generateCommitMessage(toolName, filePath, input) {
  const fileName = path.basename(filePath);
  const agentId = extractAgentId(input);
  const timestamp = new Date().toISOString();

  // Determine action based on tool
  let action = 'feat';
  if (toolName === 'Edit') action = 'feat';
  else if (toolName === 'Write') action = 'feat';
  else if (toolName === 'MultiEdit') action = 'feat';

  let message = CONFIG.commitMessageTemplate
    .replace(/\{\{action\}\}/g, action)
    .replace(/\{\{toolName\}\}/g, toolName)
    .replace(/\{\{fileName\}\}/g, fileName)
    .replace(/\{\{filePath\}\}/g, filePath)
    .replace(/\{\{sessionId\}\}/g, agentId)
    .replace(/\{\{pid\}\}/g, process.pid)
    .replace(/\{\{parentPid\}\}/g, process.ppid)
    .replace(/\{\{timestamp\}\}/g, timestamp);

  // Truncate if too long
  if (message.length > CONFIG.maxCommitMessageLength) {
    message = `${message.substring(0, CONFIG.maxCommitMessageLength - 3)}...`;
  }

  return message;
}

function runGitCommand(args, retries = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attemptCommand = (attempt) => {
      const git = spawn('git', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          const errorMessage = stderr.trim();
          const stdoutMessage = stdout.trim();
          
          // Enhanced error details
          const fullError = [
            `Git command failed (exit code ${code})`,
            errorMessage ? `stderr: ${errorMessage}` : '',
            stdoutMessage ? `stdout: ${stdoutMessage}` : '',
            `command: git ${args.join(' ')}`
          ].filter(Boolean).join('\n');
          
          // Check for git lock conflicts
          if (isGitLockError(errorMessage) && attempt < retries) {
            console.warn(`Git lock detected (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
            
            // Try to clean up stale locks
            cleanupGitLocks();
            
            // Retry after delay
            setTimeout(() => attemptCommand(attempt + 1), delay);
          } else {
            reject(new Error(fullError));
          }
        }
      });

      git.on('error', (error) => {
        if (attempt < retries && isLockRelatedError(error)) {
          console.warn(`Git command error (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
          setTimeout(() => attemptCommand(attempt + 1), delay);
        } else {
          reject(error);
        }
      });
    };

    attemptCommand(1);
  });
}

/**
 * Check if the error is related to git locks
 */
function isGitLockError(errorMessage) {
  const lockPatterns = [
    'index.lock',
    'config.lock', 
    'HEAD.lock',
    'refs/heads/',
    'Another git process seems to be running',
    'Unable to create',
    'File exists'
  ];
  
  return lockPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if error is lock-related
 */
function isLockRelatedError(error) {
  return error.message && isGitLockError(error.message);
}

/**
 * Clean up stale git lock files
 */
function cleanupGitLocks() {
  try {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return;

    // Common lock files that can be safely removed if stale
    const lockFiles = [
      path.join(gitDir, 'index.lock'),
      path.join(gitDir, 'config.lock'),
      path.join(gitDir, 'HEAD.lock')
    ];

    lockFiles.forEach(lockFile => {
      if (fs.existsSync(lockFile)) {
        try {
          // Check if lock file is old (more than 60 seconds)
          const stats = fs.statSync(lockFile);
          const ageMs = Date.now() - stats.mtime.getTime();
          
          if (ageMs > 60000) { // 60 seconds
            fs.unlinkSync(lockFile);
            console.log(`Removed stale git lock: ${path.basename(lockFile)}`);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
          console.warn(`Could not clean up ${lockFile}: ${cleanupError.message}`);
        }
      }
    });
  } catch (error) {
    // Ignore cleanup errors  
    console.warn(`Git lock cleanup failed: ${error.message}`);
  }
}

async function isGitRepository() {
  try {
    await runGitCommand(['rev-parse', '--git-dir']);
    return true;
  } catch (error) {
    return false;
  }
}

async function hasChangesToCommit() {
  try {
    const status = await runGitCommand(['status', '--porcelain']);
    return status.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function logCommitActivity(agentId, filePath, commitHash, toolName) {
  try {
    ensureAgentDirectory();

    const activityDir = path.join(process.cwd(), '.agent', 'session-activity');
    const logFile = path.join(activityDir, 'git-commits.jsonl');

    const logEntry = {
      timestamp: new Date().toISOString(),
      session_id: agentId,
      pid: process.pid,
      parent_pid: process.ppid,
      commit_hash: commitHash,
      file_path: filePath,
      tool_name: toolName,
      working_directory: process.cwd()
    };

    fs.appendFileSync(logFile, `${JSON.stringify(logEntry)}\n`);
  } catch (error) {
    // Silent failure - don't block operations
  }
}

// Parse input from stdin
function parseInput() {
  return new Promise((resolve, reject) => {
    let input = '';

    process.stdin.on('data', (chunk) => {
      input += chunk.toString();
    });

    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(input);
        resolve(data);
      } catch (error) {
        reject(new Error(`Invalid JSON input: ${error.message}`));
      }
    });

    process.stdin.on('error', reject);
  });
}

// Main execution function
async function main() {
  const coordinator = new GitHookCoordinator();
  
  try {
    // Parse input from Claude Code
    const input = await parseInput();
    const { tool_name, tool_input } = input;

    // Check if this hook should run (coordination check)
    const shouldRun = await coordinator.shouldRunHook();
    if (!shouldRun) {
      console.log('Git hook coordination: Deferring to higher priority or already running hook');
      process.exit(0);
    }

    // Only handle file modification tools
    if (!['Edit', 'Write', 'MultiEdit'].includes(tool_name)) {
      process.exit(0);
    }

    const filePath = extractFilePath(tool_input);
    if (!filePath) {
      process.exit(0);
    }

    // Check if we're in a git repository
    if (!await isGitRepository()) {
      console.log('Not in a git repository, skipping commit');
      process.exit(0);
    }

    // Check if file should be excluded
    if (shouldExcludeFile(filePath)) {
      console.log(`File excluded from auto-commit: ${filePath}`);
      process.exit(0);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      process.exit(1);
    }

    // Add file to git with verification
    await runGitCommand(['add', filePath]);

    // Verify the file was actually staged
    const stagedFiles = await runGitCommand(['diff', '--cached', '--name-only']);
    const stagedFilesList = stagedFiles.trim().split('\n').filter(line => line.trim());
    const relativePath = path.relative(process.cwd(), filePath);
    
    if (!stagedFilesList.includes(relativePath) && !stagedFilesList.includes(filePath)) {
      // File wasn't staged, try force add
      console.warn(`File ${relativePath} not staged, attempting force add...`);
      await runGitCommand(['add', '--force', filePath]);
      
      // Check again
      const restagedFiles = await runGitCommand(['diff', '--cached', '--name-only']);
      const restagedFilesList = restagedFiles.trim().split('\n').filter(line => line.trim());
      if (!restagedFilesList.includes(relativePath) && !restagedFilesList.includes(filePath)) {
        console.log(`File ${relativePath} has no changes to commit`);
        process.exit(0);
      }
    }

    // Check if there are changes to commit
    if (CONFIG.skipEmptyCommits && !await hasChangesToCommit()) {
      console.log('No changes to commit');
      process.exit(0);
    }

    // Generate commit message
    const commitMessage = generateCommitMessage(tool_name, filePath, input);

    // Create commit
    await runGitCommand(['commit', '-m', commitMessage]);

    // Get commit hash for logging
    const commitHash = await runGitCommand(['rev-parse', 'HEAD']);

    // Log commit activity to .agent directory
    logCommitActivity(extractAgentId(input), filePath, commitHash.trim(), tool_name);

    console.log(`Successfully committed ${path.basename(filePath)} with PID tracking`);
    
    // Release git hook lock
    coordinator.releaseGitHookLock();
    process.exit(0);

  } catch (error) {
    console.error(`Auto-commit failed: ${error.message}`);
    
    // Always release lock on error
    coordinator.releaseGitHookLock();
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = { main, parseInput, extractAgentId };
