#!/usr/bin/env node

// Debug script to capture PostToolUse events
console.error('🔍 DEBUG: PostToolUse hook fired!');

// Read from stdin
let input = '';
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  console.error('🔍 DEBUG: PostToolUse STDIN:', input);
  try {
    const parsed = JSON.parse(input);
    console.error('🔍 DEBUG: PostToolUse Parsed:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.error('🔍 DEBUG: PostToolUse Not JSON input');
  }
  
  // Output success
  console.log(JSON.stringify({success: true, hook: 'debug-posttool'}));
});