---
description: Toggle deep thinking mode on/off for all subsequent prompts
argument-hint: [on|off] (optional)
allowed-tools: Bash(node:*)
---

!`node -e "
const fs = require('fs');
const path = require('path');

const toggleType = 'deepThinking';
const value = process.argv[2];

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

// Toggle or set value
if (value === 'on') {
  state[toggleType + 'Toggle'] = true;
} else if (value === 'off') {
  state[toggleType + 'Toggle'] = false;
} else {
  state[toggleType + 'Toggle'] = !state[toggleType + 'Toggle'];
}

state.lastModified = new Date().toISOString();

// Ensure directory exists and write state
try {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
} catch (e) {
  console.error('Error writing thinking state:', e.message);
  process.exit(1);
}

// Display result
const displayName = 'Deep Thinking';
const newState = state.deepThinkingToggle;

console.log('🧠 ' + displayName + ' is now: ' + (newState ? '✅ ENABLED' : '❌ DISABLED'));
console.log('');

if (newState) {
  console.log('All future prompts will automatically use ' + displayName.toLowerCase() + '.');
  if (state.thinkingToggle) {
    console.log('Note: Deep thinking takes precedence over regular extended thinking.');
  }
} else {
  console.log('Future prompts will use normal processing (unless explicitly using /think or /deep-think commands).');
}

console.log('');
console.log('📊 Current Status:');
console.log('   Extended Thinking: ' + (state.thinkingToggle ? '✅ ON' : '❌ OFF'));
console.log('   Deep Thinking: ' + (state.deepThinkingToggle ? '✅ ON' : '❌ OFF'));

const activeMode = state.deepThinkingToggle ? 'Deep Thinking' : 
                  state.thinkingToggle ? 'Extended Thinking' : 'Normal';
console.log('   Active Mode: ' + activeMode);
" $ARGUMENTS`