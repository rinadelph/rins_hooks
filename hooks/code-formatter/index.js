#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const HookBase = require('../../src/hook-base');

class CodeFormatterHook extends HookBase {
  constructor(config = {}) {
    super('code-formatter', config);
  }

  getDefaultConfig() {
    return {
      enabled: true,
      matcher: 'Edit|Write|MultiEdit',
      timeout: 30,
      description: 'Automatically format code after file modifications',
      formatters: {
        '.js': 'prettier --write',
        '.jsx': 'prettier --write',
        '.ts': 'prettier --write',
        '.tsx': 'prettier --write',
        '.json': 'prettier --write',
        '.css': 'prettier --write',
        '.scss': 'prettier --write',
        '.html': 'prettier --write',
        '.md': 'prettier --write',
        '.py': 'black',
        '.go': 'gofmt -w',
        '.rs': 'rustfmt',
        '.java': 'google-java-format --replace',
        '.c': 'clang-format -i',
        '.cpp': 'clang-format -i',
        '.h': 'clang-format -i'
      },
      excludePatterns: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '*.min.js',
        '*.min.css'
      ],
      useProjectConfig: true,
      failOnError: false,
      showOutput: false
    };
  }

  async execute(input) {
    try {
      const { tool_input } = input;

      // Extract file path from tool input
      const filePath = tool_input.file_path || tool_input.filePath;

      if (!filePath) {
        return this.error('No file path found in tool input');
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return this.error(`File does not exist: ${filePath}`);
      }

      // Check if file should be excluded
      if (this.shouldExcludeFile(filePath)) {
        return this.success({ message: `File excluded from formatting: ${filePath}` });
      }

      // Get file extension
      const ext = path.extname(filePath);

      // Check if we have a formatter for this file type
      const formatter = this.config.formatters[ext];
      if (!formatter) {
        return this.success({ message: `No formatter configured for ${ext} files` });
      }

      // Check if formatter is available
      const formatterCommand = formatter.split(' ')[0];
      if (!await this.isCommandAvailable(formatterCommand)) {
        if (this.config.failOnError) {
          return this.error(`Formatter not available: ${formatterCommand}`);
        } else {
          return this.success({ message: `Formatter not available, skipping: ${formatterCommand}` });
        }
      }

      // Format the file
      const result = await this.formatFile(filePath, formatter);

      if (result.success) {
        return this.success({
          message: `Successfully formatted ${path.basename(filePath)}`,
          filePath: filePath,
          formatter: formatterCommand,
          output: this.config.showOutput ? result.output : undefined
        });
      } else {
        if (this.config.failOnError) {
          return this.error(`Formatting failed: ${result.error}`);
        } else {
          return this.success({
            message: `Formatting failed but continuing: ${result.error}`,
            filePath: filePath
          });
        }
      }

    } catch (error) {
      return this.error(`Code formatting failed: ${error.message}`);
    }
  }

  shouldExcludeFile(filePath) {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(process.cwd(), filePath);

    return this.config.excludePatterns.some(pattern => {
      // Simple glob-like matching
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(fileName) || regex.test(relativePath);
    });
  }

  isCommandAvailable(command) {
    return new Promise((resolve) => {
      const checkCommand = process.platform === 'win32' ? 'where' : 'which';

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

  formatFile(filePath, formatter) {
    return new Promise((resolve) => {
      // Parse formatter command and arguments
      const parts = formatter.split(' ');
      const command = parts[0];
      const args = [...parts.slice(1), filePath];

      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
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
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message,
          exitCode: -1
        });
      });
    });
  }

  findProjectConfig(filePath, configFiles) {
    let dir = path.dirname(filePath);
    const root = path.parse(dir).root;

    while (dir !== root) {
      for (const configFile of configFiles) {
        const configPath = path.join(dir, configFile);
        if (fs.existsSync(configPath)) {
          return configPath;
        }
      }
      dir = path.dirname(dir);
    }

    return null;
  }

  async getFormatterConfig(formatter, filePath) {
    if (!this.config.useProjectConfig) {
      return null;
    }

    // Map formatters to their config files
    const configMap = {
      'prettier': ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'],
      'eslint': ['.eslintrc', '.eslintrc.json', '.eslintrc.js'],
      'black': ['pyproject.toml', 'setup.cfg'],
      'rustfmt': ['rustfmt.toml', '.rustfmt.toml']
    };

    const configFiles = configMap[formatter];
    if (!configFiles) {
      return null;
    }

    return await this.findProjectConfig(filePath, configFiles);
  }
}

// If called directly, execute the hook
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const hook = new CodeFormatterHook();
      const result = await hook.execute(input);
      HookBase.outputResult(result);
    } catch (error) {
      console.error(`Code formatter hook error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = CodeFormatterHook;
