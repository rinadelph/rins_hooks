#!/usr/bin/env node

// Analysis script for tool test results
const fs = require('fs');
const path = require('path');

class ResultAnalyzer {
  analyze() {
    console.log('=== Tool Test Results Analysis ===\n');
    
    // Check for tool events log
    const toolLogPath = 'claude-tool-events.log';
    if (fs.existsSync(toolLogPath)) {
      console.log('✅ Tool events log found');
      const content = fs.readFileSync(toolLogPath, 'utf8');
      const events = content.split('\n\n').filter(e => e.trim());
      console.log(`📊 Total tool events logged: ${events.length}`);
      
      // Parse and categorize events
      const toolTypes = new Set();
      events.forEach(eventStr => {
        try {
          const event = JSON.parse(eventStr);
          if (event.toolName) {
            toolTypes.add(event.toolName);
          }
        } catch (e) {
          // Skip malformed entries
        }
      });
      
      console.log('🔧 Tool types that triggered hooks:');
      Array.from(toolTypes).sort().forEach(tool => {
        console.log(`  - ${tool}`);
      });
    } else {
      console.log('❌ No tool events log found');
    }
    
    // Check git history for auto-commits
    console.log('\n=== Git Commit Analysis ===');
    try {
      const { execSync } = require('child_process');
      const gitLog = execSync('git log --oneline -10', { encoding: 'utf8' });
      const autoCommits = gitLog.split('\n').filter(line => 
        line.includes('Auto-commit:') || line.includes('rins_hooks')
      );
      console.log(`📝 Auto-commits created: ${autoCommits.length}`);
      autoCommits.forEach(commit => {
        console.log(`  ${commit}`);
      });
    } catch (error) {
      console.log('❌ Could not analyze git history');
    }
  }
}

new ResultAnalyzer().analyze();
