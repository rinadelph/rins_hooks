#!/usr/bin/env node

const ThinkingStateManager = require('./state-manager');

function main() {
  try {
    // Get project directory from environment variable set by Claude Code
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const stateManager = new ThinkingStateManager(projectDir);
    const status = stateManager.getStatus();

    console.error('🧠 Extended Thinking System Status');
    console.error('=====================================');
    console.error('');
    console.error(`📍 Active Mode: **${status.activeMode}**`);
    console.error('');
    console.error('⚙️  Toggle States:');
    console.error(`   • Extended Thinking: ${status.thinking ? '✅ **ENABLED**' : '❌ Disabled'}`);
    console.error(`   • Deep Thinking: ${status.deepThinking ? '✅ **ENABLED**' : '❌ Disabled'}`);
    console.error('');

    if (status.thinking || status.deepThinking) {
      console.error('ℹ️  **Auto-mode is active** - all prompts will automatically include thinking instructions.');
    } else {
      console.error('ℹ️  Auto-mode is disabled - use `/think` or `/deep-think` for explicit thinking.');
    }

    console.error('');
    console.error('📂 Configuration:');
    console.error(`   • State file: ${status.stateFile}`);
    console.error(`   • Last modified: ${new Date(status.lastModified).toLocaleString()}`);
    console.error('');
    console.error('🛠️  Available Commands:');
    console.error('   • `/think [prompt]` - Apply extended thinking to a specific prompt');
    console.error('   • `/deep-think [prompt]` - Apply deep thinking to a complex prompt');
    console.error('   • `/think-toggle [on|off]` - Toggle extended thinking auto-mode');
    console.error('   • `/deep-toggle [on|off]` - Toggle deep thinking auto-mode');
    console.error('   • `/think-status` - Show this status information');

  } catch (error) {
    console.error('Error reading thinking status:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
