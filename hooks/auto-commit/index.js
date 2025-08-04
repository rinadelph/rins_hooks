#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const HookBase = require('../../src/hook-base');

/**
 * Check if higher priority git hook exists and should handle this
 */
function shouldDeferToHigherPriorityHook() {
  try {
    const settingsPath = path.join(process.env.HOME, '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) return false;

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!settings.hooks || !settings.hooks.PostToolUse) return false;

    // Check if git-agentmcp is configured (higher priority)
    for (const hookGroup of settings.hooks.PostToolUse) {
      for (const hook of hookGroup.hooks || []) {
        if (hook.command && hook.command.includes('git-agentmcp')) {
          console.log('Auto-commit: Deferring to git-agentmcp (higher priority)');
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    return false; // If coordination fails, run anyway
  }
}

class AutoCommitHook extends HookBase {
  constructor(config = {}) {
    super('auto-commit', config);
    this.toolLogFile = path.join(process.cwd(), 'claude-tool-events.log');
  }

  getDefaultConfig() {
    return {
      enabled: true,
      matcher: 'Edit|Write|MultiEdit',
      timeout: 30,
      description: 'Automatically commit file changes with contextual messages',
      commitMessageTemplate: 'Auto-commit: {{toolName}} modified {{fileName}}\n\n- File: {{filePath}}\n- Tool: {{toolName}}\n- Session: {{sessionId}}',
      excludePatterns: [
        '*.log', '*.tmp', '*.temp', '.env*', '*.key', '*.pem', '*.p12', '*.pfx',
        'node_modules/**', '.git/**', '*.pyc', '__pycache__/**'
      ],
      skipEmptyCommits: true,
      addAllFiles: false,
      branchRestrictions: [],
      maxCommitMessageLength: 500
    };
  }

  logToolEvent(eventType, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      eventType,
      toolName: data.toolName || data.tool_name,
      parameters: Object.keys(data.parameters || data.tool_input || {}),
      sessionId: data.sessionId || data.session_id,
      fullDataKeys: Object.keys(data)
    };

    try {
      fs.appendFileSync(this.toolLogFile, `${JSON.stringify(logEntry, null, 2)}\n\n`);
    } catch (error) {
      console.warn(`Failed to log tool event: ${error.message}`);
    }
  }

  async execute(input) {
    try {
      const { tool_name, tool_input, session_id } = input;

      // Extract file path from tool input
      const filePath = tool_input.file_path || tool_input.filePath;

      if (!filePath) {
        return this.error('No file path found in tool input');
      }

      // Check if we're in a git repository
      if (!await this.isGitRepository()) {
        return this.success({ message: 'Not in a git repository, skipping commit' });
      }

      // Check if file should be excluded
      if (this.shouldExcludeFile(filePath)) {
        return this.success({ message: `File excluded from auto-commit: ${filePath}` });
      }

      // Check branch restrictions
      if (await this.isBranchRestricted()) {
        return this.success({ message: 'Current branch is restricted from auto-commits' });
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return this.error(`File does not exist: ${filePath}`);
      }

      // Add file to git with verification
      await this.runGitCommand(['add', filePath]);

      // Verify the file was actually staged
      const stagedFiles = await this.runGitCommand(['diff', '--cached', '--name-only']);
      const relativePath = path.relative(process.cwd(), filePath);
      
      if (!stagedFiles.includes(relativePath) && !stagedFiles.includes(filePath)) {
        // File wasn't staged, try force add
        console.warn(`File ${relativePath} not staged, attempting force add...`);
        await this.runGitCommand(['add', '--force', filePath]);
        
        // Check again
        const restagedFiles = await this.runGitCommand(['diff', '--cached', '--name-only']);
        if (!restagedFiles.includes(relativePath) && !restagedFiles.includes(filePath)) {
          return this.success({ message: `File ${relativePath} has no changes to commit` });
        }
      }

      // Check if there are changes to commit
      if (this.config.skipEmptyCommits && !await this.hasChangesToCommit()) {
        return this.success({ message: 'No changes to commit' });
      }

      // Generate commit message
      const commitMessage = this.generateCommitMessage(tool_name, filePath, session_id);

      // Create commit
      await this.runGitCommand(['commit', '-m', commitMessage]);

      return this.success({
        message: `Successfully committed ${path.basename(filePath)}`,
        filePath: filePath,
        commitMessage: commitMessage
      });

    } catch (error) {
      // Enhanced error reporting with context
      const errorDetails = {
        message: error.message,
        filePath: input.tool_input?.file_path || input.tool_input?.filePath,
        toolName: input.tool_name,
        cwd: process.cwd()
      };
      
      // Log detailed error for debugging
      console.error('Auto-commit detailed error:', JSON.stringify(errorDetails, null, 2));
      
      return this.error(`Auto-commit failed: ${error.message || 'Unknown error'}`);
    }
  }

  async isGitRepository() {
    try {
      await this.runGitCommand(['rev-parse', '--git-dir']);
      return true;
    } catch (error) {
      return false;
    }
  }

  shouldExcludeFile(filePath) {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(process.cwd(), filePath);

    // Normalize paths to use forward slashes for consistent pattern matching
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');

    return this.config.excludePatterns.some(pattern => {
      // Simple glob-like matching - use [^/\\] to match both forward and back slashes
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/\\\\]*'));
      return regex.test(fileName) || regex.test(normalizedRelativePath);
    });
  }

  async isBranchRestricted() {
    if (this.config.branchRestrictions.length === 0) {
      return false;
    }

    try {
      const currentBranch = await this.runGitCommand(['branch', '--show-current']);
      return this.config.branchRestrictions.includes(currentBranch.trim());
    } catch (error) {
      return false;
    }
  }

  async hasChangesToCommit() {
    try {
      const status = await this.runGitCommand(['status', '--porcelain']);
      return status.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  generateCommitMessage(toolName, filePath, sessionId) {
    const fileName = path.basename(filePath);
    const template = this.config.commitMessageTemplate;

    let message = template
      .replace(/\{\{toolName\}\}/g, toolName)
      .replace(/\{\{fileName\}\}/g, fileName)
      .replace(/\{\{filePath\}\}/g, filePath)
      .replace(/\{\{sessionId\}\}/g, sessionId || 'unknown');

    // Truncate if too long
    if (message.length > this.config.maxCommitMessageLength) {
      message = `${message.substring(0, this.config.maxCommitMessageLength - 3)}...`;
    }

    return message;
  }

  runGitCommand(args, retries = 3, delay = 1000) {
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
            if (this.isGitLockError(errorMessage) && attempt < retries) {
              console.warn(`Git lock detected (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
              
              // Try to clean up stale locks
              this.cleanupGitLocks();
              
              // Retry after delay
              setTimeout(() => attemptCommand(attempt + 1), delay);
            } else {
              reject(new Error(fullError));
            }
          }
        });

        git.on('error', (error) => {
          if (attempt < retries && this.isLockRelatedError(error)) {
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
  isGitLockError(errorMessage) {
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
  isLockRelatedError(error) {
    return error.message && this.isGitLockError(error.message);
  }

  /**
   * Clean up stale git lock files
   */
  cleanupGitLocks() {
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
}

// If called directly, execute the hook
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const hook = new AutoCommitHook();
      const result = await hook.execute(input);
      HookBase.outputResult(result);
    } catch (error) {
      console.error(`Auto-commit hook error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = AutoCommitHook;
