const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { spawn } = require('child_process');

/**
 * Advanced Status Line Management System
 * Handles components, themes, templates, and live editing
 */
class StatusLineManager {
  constructor() {
    this.componentsDir = path.join(__dirname, 'components');
    this.templatesDir = path.join(__dirname, 'templates');
    this.themesDir = path.join(__dirname, 'themes');
    this.currentConfig = null;
    this.livePreview = true;
    this.availableComponents = [];
    this.availableTemplates = [];
    this.loadComponents();
    this.loadTemplates();
  }

  /**
   * Load available components
   */
  loadComponents() {
    try {
      if (fs.existsSync(this.componentsDir)) {
        const files = fs.readdirSync(this.componentsDir).filter(f => f.endsWith('.js'));
        this.availableComponents = files.map(f => {
          const name = f.replace('.js', '');
          const component = require(path.join(this.componentsDir, f));
          return { name, ...component };
        });
      }
      
      // Add built-in components if directory doesn't exist
      if (this.availableComponents.length === 0) {
        this.availableComponents = this.getBuiltInComponents();
      }
    } catch (error) {
      this.availableComponents = this.getBuiltInComponents();
    }
  }

  /**
   * Load available templates
   */
  loadTemplates() {
    try {
      if (fs.existsSync(this.templatesDir)) {
        const files = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.js'));
        this.availableTemplates = files.map(f => {
          const name = f.replace('.js', '');
          const template = require(path.join(this.templatesDir, f));
          return { name, ...template };
        });
      }
      
      // Add built-in templates if directory doesn't exist
      if (this.availableTemplates.length === 0) {
        this.availableTemplates = this.getBuiltInTemplates();
      }
    } catch (error) {
      this.availableTemplates = this.getBuiltInTemplates();
    }
  }

  /**
   * Get built-in components
   */
  getBuiltInComponents() {
    return [
      {
        name: 'model',
        displayName: 'Model Name',
        description: 'Shows the current Claude model',
        icon: '🤖',
        configurable: true,
        defaultConfig: { style: 'brackets', color: 'magenta' }
      },
      {
        name: 'directory',
        displayName: 'Directory',
        description: 'Shows current working directory',
        icon: '📁',
        configurable: true,
        defaultConfig: { style: 'icon', color: 'cyan', showFull: false }
      },
      {
        name: 'git',
        displayName: 'Git Status',
        description: 'Shows git branch and changes',
        icon: '🌿',
        configurable: true,
        defaultConfig: { showChanges: true, showAhead: true, color: 'green' }
      },
      {
        name: 'time',
        displayName: 'Time',
        description: 'Shows current time',
        icon: '🕐',
        configurable: true,
        defaultConfig: { format: 'HH:mm:ss', color: 'yellow' }
      },
      {
        name: 'system',
        displayName: 'System Info',
        description: 'Shows CPU, memory, load',
        icon: '📊',
        configurable: true,
        defaultConfig: { showCPU: true, showMemory: true, showLoad: true }
      },
      {
        name: 'docker',
        displayName: 'Docker Status',
        description: 'Shows running containers',
        icon: '🐳',
        configurable: true,
        defaultConfig: { showCount: true, showNames: false }
      },
      {
        name: 'custom',
        displayName: 'Custom Text',
        description: 'Custom text or command output',
        icon: '✨',
        configurable: true,
        defaultConfig: { text: '', command: '', color: 'white' }
      }
    ];
  }

