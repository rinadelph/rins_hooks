#!/usr/bin/env node

/**
 * Cross-platform compatibility test script
 * Tests that rins_hooks works correctly on different operating systems
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
const arch = os.arch();

console.log(`🧪 Running cross-platform tests on ${platform} (${arch})`);

// Test configurations for different platforms
const tests = [
  {
    name: 'CLI Help Command',
    command: 'node',
    args: ['src/cli.js', '--help'],
    expectSuccess: true,
    expectedOutput: 'rins_hooks'
  },
  {
    name: 'CLI Version Command', 
    command: 'node',
    args: ['src/cli.js', '--version'],
    expectSuccess: true,
    expectedOutput: /\d+\.\d+\.\d+/
  },
  {
    name: 'CLI Doctor Command',
    command: 'node', 
    args: ['src/cli.js', 'doctor'],
    expectSuccess: true,
    expectedOutput: 'Node.js Version'
  },
  {
    name: 'CLI List Command',
    command: 'node',
    args: ['src/cli.js', 'list'], 
    expectSuccess: true,
    expectedOutput: 'auto-commit'
  }
];

// Platform-specific command adjustments
if (platform === 'win32') {
  console.log('📘 Adjusting commands for Windows platform');
  // Windows-specific adjustments could go here
}

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`  Running: ${test.name}`);
    
    const child = spawn(test.command, test.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: platform === 'win32' // Use shell on Windows
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const success = test.expectSuccess ? code === 0 : code !== 0;
      let outputMatch = true;
      
      if (test.expectedOutput) {
        if (test.expectedOutput instanceof RegExp) {
          outputMatch = test.expectedOutput.test(stdout);
        } else {
          outputMatch = stdout.includes(test.expectedOutput);
        }
      }

      const passed = success && outputMatch;
      
      console.log(`    ${passed ? '✅' : '❌'} ${test.name}`);
      if (!passed) {
        console.log(`      Expected success: ${test.expectSuccess}, got code: ${code}`);
        if (test.expectedOutput && !outputMatch) {
          console.log(`      Expected output: ${test.expectedOutput}`);
          console.log(`      Actual output: ${stdout.substring(0, 100)}...`);
        }
        if (stderr) {
          console.log(`      Error output: ${stderr.substring(0, 100)}...`);
        }
      }

      resolve({ passed, test: test.name });
    });

    child.on('error', (error) => {
      console.log(`    ❌ ${test.name} - Error: ${error.message}`);
      resolve({ passed: false, test: test.name, error: error.message });
    });
  });
}

async function testPlatformSpecific() {
  console.log('\n🔧 Testing platform-specific functionality:');
  
  // Test path normalization
  const testPath = '/test/path/file.js';
  const Utils = require('../src/utils');
  const utils = new Utils();
  
  const normalizedPath = utils.normalizePath(testPath);
  console.log(`  ✅ Path normalization: ${testPath} → ${normalizedPath}`);
  
  // Test executable extension
  const execExt = utils.getExecutableExtension();
  const expectedExt = platform === 'win32' ? '.exe' : '';
  const extCorrect = execExt === expectedExt;
  console.log(`  ${extCorrect ? '✅' : '❌'} Executable extension: "${execExt}" (expected: "${expectedExt}")`);
  
  // Test system info
  const sysInfo = utils.getSystemInfo();
  console.log(`  ✅ System info: ${sysInfo.platform} ${sysInfo.arch} Node.js ${sysInfo.nodeVersion}`);
  
  return extCorrect;
}

async function main() {
  console.log('\n🚀 Starting cross-platform compatibility tests...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Run CLI tests
  console.log('📋 CLI Command Tests:');
  for (const test of tests) {
    const result = await runTest(test);
    totalTests++;
    if (result.passed) passedTests++;
  }
  
  // Run platform-specific tests
  const platformTestPassed = await testPlatformSpecific();
  totalTests++;
  if (platformTestPassed) passedTests++;
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`  Platform: ${platform} (${arch})`);
  console.log(`  Node.js: ${process.version}`);
  console.log(`  Tests passed: ${passedTests}/${totalTests}`);
  console.log(`  Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All cross-platform tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some cross-platform tests failed!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { main, runTest, testPlatformSpecific };