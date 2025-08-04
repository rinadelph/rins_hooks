const fs = require('fs');
const path = require('path');

/**
 * Hook Coordination System
 * Prevents duplicate execution of the same hook for the same operation
 */

class HookCoordination {
  constructor(projectDir = null) {
    this.projectDir = projectDir || process.cwd();
    this.lockDir = path.join(this.projectDir, '.claude', 'hook-locks');
    this.lockTimeout = 5000; // 5 seconds
  }

  /**
   * Check if this hook should run for this operation
   * @param {string} hookName - Name of the hook
   * @param {string} eventType - Event type (UserPromptSubmit, PreToolUse, etc.)
   * @param {string} operationId - Unique operation identifier
   */
  shouldRun(hookName, eventType, operationId) {
    try {
      // For thinking hooks, allow multiple executions for tool events
      // but prevent rapid duplicates within a short time window
      if (this.isThinkingHook(hookName)) {
        return this.shouldRunThinkingHook(hookName, eventType, operationId);
      }

      // For other hooks, use strict coordination
      return this.shouldRunStrictCoordination(hookName, eventType, operationId);

    } catch (error) {
      // If coordination fails, allow the hook to run (fail open)
      return true;
    }
  }

  /**
   * Check if this is a thinking-related hook that should run frequently
   */
  isThinkingHook(hookName) {
    return hookName.includes('thinking') || hookName.includes('extended');
  }

  /**
   * Coordination logic for thinking hooks - allow multiple executions but prevent spam
   */
  shouldRunThinkingHook(hookName, eventType, operationId) {
    // Ensure lock directory exists
    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
    }

    // For UserPromptSubmit, prevent rapid duplicates of the same prompt
    if (eventType === 'UserPromptSubmit') {
      return this.shouldRunStrictCoordination(hookName, eventType, operationId);
    }

    // For PreToolUse and PostToolUse, allow them to run but prevent spam
    // Use a shorter time window (1 second) to prevent rapid-fire duplicates
    const lockKey = `${hookName}-${eventType}-${operationId}`;
    const lockFile = path.join(this.lockDir, `${lockKey}.lock`);
    
    if (fs.existsSync(lockFile)) {
      const lockData = this.readLockFile(lockFile);
      if (lockData && this.isRecentExecution(lockData, 1000)) { // 1 second window
        return false; // Too recent, skip
      } else {
        this.removeLock(lockFile);
      }
    }

    // Create lock with shorter timeout for thinking hooks
    this.createLock(lockFile, { hookName, eventType, operationId });
    return true;
  }

  /**
   * Strict coordination for non-thinking hooks
   */
  shouldRunStrictCoordination(hookName, eventType, operationId) {
    // Ensure lock directory exists
    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
    }

    const lockKey = `${hookName}-${eventType}-${operationId}`;
    const lockFile = path.join(this.lockDir, `${lockKey}.lock`);
    
    // Check if lock exists and is still valid
    if (fs.existsSync(lockFile)) {
      const lockData = this.readLockFile(lockFile);
      if (lockData && this.isLockValid(lockData)) {
        // Operation already being handled
        return false;
      } else {
        // Stale lock, remove it
        this.removeLock(lockFile);
      }
    }

    // Create lock for this operation
    this.createLock(lockFile, { hookName, eventType, operationId });
    return true;
  }

  /**
   * Check if execution was recent (for spam prevention)
   */
  isRecentExecution(lockData, timeWindow) {
    const now = Date.now();
    const lockAge = now - lockData.timestamp;
    return lockAge < timeWindow;
  }

  /**
   * Mark operation as complete
   * @param {string} hookName - Name of the hook
   * @param {string} eventType - Event type
   * @param {string} operationId - Operation identifier
   */
  markComplete(hookName, eventType, operationId) {
    try {
      const lockKey = `${hookName}-${eventType}-${operationId}`;
      const lockFile = path.join(this.lockDir, `${lockKey}.lock`);
      this.removeLock(lockFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Generate operation ID from input context
   * @param {Object} input - Hook input
   */
  generateOperationId(input) {
    // Create a unique ID based on the operation context
    const components = [];
    
    if (input.session_id) {
      components.push(input.session_id.slice(-8)); // Last 8 chars
    }
    
    if (input.tool_name) {
      components.push(input.tool_name);
    }
    
    if (input.prompt) {
      // Hash the prompt to create a consistent ID
      components.push(this.simpleHash(input.prompt.slice(0, 100)));
    }
    
    if (input.tool_input) {
      // Hash relevant tool input
      const inputStr = JSON.stringify(input.tool_input).slice(0, 100);
      components.push(this.simpleHash(inputStr));
    }

    // Add timestamp to ensure uniqueness for rapid operations
    components.push(Date.now().toString().slice(-6));
    
    return components.join('-');
  }

  /**
   * Simple hash function for generating consistent IDs
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create a lock file
   */
  createLock(lockFile, data) {
    const lockData = {
      ...data,
      timestamp: Date.now(),
      pid: process.pid
    };
    
    fs.writeFileSync(lockFile, JSON.stringify(lockData));
  }

  /**
   * Read lock file data
   */
  readLockFile(lockFile) {
    try {
      const data = fs.readFileSync(lockFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if lock is still valid
   */
  isLockValid(lockData) {
    const now = Date.now();
    const lockAge = now - lockData.timestamp;
    
    // Lock is valid if it's recent and process might still be running
    return lockAge < this.lockTimeout;
  }

  /**
   * Remove a lock file
   */
  removeLock(lockFile) {
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
    } catch (error) {
      // Ignore removal errors
    }
  }

  /**
   * Clean up old lock files
   */
  cleanupOldLocks() {
    try {
      if (!fs.existsSync(this.lockDir)) {
        return;
      }

      const files = fs.readdirSync(this.lockDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.lock')) continue;
        
        const lockFile = path.join(this.lockDir, file);
        const lockData = this.readLockFile(lockFile);
        
        if (!lockData || (now - lockData.timestamp) > this.lockTimeout * 2) {
          this.removeLock(lockFile);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Get coordination statistics
   */
  getStats() {
    try {
      if (!fs.existsSync(this.lockDir)) {
        return { activeLocks: 0, lockFiles: [] };
      }

      const files = fs.readdirSync(this.lockDir);
      const lockFiles = files.filter(f => f.endsWith('.lock'));
      
      return {
        activeLocks: lockFiles.length,
        lockFiles: lockFiles.map(f => {
          const lockFile = path.join(this.lockDir, f);
          const data = this.readLockFile(lockFile);
          return {
            file: f,
            data,
            valid: data ? this.isLockValid(data) : false
          };
        })
      };
    } catch (error) {
      return { activeLocks: 0, lockFiles: [], error: error.message };
    }
  }
}

module.exports = HookCoordination;