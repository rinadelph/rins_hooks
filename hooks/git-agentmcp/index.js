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
        return { shouldRun: false, reason: 'Another git hook is running, deferring...' };
      }

      // Quick check for obvious conflicts in settings
      const conflictingHooks = this.detectQuickConflicts();
      if (conflictingHooks.length > 0) {
        const higherPriorityExists = conflictingHooks.some(h => 
          this.gitHookPriority[h] > this.priority
        );
        
        if (higherPriorityExists) {
          return { shouldRun: false, reason: 'Higher priority hook detected, deferring...' };
        }
      }

      // Create lock to indicate this hook is running
      this.createGitHookLock();
      return { shouldRun: true };

    } catch (error) {
      // If coordination fails, default to running (safe fallback)
      return { shouldRun: true, reason: `Git hook coordination warning: ${error.message}` };
    }
  }

  isGitHookLocked() {
    try {
      if (!fs.existsSync(this.lockFile)) return false;
      const stats = fs.statSync(this.lockFile);
      const ageMs = Date.now() - stats.mtime.getTime();
      if (ageMs > 120000) {
        fs.unlinkSync(this.lockFile);
        return false;
      }
      return true;
    } catch { return false; }
  }

  createGitHookLock() {
    try {
      const lockDir = path.dirname(this.lockFile);
      fs.mkdirSync(lockDir, { recursive: true });
      fs.writeFileSync(this.lockFile, JSON.stringify({ hook: this.hookName, pid: process.pid, timestamp: new Date().toISOString() }));
    } catch {}
  }

  releaseGitHookLock() {
    try {
      if (fs.existsSync(this.lockFile)) fs.unlinkSync(this.lockFile);
    } catch {}
  }

  detectQuickConflicts() {
    try {
      if (!fs.existsSync(this.settingsPath)) return [];
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
    } catch { return []; }
  }

  extractHookName(command) {
    const match = command.match(/hooks\/([^\/]+)\/index\.js/);
    return match ? match[1] : null;
  }

  isGitHook(hookName) {
    const gitHookPatterns = ['git-agentmcp', 'auto-commit', 'git-commit', 'commit-hook', 'git-auto'];
    return gitHookPatterns.some(pattern => hookName && hookName.toLowerCase().includes(pattern.toLowerCase()));
  }
}

// Configuration
const CONFIG = {
  commitMessageTemplate: `{{action}}: {{toolName}} modified {{fileName}}\n\nSession: {{sessionId}}\nPID: {{pid}} (parent: {{parentPid}})\nTmux: {{tmuxInfo}}\nTimestamp: {{timestamp}}\nFile: {{filePath}}\nTool: {{toolName}}\n\n# Revert: git log --grep="PID: {{pid}}"`, 
  excludePatterns: [/.log$/, /.tmp$/, /.temp$/, /.lock$/, /.env/, /.git\//, /.agent/, /node_modules\//, /.pyc$/, /__pycache__\//],
  maxCommitMessageLength: 800
};

// Utility functions
function ensureAgentDirectory() {
  try {
    const agentDir = path.join(process.cwd(), '.agent');
    fs.mkdirSync(agentDir, { recursive: true });
    const subdirs = ['session-activity'];
    subdirs.forEach(subdir => fs.mkdirSync(path.join(agentDir, subdir), { recursive: true }));
    const configPath = path.join(agentDir, 'config.json');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({ project_name: path.basename(process.cwd()), created_at: new Date().toISOString(), created_by: 'rapala_git_hook', hook_version: '1.0.1' }, null, 2));
    }
    return true;
  } catch { return false; }
}

function extractFilePath(toolInput) {
  return toolInput.file_path || toolInput.filePath || (toolInput.edits && toolInput.edits[0] && toolInput.edits[0].file_path) || null;
}

function extractAgentId(input) {
  return input.session_id || `session-${process.ppid}`;
}

function getTmuxInfo() {
  try {
    if (process.env.TMUX) {
      const { execSync } = require('child_process');
      return execSync('tmux display-message -p "#S:#I:#W.#P"', { encoding: 'utf8', stdio: 'pipe', timeout: 500 }).trim();
    }
    return 'no-tmux';
  } catch { return 'tmux-unknown'; }
}

function shouldExcludeFile(filePath) {
  const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) return true;
  return CONFIG.excludePatterns.some(pattern => pattern.test(normalizedPath));
}

