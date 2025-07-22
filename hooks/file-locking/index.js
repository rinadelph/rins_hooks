#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * File Locking Hook for Claude Code - Compliant with Anthropic Documentation
 * 
 * This is a PreToolUse hook that blocks Edit/Write/MultiEdit operations
 * when files are locked by other agents.
 */

// Configuration
const CONFIG = {
  lockTimeout: 600, // 10 minutes in seconds
  lockDirectory: '.agent-locks',
  activityDirectory: '.agent-activity',
  excludePatterns: [
    /\.log$/,
    /\.tmp$/,
    /\.temp$/,
    /\.lock$/,
    /\.env/,
    /\.git\//,
    /\.agent-/,
    /node_modules\//,
    /\.pyc$/,
    /__pycache__\//
  ]
};

// Utility functions
function ensureDirectories() {
  const lockDir = path.join(process.cwd(), CONFIG.lockDirectory);
  const activityDir = path.join(process.cwd(), CONFIG.activityDirectory);
  
  try {
    if (!fs.existsSync(lockDir)) {
      fs.mkdirSync(lockDir, { recursive: true });
    }
    if (!fs.existsSync(activityDir)) {
      fs.mkdirSync(activityDir, { recursive: true });
    }
  } catch (error) {
    // Silent failure - don't block operations if directories can't be created
  }
}

function pathToLockName(filePath) {
  return filePath
    .replace(/^\.?\/+/, '')
    .replace(/[/\\]/g, '-')
    .replace(/[<>:"|?*]/g, '_')
    + '.lock';
}

function getLockFilePath(filePath) {
  const lockName = pathToLockName(filePath);
  const lockDir = path.join(process.cwd(), CONFIG.lockDirectory);
  return path.join(lockDir, lockName);
}

function isLocked(filePath) {
  const lockFilePath = getLockFilePath(filePath);
  
  try {
    if (!fs.existsSync(lockFilePath)) {
      return null;
    }

    const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
    
    // Check if lock has expired
    const now = new Date();
    const expiresAt = new Date(lockData.expires_at);
    
    if (now > expiresAt) {
      // Lock expired, remove it
      try {
        fs.unlinkSync(lockFilePath);
      } catch (error) {
        // Silent failure
      }
      return null;
    }

    return lockData;
  } catch (error) {
    return null;
  }
}

function createLock(filePath, agentId, operation, sessionId) {
  const lockFilePath = getLockFilePath(filePath);
  
  try {
    // Check if already locked
    const existingLock = isLocked(filePath);
    if (existingLock && existingLock.agent_id !== agentId) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (CONFIG.lockTimeout * 1000));
    
    const lockData = {
      agent_id: agentId,
      file_path: filePath,
      locked_at: now.toISOString(),
      operation: operation,
      session_id: sessionId,
      expires_at: expiresAt.toISOString(),
      lock_id: crypto.randomUUID()
    };

    // Atomic write
    const tempPath = lockFilePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(lockData, null, 2));
    fs.renameSync(tempPath, lockFilePath);

    logActivity('lock_created', agentId, filePath, { operation, session_id: sessionId });
    return true;
  } catch (error) {
    return false;
  }
}

function logActivity(action, agentId, filePath, details = {}) {
  try {
    const activityDir = path.join(process.cwd(), CONFIG.activityDirectory);
    const activityFile = path.join(activityDir, 'live-feed.jsonl');
    const entry = {
      timestamp: new Date().toISOString(),
      action: action,
      agent_id: agentId,
      file_path: filePath,
      ...details
    };
    
    fs.appendFileSync(activityFile, JSON.stringify(entry) + '\n');
  } catch (error) {
    // Silent failure - don't block operations if logging fails
  }
}

function extractFilePath(toolInput) {
  return toolInput.file_path || 
         toolInput.filePath ||
         (toolInput.edits && toolInput.edits[0] && toolInput.edits[0].file_path) ||
         null;
}

function extractAgentId(input) {
  // Use stable session ID from Claude Code
  return input.session_id || `session-${process.ppid}`;
}

function detectHookPhase(input) {
  // Direct detection from Claude Code hook event name!
  return input.hook_event_name || 'PreToolUse';
}

