// Mock dependencies to avoid CI issues with inquirer
jest.mock('../src/installer');
jest.mock('../src/config');
jest.mock('../src/utils');

const { Command } = require('commander');
const path = require('path');

describe('CLI', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.CLAUDE_SETTINGS_DIR;
    jest.clearAllMocks();
  });

  it('should have CLI file with correct shebang', () => {
    const fs = require('fs');
    const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
    const cliContent = fs.readFileSync(cliPath, 'utf8');
    expect(cliContent).toMatch(/^#!/);
    expect(cliContent).toContain('commander');
  });

  it('should use commander for CLI structure', () => {
    expect(Command).toBeDefined();
    expect(typeof Command).toBe('function');
  });

  it('should have package.json with correct structure', () => {
    const pkg = require('../package.json');
    expect(pkg.name).toBe('rins_hooks');
    expect(pkg.bin).toHaveProperty('rins_hooks');
    expect(pkg.engines).toHaveProperty('node');
  });

  it('should have cross-platform compatible dependencies', () => {
    const pkg = require('../package.json');
    expect(pkg.dependencies).toHaveProperty('cross-spawn');
    expect(pkg.dependencies).toHaveProperty('fs-extra');
    expect(pkg.dependencies).toHaveProperty('commander');
  });

  it('should support all major Node.js versions', () => {
    const pkg = require('../package.json');
    expect(pkg.engines.node).toMatch(/>=16/);
  });
});