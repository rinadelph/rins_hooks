#!/usr/bin/env node

// Debug hook to see what Claude Code sends to hooks
const fs = require('fs');
const path = require('path');

let input = '';

process.stdin.on('data', (chunk) => {
  input += chunk.toString();
});

process.stdin.on('end', () => {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      raw_input: input,
      parsed_input: (() => {
        try {
          return JSON.parse(input);
        } catch (e) {
          return { error: e.message, input: input };
        }
      })(),
      process_pid: process.pid,
      parent_pid: process.ppid,
      working_directory: process.cwd()
    };
    
    // Ensure the directory exists
    const logDir = path.join(process.cwd(), '.agent', 'session-activity');
    fs.mkdirSync(logDir, { recursive: true });

    // Log to debug file
    const debugFile = path.join(logDir, 'debug-hook.jsonl');
    fs.appendFileSync(debugFile, JSON.stringify(logEntry) + '\n');

    // Return a valid JSON success object
    const successOutput = {
      success: true,
      data: {
        message: 'Debug information logged successfully.',
        logFile: debugFile
      }
    };
    console.log(JSON.stringify(successOutput));
    process.exit(0);

  } catch (error) {
    const errorOutput = {
      success: false,
      error: `Debug hook failed: ${error.message}`
    };
    console.error(JSON.stringify(errorOutput));
    process.exit(1);
  }
});

process.stdin.on('error', (error) => {
  const errorOutput = {
    success: false,
    error: `Hook input error: ${error.message}`
  };
  console.error(JSON.stringify(errorOutput));
  process.exit(1);
});
