#!/usr/bin/env node

/**
 * Rapala Slash Command Hook
 * This is a minimal hook that only provides the /rapala slash command
 * The actual command functionality is in commands/rapala.md
 */

const HookBase = require('../../src/hook-base');

class RapalaSlashCommandHook extends HookBase {
  constructor() {
    super('rapala-slash-command', {
      description: 'Provides /rapala slash command for generating Claude Code hooks',
      matcher: '',
      timeout: 5
    });
  }

  /**
   * Execute - minimal implementation since this hook only provides slash commands
   */
  execute(input) {
    try {
      // This hook doesn't need to do anything - it just provides the /rapala command
      // The command functionality is handled by Claude Code processing commands/rapala.md
      return this.success({});
    } catch (error) {
      return this.error(`Rapala slash command hook failed: ${error.message}`);
    }
  }
}

// Create and run the hook
const hook = new RapalaSlashCommandHook();
hook.run();