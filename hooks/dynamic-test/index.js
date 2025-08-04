#!/usr/bin/env node

/**
 * Dynamic Test Hook - Version 1
 * This hook will be modified dynamically to test immediate execution changes
 */

const fs = require('fs');
const path = require('path');

function main() {
  const testMessage = "🧪 DYNAMIC TEST v1.0 - Initial version";
  const timestamp = new Date().toISOString();
  
  console.log(`${testMessage}`);
  console.log(`⏰ Executed at: ${timestamp}`);
  console.log(`🔧 Hook file: ${__filename}`);
  console.log(`📋 Testing immediate code changes without restart`);
  
  // Log to a test file to track executions
  const logPath = path.join(process.cwd(), 'dynamic-test-log.txt');
  const logEntry = `${timestamp} - v1.0 - Initial test version\n`;
  
  try {
    fs.appendFileSync(logPath, logEntry);
    console.log(`📝 Logged execution to: ${logPath}`);
  } catch (error) {
    console.error(`❌ Failed to log: ${error.message}`);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main();
}