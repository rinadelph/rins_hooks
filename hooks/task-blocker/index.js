#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const HookBase = require('../../src/hook-base');

class TaskBlockerHook extends HookBase {
  constructor(config = {}) {
    super('task-blocker', config);
    this.logFile = path.join(process.cwd(), 'task-blocker.log');
  }

  getDefaultConfig() {
    return {
      enabled: true,
      matcher: '', // This hook manages permissions, not tool blocking
      timeout: 5,
      description: 'Configures Claude Code to block Task tool usage via permissions',
      blockMessage: 'Task tool usage is blocked. Please work directly without creating subagents.',
      logActivity: true,
      usePermissions: true // Use permission system instead of hook blocking
    };
  }

  logActivity(message, data = {}) {
    if (!this.config.logActivity) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      ...data
    };

    try {
      fs.appendFileSync(this.logFile, `${JSON.stringify(logEntry, null, 2)}\n\n`);
    } catch (error) {
      console.warn(`Failed to log activity: ${error.message}`);
    }
  }

  execute(input) {
    try {
      // This hook is primarily for installation/configuration
      // The actual blocking is done via Claude Code permissions
      
      this.logActivity('TASK_BLOCKER_HOOK_TRIGGERED', {
        hook_event_name: input.hook_event_name,
        tool_name: input.tool_name,
        session_id: input.session_id
      });

      return this.success({ 
        message: 'Task blocker hook executed - blocking handled by permissions',
        usePermissions: this.config.usePermissions
      });

    } catch (error) {
      this.logActivity('HOOK_ERROR', { 
        error: error.message 
      });
      return this.error(`Task blocker failed: ${error.message}`);
    }
  }
}

// If called directly, execute the hook
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const hook = new TaskBlockerHook();
      await hook.execute(input);
      process.exit(0);
    } catch (error) {
      console.error(`Task blocker hook error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = TaskBlockerHook;