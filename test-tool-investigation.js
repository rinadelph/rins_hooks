#!/usr/bin/env node

/**
 * Claude Code Tool Investigation Script
 * 
 * Based on https://kirshatrov.com/posts/claude-code-internals, this script
 * helps us understand which tool invocations trigger our hooks.
 * 
 * Key findings from the blog:
 * - 11 core tools including dispatch_agent, Bash, BatchTool, GlobTool, View
 * - Multiple security checks on Bash commands
 * - BatchTool runs multiple tool invocations in parallel
 * - dispatch_agent launches sub-agents with additional tools
 */

const fs = require('fs');
const path = require('path');

class ToolInvestigator {
  constructor() {
    this.logFile = path.join(__dirname, 'tool-investigation.log');
    this.setupLogging();
  }

  setupLogging() {
    // Clear previous log
    if (fs.existsSync(this.logFile)) {
      fs.unlinkSync(this.logFile);
    }
    
    this.log('=== Claude Code Tool Investigation Started ===');
    this.log(`Timestamp: ${new Date().toISOString()}`);
    this.log('Based on: https://kirshatrov.com/posts/claude-code-internals');
    this.log('');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    console.log(message);
    fs.appendFileSync(this.logFile, logEntry);
  }

  analyzeToolTypes() {
    this.log('=== Known Claude Code Tool Types ===');
    
    const knownTools = [
      'dispatch_agent',
      'Bash', 
      'BatchTool',
      'GlobTool',
      'View',
      'Edit',
      'Write',
      'Read',
      'MultiEdit',
      'LS',
      'Grep'
    ];
    
    knownTools.forEach(tool => {
      this.log(`- ${tool}`);
    });
    
    this.log('');
    this.log('=== Hook Trigger Patterns to Test ===');
    this.log('1. Single tool invocation (Edit, Write, Read)');
    this.log('2. BatchTool with multiple tools');
    this.log('3. dispatch_agent sub-agent calls');
    this.log('4. Bash commands with security checks');
    this.log('5. Internal commands like /compact');
    this.log('');
  }

  generateTestInstructions() {
    this.log('=== Test Instructions for Claude Code ===');
    this.log('');
    this.log('To test our hooks, ask Claude Code to:');
    this.log('');
    this.log('1. SINGLE TOOL TEST:');
    this.log('   "Create a new file called test-single.txt with content \'single tool test\'"');
    this.log('   Expected: Should trigger PreToolUse and PostToolUse hooks');
    this.log('');
    this.log('2. BATCH TOOL TEST:');
    this.log('   "Read package.json and then edit it to add a test script"');
    this.log('   Expected: May trigger hooks for each tool in the batch');
    this.log('');
    this.log('3. BASH COMMAND TEST:');
    this.log('   "Run ls -la to list files"');
    this.log('   Expected: Should trigger hooks for Bash tool');
    this.log('');
    this.log('4. MULTIPLE FILE OPERATIONS:');
    this.log('   "Create 3 files: a.txt, b.txt, c.txt with different content"');
    this.log('   Expected: Should trigger hooks for each Write operation');
    this.log('');
    this.log('5. INTERNAL COMMAND TEST:');
    this.log('   Try "/compact" or other slash commands');
    this.log('   Expected: May NOT trigger hooks (internal commands)');
    this.log('');
  }

  createHookAnalyzer() {
    const analyzerCode = `
// Enhanced hook for tool investigation
const fs = require('fs');
const path = require('path');

class ToolAnalyzer {
  constructor() {
    this.logFile = path.join(process.cwd(), 'hook-analysis.log');
  }

  logToolEvent(event, data) {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({
      timestamp,
      event,
      toolName: data.toolName,
      parameters: Object.keys(data.parameters || {}),
      fullData: data
    }, null, 2);
    
    fs.appendFileSync(this.logFile, logEntry + '\\n\\n');
  }
}

module.exports = ToolAnalyzer;
`;

    const analyzerPath = path.join(__dirname, 'hooks', 'tool-analyzer.js');
    fs.writeFileSync(analyzerPath, analyzerCode);
    this.log(`Created tool analyzer at: ${analyzerPath}`);
  }

  run() {
    this.analyzeToolTypes();
    this.generateTestInstructions();
    this.createHookAnalyzer();
    
    this.log('=== Investigation Setup Complete ===');
    this.log(`Check log file: ${this.logFile}`);
    this.log('');
    this.log('Next steps:');
    this.log('1. Run the test instructions in Claude Code');
    this.log('2. Check hook-analysis.log for tool event details');
    this.log('3. Compare which tools trigger hooks vs which don\'t');
  }
}

// Run the investigation
const investigator = new ToolInvestigator();
investigator.run();