  /**
   * Get built-in templates
   */
  getBuiltInTemplates() {
    return [
      {
        name: 'minimal',
        displayName: 'Minimal',
        description: 'Just model and directory',
        preview: '[Claude] 📁 project',
        components: ['model', 'directory'],
        separator: ' ',
        colors: { model: 'magenta', directory: 'cyan' }
      },
      {
        name: 'developer',
        displayName: 'Developer',
        description: 'Git, time, and directory info',
        preview: '[Claude] 📁 project | 🌿 main | 15:30:45',
        components: ['model', 'directory', 'git', 'time'],
        separator: ' | ',
        colors: { model: 'magenta', directory: 'cyan', git: 'green', time: 'yellow' }
      },
      {
        name: 'powerline',
        displayName: 'Powerline Style',
        description: 'Rich symbols and colors',
        preview: ' Claude  📁 project  🌿 main  15:30:45 ',
        components: ['model', 'directory', 'git', 'time'],
        separator: '  ',
        style: 'powerline',
        colors: { model: 'bg_magenta', directory: 'bg_cyan', git: 'bg_green', time: 'bg_yellow' }
      },
      {
        name: 'system-monitor',
        displayName: 'System Monitor',
        description: 'Includes system information',
        preview: '[Claude] 📁 project | 🌿 main | CPU:45% | 15:30:45',
        components: ['model', 'directory', 'git', 'system', 'time'],
        separator: ' | ',
        colors: { model: 'magenta', directory: 'cyan', git: 'green', system: 'blue', time: 'yellow' }
      },
      {
        name: 'docker-dev',
        displayName: 'Docker Developer',
        description: 'For containerized development',
        preview: '[Claude] 📁 project | 🌿 main | 🐳 3 | 15:30:45',
        components: ['model', 'directory', 'git', 'docker', 'time'],
        separator: ' | ',
        colors: { model: 'magenta', directory: 'cyan', git: 'green', docker: 'blue', time: 'yellow' }
      },
      {
        name: 'compact',
        displayName: 'Compact',
        description: 'Ultra-compact aesthetic design',
        preview: 'S4 project 🌿main* 15:30',
        components: ['model', 'directory', 'git', 'time'],
        separator: ' ',
        style: 'compact',
        colors: { model: 'magenta', directory: 'cyan', git: 'green', time: 'yellow' },
        script: '/home/alejandro/.claude/statusline-compact.sh'
      }
    ];
  }

  /**
   * Get current status line configuration
   */
  async getCurrentConfig() {
    if (this.currentConfig) {
      return this.currentConfig;
    }

    const settingsPaths = [
      path.join(process.cwd(), '.claude', 'settings.json'),
      path.join(process.cwd(), '.claude', 'settings.local.json'),
      path.join(require('os').homedir(), '.claude', 'settings.json')
    ];

    for (const settingsPath of settingsPaths) {
      if (fs.existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          if (settings.statusLine) {
            this.currentConfig = settings.statusLine;
            return this.currentConfig;
          }
        } catch (error) {
          // Continue to next settings file
        }
      }
    }

