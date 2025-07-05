#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const HookBase = require('../../src/hook-base');

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
      commitMessageTemplate: 'Auto-commit: {{toolName}} modified {{fileName}}\n\n- File: {{filePath}}\n- Tool: {{toolName}}\n- Session: {{sessionId}}\n\n🤖 Generated with Claude Code via rins_hooks\nCo-Authored-By: Claude <noreply@anthropic.com>',
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
      fs.appendFileSync(this.toolLogFile, JSON.stringify(logEntry, null, 2) + '\n\n');
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

      // Add file to git
      await this.runGitCommand(['add', filePath]);

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
      return this.error(`Auto-commit failed: ${error.message}`);
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

  runGitCommand(args) {
    return new Promise((resolve, reject) => {
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
          reject(new Error(`Git command failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
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