function releaseLock(filePath, agentId) {
  try {
    const lockFilePath = getLockFilePath(filePath);
    const existingLock = isLocked(filePath);
    
    // Only release if we own the lock
    if (existingLock && existingLock.agent_id === agentId) {
      fs.unlinkSync(lockFilePath);
      logActivity('lock_released', agentId, filePath, { operation: 'completed' });
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

function shouldExcludeFile(filePath) {
  return CONFIG.excludePatterns.some(pattern => pattern.test(filePath));
}

function cleanupExpiredLocks() {
  try {
    const lockDir = path.join(process.cwd(), CONFIG.lockDirectory);
    if (!fs.existsSync(lockDir)) return;
    
    const lockFiles = fs.readdirSync(lockDir);
    const now = new Date();
    
    for (const lockFile of lockFiles) {
      if (!lockFile.endsWith('.lock')) continue;
      
      const lockFilePath = path.join(lockDir, lockFile);
      try {
        const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
        const expiresAt = new Date(lockData.expires_at);
        
        if (now > expiresAt) {
          fs.unlinkSync(lockFilePath);
          logActivity('lock_expired', lockData.agent_id, lockData.file_path, {});
        }
      } catch (error) {
        // Silent failure
      }
    }
  } catch (error) {
    // Silent failure
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
    
    // DEBUG: Log everything available for agent identification
    console.error('=== AGENT ID DEBUG ===');
    console.error('Input keys:', Object.keys(input));
    console.error('Full input:', JSON.stringify(input, null, 2));
    console.error('Process env keys:', Object.keys(process.env).filter(k => k.includes('CLAUDE') || k.includes('SESSION') || k.includes('AGENT')));
    console.error('process.pid:', process.pid);
    console.error('process.ppid:', process.ppid);
    console.error('process.argv:', process.argv);
    console.error('======================');
    
    // Only handle file modification tools
    if (!['Edit', 'Write', 'MultiEdit'].includes(tool_name)) {
      // Exit with code 0 (success) - allow operation
      process.exit(0);
    }

    const filePath = extractFilePath(tool_input);
    if (!filePath) {
      // No file path, allow operation
      process.exit(0);
    }

    // Check if file should be excluded from locking
    if (shouldExcludeFile(filePath)) {
      // Excluded file, allow operation
      process.exit(0);
    }

    // Ensure directories exist
    ensureDirectories();

    const agentId = extractAgentId(input);
    const operation = tool_name.toLowerCase();

    // Clean up any expired locks first
    cleanupExpiredLocks();

    // Direct phase detection from Claude Code hook event name
    const hookPhase = detectHookPhase(input);
    
    if (hookPhase === 'PostToolUse') {
      // PostToolUse: Release lock and allow
      const released = releaseLock(filePath, agentId);
      console.log(released ? `Lock released for "${filePath}"` : `No lock to release for "${filePath}"`);
      process.exit(0);
    }

    // PreToolUse: Check locks and potentially block
    const existingLock = isLocked(filePath);
    
    if (existingLock) {
      if (existingLock.agent_id === agentId) {
        // Same agent already has the lock, allow operation
        console.log(`File already locked by this agent: ${filePath}`);
        process.exit(0);
      } else {
        // File locked by different agent, BLOCK operation
        const timeRemaining = Math.ceil((new Date(existingLock.expires_at) - new Date()) / 1000 / 60);
        const errorMessage = `File "${filePath}" is currently being ${existingLock.operation} by agent "${existingLock.agent_id}". Lock expires in ${timeRemaining} minutes. Please wait or work on a different file.`;
        
        // Output error to stderr and exit with code 2 (blocking)
        console.error(errorMessage);
        process.exit(2);
      }
    }

    // File is not locked, create lock and allow operation
    const lockCreated = createLock(filePath, agentId, operation, session_id);
    
    if (lockCreated) {
      console.log(`File lock acquired for "${filePath}"`);
      process.exit(0);
    } else {
      // Lock creation failed, allow operation with warning
      console.log(`Warning: Could not create file lock for "${filePath}", proceeding without lock protection`);
      process.exit(0);
    }

  } catch (error) {
    // Log error but don't block operation (exit code 1 = non-blocking error)
    console.error(`File lock check failed: ${error.message}`);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}