    return null;
  }

  /**
   * Generate status line script from template
   */
  generateScript(template, components = null, customConfig = {}) {
    const selectedComponents = components || template.components;
    const separator = customConfig.separator || template.separator || ' | ';
    const colors = { ...template.colors, ...customConfig.colors };

    let script = `#!/bin/bash\n# Generated Status Line Script\n# Template: ${template.displayName}\n\n`;
    script += `# Read JSON input from stdin\ninput=$(cat)\n\n`;
    script += `# Extract values using jq if available\nif command -v jq >/dev/null 2>&1; then\n`;
    
    // Generate component extraction
    selectedComponents.forEach(comp => {
      const component = this.availableComponents.find(c => c.name === comp);
      if (component) {
        script += this.generateComponentExtraction(component);
      }
    });

    script += `else\n  # Fallback without jq\n`;
    script += `  MODEL_DISPLAY="Claude"\n`;
    script += `  CURRENT_DIR=$(basename "$(pwd)")\nfi\n\n`;

    // Generate output line
    script += `# Output status line\n`;
    script += `echo -e "${this.generateOutputLine(selectedComponents, separator, colors)}"\n`;

    return script;
  }

  /**
   * Generate component extraction for script
   */
  generateComponentExtraction(component) {
    switch (component.name) {
      case 'model':
        return `  MODEL_DISPLAY=$(echo "$input" | jq -r '.model.display_name')\n`;
      case 'directory':
        return `  CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir')\n`;
      case 'git':
        return `  # Git info extracted later\n`;
      case 'time':
        return `  # Time generated at output\n`;
      case 'system':
        return `  # System info generated at output\n`;
      case 'docker':
        return `  # Docker info generated at output\n`;
      default:
        return `  # ${component.displayName} - custom handling\n`;
    }
  }

  /**
   * Generate output line for script
   */
  generateOutputLine(components, separator, colors) {
    const parts = [];
    
    components.forEach(compName => {
      const component = this.availableComponents.find(c => c.name === compName);
      if (!component) return;

      const color = this.getANSIColor(colors[compName] || 'white');
      
      switch (compName) {
        case 'model':
          parts.push(`${color}[\\${MODEL_DISPLAY}]\\033[0m`);
          break;
        case 'directory':
          parts.push(`${color}📁 $(basename "$CURRENT_DIR")\\033[0m`);
          break;
        case 'git':
          parts.push(`${color}$(this.generateGitStatus())\\033[0m`);
          break;
        case 'time':
          parts.push(`${color}$(date +%H:%M:%S)\\033[0m`);
          break;
        case 'system':
          parts.push(`${color}CPU:$(this.generateSystemInfo())\\033[0m`);
          break;
        case 'docker':
          parts.push(`${color}🐳 $(this.generateDockerInfo())\\033[0m`);
          break;
      }
    });

    return parts.join(separator);
  }

  /**
   * Get ANSI color code
   */
  getANSIColor(color) {
    const colors = {
      black: '\\033[0;30m',
      red: '\\033[0;31m',
      green: '\\033[0;32m',
      yellow: '\\033[0;33m',
      blue: '\\033[0;34m',
      magenta: '\\033[0;35m',
      cyan: '\\033[0;36m',
      white: '\\033[0;37m',
      bold_black: '\\033[1;30m',
      bold_red: '\\033[1;31m',
      bold_green: '\\033[1;32m',
      bold_yellow: '\\033[1;33m',
      bold_blue: '\\033[1;34m',
      bold_magenta: '\\033[1;35m',
      bold_cyan: '\\033[1;36m',
      bold_white: '\\033[1;37m'
    };
    return colors[color] || colors.white;
  }

  /**
   * Generate git status code for script
   */
  generateGitStatus() {
    return `\n# Git status\nGIT_BRANCH=""\nif git rev-parse --git-dir > /dev/null 2>&1; then\n  BRANCH=$(git branch --show-current 2>/dev/null)\n  if [ -n "$BRANCH" ]; then\n    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then\n      GIT_BRANCH="🌿 $BRANCH*"\n    else\n      GIT_BRANCH="🌿 $BRANCH"\n    fi\n  fi\nfi\necho -n "$GIT_BRANCH"`;
  }

  /**
   * Execute status line command for testing
   */
  async executeStatusLine(config) {
    if (!config || config.type !== 'command') {
      return null;
    }

    const inputData = {
      hook_event_name: "Status",
      session_id: require('crypto').randomUUID(),
      transcript_path: "/dev/null",
      cwd: process.cwd(),
      model: {
        id: "rapala-ui",
        display_name: "Rapala"
      },
      workspace: {
        current_dir: process.cwd(),
        project_dir: process.cwd()
      }
    };

    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', config.command], {
        stdio: ['pipe', 'pipe', 'pipe']
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
        if (code === 0) {
          resolve(stdout.split('\n')[0].trim());
        } else {
          reject(new Error(`Command failed: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.stdin.write(JSON.stringify(inputData));
      child.stdin.end();
    });
  }

  /**
   * Save status line configuration
   */
  async saveConfig(config, scope = 'user') {
    const settingsPath = scope === 'user' 
      ? path.join(require('os').homedir(), '.claude', 'settings.json')
      : path.join(process.cwd(), '.claude', 'settings.json');

    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(settingsPath), { recursive: true });

    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (error) {
        settings = {};
      }
    }

    settings.statusLine = config;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    this.currentConfig = config;
  }

  /**
   * Remove status line configuration
   */
  async removeConfig(scope = 'user') {
    const settingsPath = scope === 'user'
      ? path.join(require('os').homedir(), '.claude', 'settings.json')
      : path.join(process.cwd(), '.claude', 'settings.json');

    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        delete settings.statusLine;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        this.currentConfig = null;
        return true;
      } catch (error) {
        throw new Error(`Failed to remove config: ${error.message}`);
      }
    }
    return false;
  }

  /**
   * Apply compact template directly
   */
  async applyCompactTemplate() {
    const compactTemplate = this.availableTemplates.find(t => t.name === 'compact');
    if (!compactTemplate) {
      throw new Error('Compact template not found');
    }

    const config = {
      type: 'command',
      command: compactTemplate.script,
      padding: 0
    };

    await this.saveConfig(config, 'user');
    console.log(chalk.green('✓ Compact status line applied successfully!'));
    console.log(chalk.cyan('Please restart Claude Code to see the changes.'));
    return config;
  }
}

module.exports = StatusLineManager;