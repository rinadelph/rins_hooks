#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Debug Git Hook for Claude Code
 * 
 * Features:
 * - Intercepts all tool calls to capture git command failures
 * - Uses PreToolUse with exit code 2 to show errors to the model
 * - Helps debug git hook issues by exposing actual error messages
 * - Only activates when git commands might be involved
 */

class DebugGitHook {
  constructor() {
    this.name = 'debug-git';
    this.version = '1.0.0';
    this.activityLogPath = path.join(process.cwd(), '.agent', 'session-activity', 'debug-hook.jsonl');
  }

  /**
   * Execute the debug git hook
   * @param {Object} input - Hook input from Claude Code
   */
  async execute(input) {
    try {
      // Only run on PostToolUse for file modification tools
      if (!input || input.hook_event_name !== 'PostToolUse') {
        return this.success();
      }

      const { tool_name, tool_input } = input;
      
      // Only intercept file modification tools that might trigger git hooks
      if (!this.isFileModificationTool(tool_name)) {
        return this.success();
      }

      // Check if we're in a git repository
      if (!this.isInGitRepo()) {
        return this.success();
      }

      // Give other git hooks a moment to complete
      await this.sleep(100);

      // Check for git issues that occurred during the tool execution
      const gitIssues = this.checkGitStatus();
      const recentGitErrors = this.checkRecentGitErrors();
      
      const allIssues = [...gitIssues, ...recentGitErrors];
      
      // Log the tool call and results for debugging
      this.logActivity({
        timestamp: new Date().toISOString(),
        event: 'PostToolUse_GitDebug',
        tool_name,
        tool_input: this.sanitizeInput(tool_input),
        session_id: input.session_id,
        git_issues: allIssues
      });
      
      if (allIssues.length > 0) {
        // Use exit code 2 to show the issues to the model
        const errorMessage = [
          '🔍 Git Debug Hook - Issues After Tool Execution:',
          '',
          ...allIssues,
          '',
          'These git issues occurred after the tool executed. This might help debug git hook failures.',
          `Tool that just executed: ${tool_name}`,
          `File: ${tool_input?.file_path || tool_input?.filePath || 'unknown'}`,
          '',
          'Debug info logged to: .agent/session-activity/debug-hook.jsonl'
        ].join('\n');

        console.error(errorMessage);
        process.exit(2); // Show to model and block further execution
      }

      return this.success();

    } catch (error) {
      // Log error for debugging but don't block tool execution
      this.logActivity({
        timestamp: new Date().toISOString(),
        event: 'DebugHook_Error',
        error: error.message,
        session_id: input?.session_id
      });
      
      return this.success();
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if this is a file modification tool
   */
  isFileModificationTool(toolName) {
    const fileTools = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
    return fileTools.includes(toolName);
  }

  /**
   * Check if we're in a git repository
   */
  isInGitRepo() {
    try {
      const { execSync } = require('child_process');
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check git status for potential issues
   */
  checkGitStatus() {
    const issues = [];
    
    try {
      const { execSync } = require('child_process');
      
      // Check for lock files
      const gitDir = path.join(process.cwd(), '.git');
      const lockFiles = [
        path.join(gitDir, 'index.lock'),
        path.join(gitDir, 'config.lock'),
        path.join(gitDir, 'HEAD.lock')
      ];

      for (const lockFile of lockFiles) {
        if (fs.existsSync(lockFile)) {
          const stats = fs.statSync(lockFile);
          const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
          issues.push(`⚠️  Git lock file exists: ${path.basename(lockFile)} (${ageMinutes.toFixed(1)} minutes old)`);
        }
      }

      // Check git status
      try {
        const status = execSync('git status --porcelain', { encoding: 'utf8', stdio: 'pipe' });
        const lines = status.trim().split('\n').filter(line => line.trim());
        
        if (lines.length > 10) {
          issues.push(`⚠️  Many uncommitted changes: ${lines.length} modified files`);
        }

        // Check for untracked files that might be problematic
        const untrackedCount = lines.filter(line => line.startsWith('??')).length;
        if (untrackedCount > 5) {
          issues.push(`⚠️  Many untracked files: ${untrackedCount} files`);
        }
      } catch (statusError) {
        issues.push(`⚠️  Git status check failed: ${statusError.message}`);
      }

      // Check if repository is ahead/behind remote
      try {
        const branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: 'pipe' }).trim();
        if (branch) {
          try {
            const ahead = execSync(`git rev-list --count ${branch}@{upstream}..HEAD`, { encoding: 'utf8', stdio: 'pipe' }).trim();
            if (parseInt(ahead) > 50) {
              issues.push(`ℹ️  Branch is ${ahead} commits ahead of upstream`);
            }
          } catch (upstreamError) {
            // No upstream or other issue - not critical
          }
        }
      } catch (branchError) {
        // Branch check failed - not critical
      }

    } catch (error) {
      issues.push(`⚠️  Git debug check failed: ${error.message}`);
    }

    return issues;
  }

  /**
   * Log activity for debugging
   */
  logActivity(data) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.activityLogPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Append to JSONL file
      fs.appendFileSync(this.activityLogPath, JSON.stringify(data) + '\n');
    } catch (error) {
      // Ignore logging errors
    }
  }

  /**
   * Sanitize input for logging (remove sensitive data)
   */
  sanitizeInput(input) {
    if (!input) return null;
    
    const sanitized = { ...input };
    
    // Remove content for privacy, keep structure
    if (sanitized.content) {
      sanitized.content = `[${sanitized.content.length} characters]`;
    }
    if (sanitized.new_string) {
      sanitized.new_string = `[${sanitized.new_string.length} characters]`;
    }
    if (sanitized.old_string) {
      sanitized.old_string = `[${sanitized.old_string.length} characters]`;
    }

    return sanitized;
  }

  /**
   * Return success result
   */
  success() {
    process.exit(0);
  }
}

// When run directly, parse input and execute
if (require.main === module) {
  const hook = new DebugGitHook();
  
  // Read input from stdin
  let inputData = '';
  process.stdin.on('data', chunk => {
    inputData += chunk;
  });
  
  process.stdin.on('end', async () => {
    try {
      const input = inputData ? JSON.parse(inputData) : {};
      await hook.execute(input);
    } catch (error) {
      console.error(`Debug git hook error: ${error.message}`);
      process.exit(1);
    }
  });
}

module.exports = DebugGitHook;