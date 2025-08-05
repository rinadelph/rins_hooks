---
description: Show current status of thinking toggles and modes
allowed-tools: Bash(node:*)
---

## Current Extended Thinking Status

!`node -e "
const fs = require('fs');
const path = require('path');

const projectDir = process.cwd();
const stateDir = path.join(projectDir, '.claude');
const stateFile = path.join(stateDir, 'extended-thinking-state.json');

const defaultState = {
  thinkingToggle: false,
  deepThinkingToggle: false,
  lastModified: new Date().toISOString()
};

let state = defaultState;
try {
  if (fs.existsSync(stateFile)) {
    state = { ...defaultState, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) };
  }
} catch (e) {
  // Use default state if file is corrupted
}

console.log('🧠 Extended Thinking System Status');
console.log('=====================================');
console.log('');

const activeMode = state.deepThinkingToggle ? 'Deep Thinking' : 
                  state.thinkingToggle ? 'Extended Thinking' : 'Normal';
console.log(\`📍 Active Mode: **\${activeMode}**\`);
console.log('');
console.log('⚙️  Toggle States:');
console.log(\`   • Extended Thinking: \${state.thinkingToggle ? '✅ **ENABLED**' : '❌ Disabled'}\`);
console.log(\`   • Deep Thinking: \${state.deepThinkingToggle ? '✅ **ENABLED**' : '❌ Disabled'}\`);
console.log('');

if (state.thinkingToggle || state.deepThinkingToggle) {
  console.log('ℹ️  **Auto-mode is active** - all prompts will automatically include thinking instructions.');
} else {
  console.log('ℹ️  Auto-mode is disabled - use \`/think\` or \`/deep-think\` for explicit thinking.');
}

console.log('');
console.log('📂 Configuration:');
console.log(\`   • State file: \${stateFile}\`);
console.log(\`   • Last modified: \${new Date(state.lastModified).toLocaleString()}\`);
console.log('');
console.log('🛠️  Available Commands:');
console.log('   • \`/think [prompt]\` - Apply extended thinking to a specific prompt');
console.log('   • \`/deep-think [prompt]\` - Apply deep thinking to a complex prompt');
console.log('   • \`/think-toggle [on|off]\` - Toggle extended thinking auto-mode');
console.log('   • \`/deep-toggle [on|off]\` - Toggle deep thinking auto-mode');
console.log('   • \`/think-status\` - Show this status information');
"`

Use `/think-toggle` or `/deep-toggle` to change these settings.
Use `/think` or `/deep-think` for one-time thinking on specific prompts.