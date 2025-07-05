const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class Utils {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
  }

  /**
   * Check if a command is available in the system PATH
   * @param {string} command - Command to check
   * @returns {Promise<boolean>} True if command is available
   */
  checkCommandAvailable(command) {
    return new Promise((resolve) => {
      const checkCommand = this.platform === 'win32' ? 'where' : 'which';

      const child = spawn(checkCommand, [command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      child.on('close', (code) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Execute a command and return the result
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Spawn options
   * @returns {Promise<Object>} Command result
   */
  executeCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
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
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get Claude Code installation path
   * @returns {Promise<string|null>} Claude Code path or null if not found
   */
  async getClaudeCodePath() {
    try {
      // Check if claude command is available
      const isAvailable = await this.checkCommandAvailable('claude');
      if (!isAvailable) {
        return null;
      }

      // Try to get the path
      const result = await this.executeCommand('which', ['claude']);
      if (result.success) {
        return result.stdout;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get Claude Code settings directory path
   * @returns {string} Settings directory path
   */
  getClaudeSettingsDir() {
    return path.join(os.homedir(), '.claude');
  }

  /**
   * Check if we're in a git repository
   * @returns {Promise<boolean>} True if in git repository
   */
  async isGitRepository() {
    try {
      const result = await this.executeCommand('git', ['rev-parse', '--git-dir']);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get git repository root path
   * @returns {Promise<string|null>} Repository root path or null
   */
  async getGitRepositoryRoot() {
    try {
      const result = await this.executeCommand('git', ['rev-parse', '--show-toplevel']);
      if (result.success) {
        return result.stdout;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Normalize file path for current platform
   * @param {string} filePath - File path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(filePath) {
    if (this.platform === 'win32') {
      return filePath.replace(/\//g, '\\');
    }
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Get platform-specific executable extension
   * @returns {string} Executable extension
   */
  getExecutableExtension() {
    return this.platform === 'win32' ? '.exe' : '';
  }

  /**
   * Check if current user has write permissions to a directory
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<boolean>} True if writable
   */
  async isDirectoryWritable(dirPath) {
    try {
      await fs.access(dirPath, fs.constants.W_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create directory with proper permissions
   * @param {string} dirPath - Directory path to create
   * @returns {Promise<boolean>} True if successful
   */
  async createDirectory(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get system information for diagnostics
   * @returns {Object} System information
   */
  getSystemInfo() {
    return {
      platform: this.platform,
      arch: this.arch,
      nodeVersion: process.version,
      osRelease: os.release(),
      homedir: os.homedir(),
      cwd: process.cwd()
    };
  }

  /**
   * Run comprehensive diagnostics
   * @returns {Promise<Array>} Diagnostic results
   */
  async runDiagnostics() {
    const diagnostics = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion >= 16) {
      diagnostics.push({
        check: 'Node.js Version',
        status: 'ok',
        message: `Node.js ${nodeVersion} (✓ >= 16.0.0)`
      });
    } else {
      diagnostics.push({
        check: 'Node.js Version',
        status: 'error',
        message: `Node.js ${nodeVersion} (✗ requires >= 16.0.0)`
      });
    }

    // Check Claude Code installation
    const claudePath = await this.getClaudeCodePath();
    if (claudePath) {
      diagnostics.push({
        check: 'Claude Code Installation',
        status: 'ok',
        message: `Found at ${claudePath}`
      });
    } else {
      diagnostics.push({
        check: 'Claude Code Installation',
        status: 'error',
        message: 'Claude Code not found in PATH'
      });
    }

    // Check git installation
    const gitAvailable = await this.checkCommandAvailable('git');
    if (gitAvailable) {
      diagnostics.push({
        check: 'Git Installation',
        status: 'ok',
        message: 'Git is available'
      });

      // Check if in git repository
      const inGitRepo = await this.isGitRepository();
      if (inGitRepo) {
        const repoRoot = await this.getGitRepositoryRoot();
        diagnostics.push({
          check: 'Git Repository',
          status: 'ok',
          message: `Repository found at ${repoRoot}`
        });
      } else {
        diagnostics.push({
          check: 'Git Repository',
          status: 'warning',
          message: 'Not in a git repository (some hooks may not work)'
        });
      }
    } else {
      diagnostics.push({
        check: 'Git Installation',
        status: 'error',
        message: 'Git not found in PATH'
      });
    }

    // Check Claude settings directory
    const settingsDir = this.getClaudeSettingsDir();
    const settingsDirExists = await fs.pathExists(settingsDir);

    if (settingsDirExists) {
      const isWritable = await this.isDirectoryWritable(settingsDir);
      if (isWritable) {
        diagnostics.push({
          check: 'Claude Settings Directory',
          status: 'ok',
          message: `${settingsDir} (writable)`
        });
      } else {
        diagnostics.push({
          check: 'Claude Settings Directory',
          status: 'error',
          message: `${settingsDir} (not writable)`
        });
      }
    } else {
      const created = await this.createDirectory(settingsDir);
      if (created) {
        diagnostics.push({
          check: 'Claude Settings Directory',
          status: 'ok',
          message: `Created ${settingsDir}`
        });
      } else {
        diagnostics.push({
          check: 'Claude Settings Directory',
          status: 'error',
          message: `Cannot create ${settingsDir}`
        });
      }
    }

    // Check for existing Claude settings
    const userSettingsPath = path.join(settingsDir, 'settings.json');
    const userSettingsExists = await fs.pathExists(userSettingsPath);

    if (userSettingsExists) {
      try {
        await fs.readJson(userSettingsPath);
        diagnostics.push({
          check: 'Claude User Settings',
          status: 'ok',
          message: 'Valid JSON configuration found'
        });
      } catch (error) {
        diagnostics.push({
          check: 'Claude User Settings',
          status: 'error',
          message: 'Invalid JSON in settings file'
        });
      }
    } else {
      diagnostics.push({
        check: 'Claude User Settings',
        status: 'warning',
        message: 'No user settings found (will be created when needed)'
      });
    }

    // Check project settings
    const projectSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    const projectSettingsExists = await fs.pathExists(projectSettingsPath);

    if (projectSettingsExists) {
      try {
        await fs.readJson(projectSettingsPath);
        diagnostics.push({
          check: 'Claude Project Settings',
          status: 'ok',
          message: 'Valid JSON configuration found'
        });
      } catch (error) {
        diagnostics.push({
          check: 'Claude Project Settings',
          status: 'error',
          message: 'Invalid JSON in project settings file'
        });
      }
    } else {
      diagnostics.push({
        check: 'Claude Project Settings',
        status: 'warning',
        message: 'No project settings found (will be created when needed)'
      });
    }

    // Check for jq (useful for hook development)
    const jqAvailable = await this.checkCommandAvailable('jq');
    if (jqAvailable) {
      diagnostics.push({
        check: 'jq Tool',
        status: 'ok',
        message: 'Available for JSON processing'
      });
    } else {
      diagnostics.push({
        check: 'jq Tool',
        status: 'warning',
        message: 'Not available (optional, useful for hook development)'
      });
    }

    return diagnostics;
  }

  /**
   * Get platform-specific installation instructions
   * @param {string} tool - Tool name
   * @returns {string|null} Installation instructions
   */
  getInstallationInstructions(tool) {
    const instructions = {
      'claude': {
        'linux': 'Install Claude Code from https://docs.anthropic.com/en/docs/claude-code',
        'darwin': 'Install Claude Code from https://docs.anthropic.com/en/docs/claude-code',
        'win32': 'Install Claude Code from https://docs.anthropic.com/en/docs/claude-code'
      },
      'git': {
        'linux': 'sudo apt-get install git (Ubuntu/Debian) or sudo yum install git (RHEL/CentOS)',
        'darwin': 'brew install git or download from https://git-scm.com/',
        'win32': 'Download from https://git-scm.com/ or use winget install Git.Git'
      },
      'jq': {
        'linux': 'sudo apt-get install jq (Ubuntu/Debian) or sudo yum install jq (RHEL/CentOS)',
        'darwin': 'brew install jq',
        'win32': 'Download from https://jqlang.github.io/jq/ or use winget install jqlang.jq'
      }
    };

    return instructions[tool]?.[this.platform] || null;
  }
}

module.exports = Utils;
