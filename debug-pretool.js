#!/usr/bin/env node

// Simple debug script to see if PreToolUse is firing
console.error('🔍 DEBUG: PreToolUse hook fired!');
console.error('🔍 DEBUG: Arguments:', process.argv);
console.error('🔍 DEBUG: Environment HOOK_INPUT:', process.env.HOOK_INPUT);

// Read from stdin
let input = '';
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  console.error('🔍 DEBUG: STDIN input:', input);
  try {
    const parsed = JSON.parse(input);
    console.error('🔍 DEBUG: Parsed JSON:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.error('🔍 DEBUG: Not JSON input');
  }
  
  // Output success
  console.log(JSON.stringify({success: true, hook: 'debug-pretool'}));
});