function generateCommitMessage(toolName, filePath, input) {
  const action = (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') ? 'feat' : 'chore';
  let message = CONFIG.commitMessageTemplate
    .replace(/\{\{action\}\}/g, action)
    .replace(/\{\{toolName\}\}/g, toolName)
    .replace(/\{\{fileName\}\}/g, path.basename(filePath))
    .replace(/\{\{filePath\}\}/g, filePath)
    .replace(/\{\{sessionId\}\}/g, extractAgentId(input))
    .replace(/\{\{pid\}\}/g, process.pid)
    .replace(/\{\{parentPid\}\}/g, process.ppid)
    .replace(/\{\{tmuxInfo\}\}/g, getTmuxInfo())
    .replace(/\{\{timestamp\}\}/g, new Date().toISOString());
  return message.length > CONFIG.maxCommitMessageLength ? `${message.substring(0, CONFIG.maxCommitMessageLength - 3)}...` : message;
}

function runGitCommand(args) {
  return new Promise((resolve, reject) => {
    const git = spawn('git', args, { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    git.stdout.on('data', data => stdout += data);
    git.stderr.on('data', data => stderr += data);
    git.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Git command failed (exit code ${code}): git ${args.join(' ')}\n${stderr.trim()}`));
    });
    git.on('error', err => reject(err));
  });
}

async function isGitRepository() {
  try {
    await runGitCommand(['rev-parse', '--git-dir']);
    return true;
  } catch { return false; }
}

function logCommitActivity(agentId, filePath, commitHash, toolName) {
  try {
    ensureAgentDirectory();
    const logFile = path.join(process.cwd(), '.agent', 'session-activity', 'git-commits.jsonl');
    const logEntry = { timestamp: new Date().toISOString(), session_id: agentId, pid: process.pid, commit_hash: commitHash, file_path: filePath, tool_name: toolName };
    fs.appendFileSync(logFile, `${JSON.stringify(logEntry)}\n`);
  } catch {}
}

function parseInput() {
  return new Promise(resolve => {
    let input = '';
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(input));
      } catch {
        resolve({ tool_name: 'unknown', tool_input: {} });
      }
    });
  });
}

function outputResult(result) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

// Main execution function
async function main() {
  const coordinator = new GitHookCoordinator();
  try {
    const input = await parseInput();
    const { tool_name, tool_input } = input;

    const coordination = await coordinator.shouldRunHook();
    if (!coordination.shouldRun) {
      return outputResult({ success: true, data: { message: `Git hook deferred: ${coordination.reason}` } });
    }

    if (!['Edit', 'Write', 'MultiEdit'].includes(tool_name)) {
      return outputResult({ success: true, data: { message: 'Tool not applicable for git-agentmcp.' } });
    }

    const filePath = extractFilePath(tool_input);
    if (!filePath || !(await isGitRepository()) || shouldExcludeFile(filePath) || !fs.existsSync(filePath)) {
      return outputResult({ success: true, data: { message: 'Commit skipped due to file path, git repo status, or exclusion.' } });
    }

    const relativePath = path.relative(process.cwd(), filePath);
    const diffOutput = await runGitCommand(['diff', '--', relativePath]);
    const statusOutput = await runGitCommand(['status', '--porcelain', '--', relativePath]);

    if (!diffOutput && !statusOutput) {
      return outputResult({ success: true, data: { message: `No changes to commit for ${relativePath}` } });
    }

    await runGitCommand(['add', filePath]);
    const stagedFiles = await runGitCommand(['diff', '--cached', '--name-only']);
    if (!stagedFiles.includes(relativePath.replace(/\\/g, '/'))) {
        return outputResult({ success: true, data: { message: `No changes staged for ${relativePath}` } });
    }

    const commitMessage = generateCommitMessage(tool_name, filePath, input);
    await runGitCommand(['commit', '-m', commitMessage]);
    const commitHash = await runGitCommand(['rev-parse', 'HEAD']);
    logCommitActivity(extractAgentId(input), filePath, commitHash, tool_name);

    outputResult({ success: true, data: { message: `Successfully committed ${path.basename(filePath)}`, commitHash } });

  } catch (error) {
    outputResult({ success: false, error: `Auto-commit failed: ${error.message}` });
  } finally {
    coordinator.releaseGitHookLock();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };