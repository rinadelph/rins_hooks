#!/usr/bin/env node

const Installer = require('./src/installer');

async function testInstall() {
  try {
    console.log('Testing installer...');
    const installer = new Installer();
    
    console.log('Getting available hooks...');
    const hooks = await installer.getAvailableHooks();
    console.log(`Found ${hooks.length} hooks`);
    
    console.log('Testing dry run installation...');
    await installer.installHooks(['code-formatter'], { user: true, dryRun: true });
    
    console.log('Installer test completed successfully!');
  } catch (error) {
    console.error('Installer test failed:', error.message);
    console.error(error.stack);
  }
}

testInstall();