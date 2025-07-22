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
 * - Direct Claude Code compliance (no HookBase dependency)
 */

// Configuration
const CONFIG = {
  enabled: true,
  lockTimeout: 600, // 10 minutes
  commitMessageTemplate: `{{action}}: {{toolName}} modified {{fileName}}

Session: {{sessionId}}
PID: {{pid}} (parent: {{parentPid}})
Timestamp: {{timestamp}}
File: {{filePath}}
Tool: {{toolName}}

# Revert: git log --grep="PID: {{pid}}"
🤖 Generated with Claude Code via rins_hooks
Co-Authored-By: Claude <noreply@anthropic.com>`,
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

function runGitCommand(args) {
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
    
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
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
  try {
    // Parse input from Claude Code
    const input = await parseInput();
    const { tool_name, tool_input, session_id } = input;
    
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

    // Add file to git
    await runGitCommand(['add', filePath]);

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
    process.exit(0);

  } catch (error) {
    console.error(`Auto-commit failed: ${error.message}`);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = { main, parseInput, extractAgentId };