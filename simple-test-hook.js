#!/usr/bin/env node

// Ultra-simple test hook to verify Claude Code is calling hooks
const fs = require('fs');

// Log that we were called
const logFile = '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/hook-test.log';
const timestamp = new Date().toISOString();
fs.appendFileSync(logFile, `${timestamp} - Simple test hook called\n`);

// Output success
console.log('{"success": true, "message": "Simple test hook executed"}');
process.exit(0);