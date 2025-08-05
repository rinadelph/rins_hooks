#!/usr/bin/env node

const LockUtils = require('./lock-utils');

/**
 * Lock cleanup utility for administrative tasks
 */
class LockCleanup {
  constructor() {
    this.lockUtils = new LockUtils();
  }

  /**
   * Display current lock status
   */
  showStatus() {
    console.error('=== Agent File Lock Status ===\n');

    const locks = this.lockUtils.getAllLocks();

    if (locks.length === 0) {
      console.error('No active file locks.');
      return;
    }

    console.error(`Found ${locks.length} active lock(s):\n`);

    locks.forEach((lock, index) => {
      const timeRemaining = Math.ceil((new Date(lock.expires_at) - new Date()) / 1000 / 60);
      console.error(`${index + 1}. File: ${lock.file_path}`);
      console.error(`   Agent: ${lock.agent_id}`);
      console.error(`   Operation: ${lock.operation}`);
      console.error(`   Locked: ${new Date(lock.locked_at).toLocaleString()}`);
      console.error(`   Expires: ${timeRemaining} minutes`);
      console.error(`   Session: ${lock.session_id}`);
      console.error('');
    });
  }

  /**
   * Clean up expired locks
   */
  cleanExpired() {
    console.error('Cleaning up expired locks...');
    const cleaned = this.lockUtils.cleanupExpiredLocks();
    console.error(`Cleaned up ${cleaned} expired lock(s).`);
  }

  /**
   * Release all locks for a specific agent
   * @param {string} agentId - Agent ID
   */
  releaseAgent(agentId) {
    console.error(`Releasing all locks for agent: ${agentId}`);
    const released = this.lockUtils.releaseAllLocks(agentId);
    console.error(`Released ${released} lock(s) for agent ${agentId}.`);
  }

  /**
   * Force release a specific file lock
   * @param {string} filePath - File path to unlock
   */
  forceRelease(filePath) {
    console.error(`Force releasing lock for file: ${filePath}`);
    const released = this.lockUtils.releaseLock(filePath);
    if (released) {
      console.error(`Successfully released lock for ${filePath}.`);
    } else {
      console.error(`No lock found for ${filePath} or release failed.`);
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.error('Agent File Lock Management Utility\n');
    console.error('Usage: node cleanup-locks.js <command> [options]\n');
    console.error('Commands:');
    console.error('  status                    Show current lock status');
    console.error('  clean                     Clean up expired locks');
    console.error('  release-agent <agent_id>  Release all locks for an agent');
    console.error('  force-release <file_path> Force release lock for a file');
    console.error('  help                      Show this help message\n');
    console.error('Examples:');
    console.error('  node cleanup-locks.js status');
    console.error('  node cleanup-locks.js clean');
    console.error('  node cleanup-locks.js release-agent worker1');
    console.error('  node cleanup-locks.js force-release src/main.py');
  }
}

// CLI execution
if (require.main === module) {
  const cleanup = new LockCleanup();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cleanup.showHelp();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'status':
        cleanup.showStatus();
        break;

      case 'clean':
        cleanup.cleanExpired();
        break;

      case 'release-agent':
        if (args.length < 2) {
          console.error('Error: Agent ID required for release-agent command');
          process.exit(1);
        }
        cleanup.releaseAgent(args[1]);
        break;

      case 'force-release':
        if (args.length < 2) {
          console.error('Error: File path required for force-release command');
          process.exit(1);
        }
        cleanup.forceRelease(args[1]);
        break;

      case 'help':
        cleanup.showHelp();
        break;

      default:
        console.error(`Error: Unknown command '${command}'`);
        cleanup.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = LockCleanup;
