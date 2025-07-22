#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Agent Registry Hook for Claude Code - Agent-MCP Integration
 * 
 * Features:
 * - Register Claude Code sessions in .agent/registry.json
 * - Robust .agent directory creation (compatible with Agent-MCP)
 * - Auto-cleanup of stale sessions after 3 minutes
 * - Activity logging for Agent-MCP monitoring
 */

// Configuration
const CONFIG = {
  registryFile: '.agent/registry.json',
  sessionTimeoutMinutes: 3,
  activityDirectory: '.agent/session-activity',
  logAllActivity: true
};

// Utility functions
function ensureAgentDirectory() {
  const agentDir = path.join(process.cwd(), '.agent');
  
  try {
    if (!fs.existsSync(agentDir)) {
      // Create .agent directory with Agent-MCP compatible structure
      fs.mkdirSync(agentDir, { recursive: true });
      
      // Create subdirectories that don't conflict with Agent-MCP
      const subdirs = ['session-activity'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(agentDir, subdir);
        if (!fs.existsSync(subdirPath)) {
          fs.mkdirSync(subdirPath, { recursive: true });
        }
      }
      
      // Create compatible config if none exists
      const configPath = path.join(agentDir, 'config.json');
      if (!fs.existsSync(configPath)) {
        const compatibleConfig = {
          project_name: path.basename(process.cwd()),
          created_at: new Date().toISOString(),
          created_by: 'rins_hooks_agent_registry',
          hook_version: '1.0.0',
          agent_mcp_compatible: true
        };
        fs.writeFileSync(configPath, JSON.stringify(compatibleConfig, null, 2));
      }
    }
    
    // Ensure session-activity directory exists
    const activityDir = path.join(process.cwd(), CONFIG.activityDirectory);
    if (!fs.existsSync(activityDir)) {
      fs.mkdirSync(activityDir, { recursive: true });
    }
    
    return true;
  } catch (error) {
    // Silent failure - don't block operations
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

function readRegistry() {
  const registryPath = path.join(process.cwd(), CONFIG.registryFile);
  
  try {
    if (fs.existsSync(registryPath)) {
      const data = fs.readFileSync(registryPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Return empty registry on error
  }
  
  return {
    sessions: {},
    cleanup: {
      last_cleanup: Date.now(),
      timeout_minutes: CONFIG.sessionTimeoutMinutes
    }
  };
}

function writeRegistry(registry) {
  const registryPath = path.join(process.cwd(), CONFIG.registryFile);
  const lockFile = registryPath + '.lock';
  
  try {
    // Simple lock mechanism
    if (fs.existsSync(lockFile)) {
      return false; // Another process is updating
    }
    
    fs.writeFileSync(lockFile, '');
    
    // Atomic write
    const tempPath = registryPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(registry, null, 2));
    fs.renameSync(tempPath, registryPath);
    
    fs.unlinkSync(lockFile);
    return true;
  } catch (error) {
    // Clean up lock on error
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    return false;
  }
}

function cleanupStaleEntries(registry) {
  const now = Date.now();
  const timeoutMs = CONFIG.sessionTimeoutMinutes * 60 * 1000;
  const activeSessions = {};
  
  for (const [sessionId, sessionData] of Object.entries(registry.sessions)) {
    if (now - sessionData.last_activity < timeoutMs) {
      activeSessions[sessionId] = sessionData;
    }
  }
  
  registry.sessions = activeSessions;
  registry.cleanup.last_cleanup = now;
  
  return registry;
}

function updateAgentRegistry(input, toolName, filePath) {
  try {
    ensureAgentDirectory();
    
    const agentId = extractAgentId(input);
    const now = Date.now();
    
    // Read current registry
    let registry = readRegistry();
    
    // Clean up stale entries
    registry = cleanupStaleEntries(registry);
    
    // Update current session
    const sessionData = {
      session_id: agentId,
      pid: process.pid,
      parent_pid: process.ppid,
      first_seen: registry.sessions[agentId]?.first_seen || now,
      last_activity: now,
      tool_name: toolName,
      file_path: filePath,
      working_directory: process.cwd(),
      hook_event: input.hook_event_name || 'PostToolUse'
    };
    
    registry.sessions[agentId] = sessionData;
    
    // Write registry back
    const success = writeRegistry(registry);
    
    if (success && CONFIG.logAllActivity) {
      logSessionActivity(agentId, toolName, filePath, 'registry_updated');
    }
    
    return success;
  } catch (error) {
    return false;
  }
}

function logSessionActivity(agentId, toolName, filePath, action) {
  try {
    const activityDir = path.join(process.cwd(), CONFIG.activityDirectory);
    const logFile = path.join(activityDir, 'registry-activity.jsonl');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      session_id: agentId,
      pid: process.pid,
      parent_pid: process.ppid,
      action: action,
      tool_name: toolName,
      file_path: filePath,
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

    // Update agent registry
    const success = updateAgentRegistry(input, tool_name, filePath);
    
    if (success) {
      console.log(`Agent session registered: ${extractAgentId(input)}`);
    } else {
      console.log(`Agent registry update skipped (concurrent access)`);
    }
    
    process.exit(0);

  } catch (error) {
    console.error(`Agent registry failed: ${error.message}`);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = { main, parseInput, extractAgentId, updateAgentRegistry };