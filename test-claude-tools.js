#!/usr/bin/env node

/**
 * Active Tool Testing Script for Claude Code
 * 
 * This script generates specific test scenarios to understand:
 * 1. Which Claude Code tools trigger hooks
 * 2. How BatchTool operations are handled
 * 3. Whether internal commands like /compact trigger hooks
 * 4. Tool parameter patterns and structures
 */

const fs = require('fs');
const path = require('path');

class ClaudeToolTester {
  constructor() {
    this.testDir = path.join(process.cwd(), 'tool-test-files');
    this.logFile = path.join(process.cwd(), 'claude-tool-test.log');
    
    this.setupTestEnvironment();
  }

  setupTestEnvironment() {
    // Create test directory
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }

    // Clear previous logs
    if (fs.existsSync(this.logFile)) {
      fs.unlinkSync(this.logFile);
    }

    this.log('=== Claude Code Tool Testing Session ===');
    this.log(`Test directory: ${this.testDir}`);
    this.log(`Log file: ${this.logFile}`);
    this.log('');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    console.log(logEntry);
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  createTestFiles() {
    this.log('=== Creating Test Files ===');
    
    const testFiles = [
      {
        name: 'test-write.txt',
        content: 'This file tests the Write tool'
      },
      {
        name: 'test-edit.js',
        content: `// Test file for Edit tool
function testFunction() {
  console.log('Original function');
}

module.exports = testFunction;`
      },
      {
        name: 'test-multiedit.json',
        content: JSON.stringify({
          "name": "test-package",
          "version": "1.0.0",
          "description": "Test file for MultiEdit tool"
        }, null, 2)
      }
    ];

    testFiles.forEach(file => {
      const filePath = path.join(this.testDir, file.name);
      fs.writeFileSync(filePath, file.content);
      this.log(`Created: ${file.name}`);
    });

    this.log('');
  }

  generateTestInstructions() {
    this.log('=== Test Instructions for Claude Code ===');
    this.log('');
    this.log('Copy and paste these commands into Claude Code one by one:');
    this.log('');

    const tests = [
      {
        title: 'Test 1: Single Write Tool',
        instruction: `Create a new file called "${path.join(this.testDir, 'single-write-test.txt')}" with content "Testing single Write tool invocation"`
      },
      {
        title: 'Test 2: Single Edit Tool', 
        instruction: `Edit the file "${path.join(this.testDir, 'test-edit.js')}" and change "Original function" to "Modified function"`
      },
      {
        title: 'Test 3: Read + Edit (Potential BatchTool)',
        instruction: `Read the file "${path.join(this.testDir, 'test-multiedit.json')}" and then edit it to change the version to "2.0.0"`
      },
      {
        title: 'Test 4: Multiple File Operations',
        instruction: `Create three files: "${path.join(this.testDir, 'batch-a.txt')}", "${path.join(this.testDir, 'batch-b.txt')}", and "${path.join(this.testDir, 'batch-c.txt')}" with content "File A", "File B", and "File C" respectively`
      },
      {
        title: 'Test 5: Bash Tool',
        instruction: `Run "ls -la ${this.testDir}" to list the test directory contents`
      },
      {
        title: 'Test 6: Glob + Read Pattern',
        instruction: `Find all .txt files in "${this.testDir}" and read the contents of the first one`
      },
      {
        title: 'Test 7: Internal Command (NO HOOKS EXPECTED)',
        instruction: `Try the /compact command to see if internal commands trigger hooks`
      },
      {
        title: 'Test 8: MultiEdit Tool',
        instruction: `Use MultiEdit to make multiple changes to "${path.join(this.testDir, 'test-edit.js')}" - change both the function name and the console.log message`
      }
    ];

    tests.forEach((test, index) => {
      this.log(`${test.title}:`);
      this.log(`"${test.instruction}"`);
      this.log('');
    });
  }

  analyzeResults() {
    this.log('=== How to Analyze Results ===');
    this.log('');
    this.log('After running the tests above, check these files:');
    this.log(`1. ${path.join(process.cwd(), 'claude-tool-events.log')} - Our enhanced tool logging`);
    this.log(`2. Git commit history - Check if auto-commits were created`);
    this.log(`3. Hook output in Claude Code console`);
    this.log('');
    this.log('Look for patterns:');
    this.log('- Which tools trigger PreToolUse/PostToolUse hooks?');
    this.log('- Do BatchTool operations create multiple hook events?');
    this.log('- Do internal commands (like /compact) trigger any hooks?');
    this.log('- What parameters are passed to each tool type?');
    this.log('');
  }

  createAnalysisScript() {
    const analysisCode = `#!/usr/bin/env node

// Analysis script for tool test results
const fs = require('fs');
const path = require('path');

class ResultAnalyzer {
  analyze() {
    console.log('=== Tool Test Results Analysis ===\\n');
    
    // Check for tool events log
    const toolLogPath = 'claude-tool-events.log';
    if (fs.existsSync(toolLogPath)) {
      console.log('✅ Tool events log found');
      const content = fs.readFileSync(toolLogPath, 'utf8');
      const events = content.split('\\n\\n').filter(e => e.trim());
      console.log(\`📊 Total tool events logged: \${events.length}\`);
      
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
        console.log(\`  - \${tool}\`);
      });
    } else {
      console.log('❌ No tool events log found');
    }
    
    // Check git history for auto-commits
    console.log('\\n=== Git Commit Analysis ===');
    try {
      const { execSync } = require('child_process');
      const gitLog = execSync('git log --oneline -10', { encoding: 'utf8' });
      const autoCommits = gitLog.split('\\n').filter(line => 
        line.includes('Auto-commit:') || line.includes('rins_hooks')
      );
      console.log(\`📝 Auto-commits created: \${autoCommits.length}\`);
      autoCommits.forEach(commit => {
        console.log(\`  \${commit}\`);
      });
    } catch (error) {
      console.log('❌ Could not analyze git history');
    }
  }
}

new ResultAnalyzer().analyze();
`;

    const analysisPath = path.join(process.cwd(), 'analyze-tool-results.js');
    fs.writeFileSync(analysisPath, analysisCode);
    fs.chmodSync(analysisPath, '755');
    
    this.log(`Created analysis script: ${analysisPath}`);
    this.log('Run "node analyze-tool-results.js" after completing the tests');
  }

  run() {
    this.createTestFiles();
    this.generateTestInstructions();
    this.analyzeResults();
    this.createAnalysisScript();
    
    this.log('=== Test Setup Complete ===');
    this.log('');
    this.log('Next steps:');
    this.log('1. Copy the test instructions above into Claude Code');
    this.log('2. Run each test and observe the hook behavior');
    this.log('3. Run "node analyze-tool-results.js" to analyze results');
    this.log('4. Compare findings with the blog post insights');
  }
}

// Run the test setup
const tester = new ClaudeToolTester();
tester.run();