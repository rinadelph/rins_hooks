#!/usr/bin/env node

const ThinkingStateManager = require('./state-manager');

function main() {
  try {
    // Get project directory from environment variable set by Claude Code
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const stateManager = new ThinkingStateManager(projectDir);
    const status = stateManager.getStatus();

    console.log('🧠 Extended Thinking System Status');
    console.log('=====================================');
    console.log('');
    console.log(`📍 Active Mode: **${status.activeMode}**`);
    console.log('');
    console.log('⚙️  Toggle States:');
    console.log(`   • Extended Thinking: ${status.thinking ? '✅ **ENABLED**' : '❌ Disabled'}`);
    console.log(`   • Deep Thinking: ${status.deepThinking ? '✅ **ENABLED**' : '❌ Disabled'}`);
    console.log('');

    if (status.thinking || status.deepThinking) {
      console.log('ℹ️  **Auto-mode is active** - all prompts will automatically include thinking instructions.');
    } else {
      console.log('ℹ️  Auto-mode is disabled - use `/think` or `/deep-think` for explicit thinking.');
    }

    console.log('');
    console.log('📂 Configuration:');
    console.log(`   • State file: ${status.stateFile}`);
    console.log(`   • Last modified: ${new Date(status.lastModified).toLocaleString()}`);
    console.log('');
    console.log('🛠️  Available Commands:');
    console.log('   • `/think [prompt]` - Apply extended thinking to a specific prompt');
    console.log('   • `/deep-think [prompt]` - Apply deep thinking to a complex prompt');
    console.log('   • `/think-toggle [on|off]` - Toggle extended thinking auto-mode');
    console.log('   • `/deep-toggle [on|off]` - Toggle deep thinking auto-mode');
    console.log('   • `/think-status` - Show this status information');

  } catch (error) {
    console.error('Error reading thinking status:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
