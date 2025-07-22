#!/usr/bin/env node

// Debug hook to see what Claude Code sends to hooks
let input = '';

process.stdin.on('data', (chunk) => {
  input += chunk.toString();
});

process.stdin.on('end', () => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    raw_input: input,
    parsed_input: (() => {
      try {
        return JSON.parse(input);
      } catch (e) {
        return { error: e.message };
      }
    })(),
    process_pid: process.pid,
    parent_pid: process.ppid,
    working_directory: process.cwd()
  };
  
  const fs = require('fs');
  const path = require('path');
  
  // Log to debug file
  const debugFile = path.join(process.cwd(), '.agent', 'session-activity', 'debug-hook.jsonl');
  try {
    fs.appendFileSync(debugFile, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    // Fallback to stdout
    console.log('DEBUG:', JSON.stringify(logEntry));
  }
  
  process.exit(0);
});

process.stdin.on('error', (error) => {
  console.error('Hook input error:', error);
  process.exit(1);
});