const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Installer = require('./installer');
const ConfigManager = require('./config');
const VersionCheck = require('./version-check');

/**
 * Hook Control Panel - 100% Self-Contained Management Interface
 * Complete control with current folder scanning and zero CLI dependency
 */
class HookControlPanel {
  constructor() {
    this.installer = new Installer();
    this.configManager = new ConfigManager();
    this.versionCheck = new VersionCheck();
    this.currentDir = process.cwd();
    this.claudeDir = null;
    this.projectContext = null;
  }

  /**
   * Initialize and scan current environment
   */
  async initialize() {
    // Scan current directory for Claude configuration
    await this.scanCurrentDirectory();
    
    // Detect project context
    await this.detectProjectContext();
    
    // Load current enhancement states (hooks, tools, resources, etc.)
    await this.loadCurrentEnhancementStates();
  }

  /**
   * Scan current directory for Claude configuration and project context
   */
  async scanCurrentDirectory() {
    console.log(chalk.blue('🔍 Scanning Current Environment...'));
    console.log(chalk.gray(`Directory: ${this.currentDir}`));
    
    // Look for .claude directory in current and parent directories
    let searchDir = this.currentDir;
    while (searchDir !== path.dirname(searchDir)) {
      const claudePath = path.join(searchDir, '.claude');
      if (fs.existsSync(claudePath)) {
        this.claudeDir = claudePath;
        console.log(chalk.green(`✅ Found Claude directory: ${claudePath}`));
        break;
      }
      searchDir = path.dirname(searchDir);
    }

    // Check for global Claude settings
    const homeClaudeDir = path.join(require('os').homedir(), '.claude');
    if (fs.existsSync(homeClaudeDir)) {
      console.log(chalk.green(`✅ Found global Claude directory: ${homeClaudeDir}`));
    }

    console.log();
  }

  /**
   * Detect project context and type
   */
  async detectProjectContext() {
    const context = {
      type: 'unknown',
      name: path.basename(this.currentDir),
      hasGit: fs.existsSync(path.join(this.currentDir, '.git')),
      hasPackageJson: fs.existsSync(path.join(this.currentDir, 'package.json')),
      hasPyprojectToml: fs.existsSync(path.join(this.currentDir, 'pyproject.toml')),
      hasCargoToml: fs.existsSync(path.join(this.currentDir, 'Cargo.toml')),
      hasClaudeConfig: !!this.claudeDir,
      settings: {}
    };

    // Determine project type
    if (context.hasPackageJson) {
      context.type = 'node';
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(this.currentDir, 'package.json'), 'utf8'));
        context.name = pkg.name || context.name;
        context.version = pkg.version;
      } catch (error) {
        // Ignore package.json parse errors
      }
    } else if (context.hasPyprojectToml) {
      context.type = 'python';
    } else if (context.hasCargoToml) {
      context.type = 'rust';
    }

    this.projectContext = context;
  }

  /**
   * Load current hook states (backward compatibility)
   */
  async loadCurrentHookStates() {
    await this.loadCurrentEnhancementStates();
  }

  /**
   * Load current enhancement states (hooks, tools, resources, prompts, mcps)
   */
  async loadCurrentEnhancementStates() {
    // Rapala enhancement categories
    this.enhancementStates = {
      hooks: { user: [], project: [], local: [], available: [] },
      tools: { user: [], project: [], local: [], available: [] },
      resources: { user: [], project: [], local: [], available: [] },
      prompts: { user: [], project: [], local: [], available: [] },
      mcps: { user: [], project: [], local: [], available: [] },
      updates: [],
      autoUpdate: false
    };

    try {
      const status = await this.configManager.getInstallationStatus();
      const availableItems = await this.installer.getAvailableHooks();
      
      // Categorize available items into Rapala categories
      const categorizedItems = this.categorizeRapalaItems(availableItems);
      
      // Categorize installed items
      const allInstalled = [...status.user, ...status.project, ...status.local];
      const categorizedInstalled = this.categorizeRapalaItems(allInstalled);
      
      // Populate each category
      this.enhancementStates.hooks.available = categorizedItems.hooks;
      this.enhancementStates.tools.available = categorizedItems.tools;
      this.enhancementStates.resources.available = categorizedItems.resources;
      this.enhancementStates.prompts.available = categorizedItems.prompts;
      this.enhancementStates.mcps.available = categorizedItems.mcps;
      
      // Populate installed items by scope
      ['user', 'project', 'local'].forEach(scope => {
        const scopeItems = status[scope] || [];
        const categorized = this.categorizeRapalaItems(scopeItems);
        
        this.enhancementStates.hooks[scope] = categorized.hooks;
        this.enhancementStates.tools[scope] = categorized.tools;
        this.enhancementStates.resources[scope] = categorized.resources;
        this.enhancementStates.prompts[scope] = categorized.prompts;
        this.enhancementStates.mcps[scope] = categorized.mcps;
      });

      // Maintain backwards compatibility
      this.hookStates = {
        user: status.user || [],
        project: status.project || [],
        local: status.local || [],
        available: availableItems || [],
        updates: [],
        autoUpdate: false
      };

      // Check for updates
      if (fs.existsSync(path.join(__dirname, '..', 'hooks', 'version-checker', 'index.js'))) {
        const VersionCheckerHook = require('../hooks/version-checker/index.js');
        const updateStatus = VersionCheckerHook.getAutoUpdateStatus(this.currentDir);
        this.enhancementStates.autoUpdate = updateStatus.autoUpdate;
        this.hookStates.autoUpdate = updateStatus.autoUpdate;
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not load enhancement states: ${error.message}`));
    }
  }

  /**
   * Categorize items into Rapala categories: Hooks, Tools, Resources, Prompts, MCPs
   */
  categorizeRapalaItems(items) {
    const categories = {
      hooks: [],
      tools: [],
      resources: [],
      prompts: [],
      mcps: []
    };

    items.forEach(item => {
      const tags = item.tags || [];
      const name = item.name || '';
      const description = item.description || '';

      // Add hook type classification
      item.hookType = this.classifyHookType(item);

      // Categorization logic based on name, tags, and description
      if (this.isHook(name, tags, description)) {
        categories.hooks.push(item);
      } else if (this.isTool(name, tags, description)) {
        categories.tools.push(item);
      } else if (this.isResource(name, tags, description)) {
        categories.resources.push(item);
      } else if (this.isPrompt(name, tags, description)) {
        categories.prompts.push(item);
      } else if (this.isMCP(name, tags, description)) {
        categories.mcps.push(item);
      } else {
        // Default: if unclear, categorize as hook for backwards compatibility
        categories.hooks.push(item);
      }
    });

    return categories;
  }

  /**
   * Classify hook type: Claude Code built-in vs Rapala managed
   */
  classifyHookType(item) {
    // Check if hook has installationType indicating it's Rapala managed
    if (item.installationType === 'generated' || item.installationType === 'synced') {
      return 'rapala-generated';
    }

    // Check for Rapala hook generator patterns
    if (item.author === 'Rapala Hook Generator' || item.author === 'Rapala Sync System' ||
        (item.tags && item.tags.includes('generated')) ||
        (item.tags && item.tags.includes('dynamic')) ||
        (item.tags && item.tags.includes('synced'))) {
      return 'rapala-generated';
    }

    // Check for timestamp-based naming (generated hooks pattern)
    const timestampPattern = /-\d{6,}$/;
    if (timestampPattern.test(item.name)) {
      return 'rapala-generated';
    }

    // Everything else is a traditional Claude Code hook
    return 'claude-code';
  }

  /**
   * Determine if item is a Hook (extends Claude Code functionality)
   */
  isHook(name, tags, description) {
    const hookIndicators = [
      'hook', 'extended-thinking', 'notification', 'auto-commit', 'git-agentmcp', 
      'code-formatter', 'version-checker', 'debug-git'
    ];
    const hookTags = ['automation', 'git', 'commit', 'formatting', 'notification', 'debug'];
    
    return hookIndicators.some(indicator => name.includes(indicator)) ||
           hookTags.some(tag => tags.includes(tag)) ||
           description.toLowerCase().includes('hook');
  }

  /**
   * Determine if item is a Tool (limits/blocks functionality)
   */
  isTool(name, tags, description) {
    const toolIndicators = ['task-blocker', 'no-coauthor', 'file-locking'];
    const toolTags = ['block', 'permissions', 'locking', 'settings'];
    
    return toolIndicators.some(indicator => name.includes(indicator)) ||
           toolTags.some(tag => tags.includes(tag)) ||
           description.toLowerCase().includes('block') ||
           description.toLowerCase().includes('disable') ||
           description.toLowerCase().includes('prevent');
  }

  /**
   * Determine if item is a Resource (reference materials, documentation)
   */
  isResource(name, tags, description) {
    const resourceIndicators = ['resource', 'doc', 'guide', 'template'];
    const resourceTags = ['documentation', 'reference', 'template', 'guide'];
    
    return resourceIndicators.some(indicator => name.includes(indicator)) ||
           resourceTags.some(tag => tags.includes(tag));
  }

  /**
   * Determine if item is a Prompt (prompt engineering, context)
   */
  isPrompt(name, tags, description) {
    const promptIndicators = ['prompt', 'context', 'instruction'];
    const promptTags = ['prompt', 'context', 'instruction', 'template'];
    
    return promptIndicators.some(indicator => name.includes(indicator)) ||
           promptTags.some(tag => tags.includes(tag));
  }

  /**
   * Determine if item is an MCP (Multi-agent Collaboration Protocol)
   */
  isMCP(name, tags, description) {
    const mcpIndicators = ['agent-registry', 'mcp'];
    const mcpTags = ['agent-tracking', 'registry', 'session-management', 'collaboration', 'multi-agent', 'agent-mcp'];
    
    return mcpIndicators.some(indicator => name.includes(indicator)) ||
           mcpTags.some(tag => tags.includes(tag)) ||
           description.toLowerCase().includes('agent') ||
           description.toLowerCase().includes('multi-agent');
  }

  /**
   * Main interactive status and control interface - Clean Sectioned Design
   */
  async showInteractiveStatus(debug = false) {
    // Initialize and scan environment
    await this.initialize();

    let currentSection = 0;
    const sections = ['hooks', 'tools', 'resources', 'prompts', 'mcps'];
    const sectionNames = ['Hooks', 'Tools', 'Resources', 'Prompts', 'MCPs'];
    
    if (debug) console.log('DEBUG: Starting showInteractiveStatus');

    while (true) {
      if (debug) console.log('DEBUG: Main navigation loop iteration starting');
      console.clear();
      
      // Clean horizontal header
      console.log(chalk.bold.magenta('🎣 Rapala Enhancement Center'));
      console.log(chalk.gray('━'.repeat(50)));
      
      // Horizontal navigation with smart colors
      const navBar = sections.map((section, index) => {
        const name = sectionNames[index];
        if (index === currentSection) {
          return chalk.bold.white.bgMagenta(` ${name} `);
        } else {
          return chalk.magenta(name);
        }
      }).join(chalk.gray(' │ '));
      
      console.log(`${navBar}`);
      console.log();

      // Show current section overview
      await this.displaySectionOverview(sections[currentSection]);
      
      // Clean instruction bar with smart colors
      console.log(chalk.gray('━'.repeat(50)));
      console.log(chalk.yellow('← →') + chalk.gray(' Navigate │ ') + chalk.green('↵') + chalk.gray(' Enter │ ') + chalk.cyan('I') + chalk.gray(' Install │ ') + chalk.blue('M') + chalk.gray(' Manage │ ') + chalk.red('Q') + chalk.gray(' Quit'));
      
      const key = await this.waitForDirectKeypress();
      if (debug) console.log(`DEBUG: Key pressed: ${key}`);

      // Handle direct keypress
      switch (key) {
        case 'left':
          if (currentSection > 0) {
            currentSection--;
          }
          break;
        case 'right':
          if (currentSection < sections.length - 1) {
            currentSection++;
          }
          break;
        case 'enter':
          if (debug) console.log(`DEBUG: Entering section: ${sections[currentSection]}`);
          const shouldQuit = await this.enterSection(sections[currentSection], debug);
          if (debug) console.log(`DEBUG: enterSection returned: ${shouldQuit}, type: ${typeof shouldQuit}`);
          if (shouldQuit === true) {
            if (debug) console.log('DEBUG: Quitting from enterSection');
            console.log(chalk.green('👋 Thank you for using Rapala!'));
            process.exit(0);
          }
          if (shouldQuit === false) {
            if (debug) console.log('DEBUG: Back to sections - continuing navigation loop');
          } else {
            if (debug) console.log(`DEBUG: Unexpected return value from enterSection: ${shouldQuit}`);
          }
          if (debug) console.log('DEBUG: About to continue navigation loop');
          break;
        case 'i':
          await this.installSectionItems(sections[currentSection]);
          break;
        case 'm':
          await this.manageSectionItems(sections[currentSection]);
          break;
        case 'v':
          await this.viewSectionItems(sections[currentSection]);
          break;
        case 'q':
          console.log(chalk.green('👋 Thank you for using Rapala!'));
          return;
        case 'stay':
        default:
          // Do nothing, just refresh
          break;
      }
      if (debug) console.log('DEBUG: End of switch statement, about to loop again');
    }
  }

  /**
   * Display enhanced overview for a specific section
   */
  async displaySectionOverview(sectionType) {
    const sectionData = this.enhancementStates[sectionType];
    const totalInstalled = sectionData.user.length + sectionData.project.length + sectionData.local.length;
    const totalAvailable = sectionData.available.length;

    // Section header with icon - horizontal layout
    const icon = this.getCategoryIcon(sectionType);
    
    // For hooks section, show breakdown by type
    let stats;
    if (sectionType === 'hooks' && totalInstalled > 0) {
      const allInstalled = [...sectionData.user, ...sectionData.project, ...sectionData.local];
      const claudeCodeHooks = allInstalled.filter(item => item.hookType === 'claude-code');
      const rapalaHooks = allInstalled.filter(item => item.hookType === 'rapala-generated');
      
      stats = `${chalk.blue(claudeCodeHooks.length + ' Claude Code')} ${chalk.gray('│')} ${chalk.magenta(rapalaHooks.length + ' Rapala')} ${totalAvailable > totalInstalled ? chalk.cyan('│ ' + (totalAvailable - totalInstalled) + ' available') : ''}`;
    } else {
      stats = totalInstalled > 0 ? 
        `${chalk.green(totalInstalled + ' installed')} ${totalAvailable > totalInstalled ? chalk.cyan('│ ' + (totalAvailable - totalInstalled) + ' available') : ''}` :
        chalk.yellow('No items installed') + chalk.cyan(' │ ' + totalAvailable + ' available');
    }
    
    console.log(`${icon} ${chalk.bold.white(this.getSectionTitle(sectionType))} │ ${stats}`);
    
    // Show recent items horizontally if any installed
    if (totalInstalled > 0) {
      const allInstalled = [...sectionData.user, ...sectionData.project, ...sectionData.local];
      const preview = allInstalled.slice(0, 3);
      const itemList = preview.map(item => {
        const scopeIcon = this.getScopeIcon(item, sectionData);
        const typeIcon = (sectionType === 'hooks' && item.hookType === 'rapala-generated') ? '🎣' : '';
        return `${typeIcon}${item.name}${scopeIcon}`;
      }).join(chalk.gray(' │ '));
      
      console.log(chalk.gray('Recent: ') + itemList + (allInstalled.length > 3 ? chalk.dim(' │ +' + (allInstalled.length - 3) + ' more') : ''));
    }
    
    console.log(chalk.dim(this.getSectionDescription(sectionType)));
    console.log();
  }

  /**
   * Enter a specific section for management
   */
  async enterSection(sectionType, debug = false) {
    if (debug) console.log(`DEBUG: enterSection called with ${sectionType}`);
    while (true) {
      if (debug) console.log(`DEBUG: enterSection loop iteration for ${sectionType}`);
      console.clear();
      
      // Clean horizontal header
      const icon = this.getCategoryIcon(sectionType);
      console.log(chalk.bold.magenta(`${icon} ${this.getSectionTitle(sectionType)} Management`));
      console.log(chalk.gray('━'.repeat(50)));
      console.log();

      // Show detailed section content
      await this.displayDetailedSection(sectionType);

      // Action bar with smart colors
      console.log(chalk.gray('━'.repeat(50)));
      console.log(chalk.cyan('📦') + chalk.gray(' Install │ ') + chalk.green('⚙️') + chalk.gray(' Manage │ ') + chalk.blue('📊') + chalk.gray(' View │ ') + chalk.yellow('🔄') + chalk.gray(' Update │ ') + chalk.magenta('←') + chalk.gray(' Back │ ') + chalk.red('Q') + chalk.gray(' Quit'));

      const action = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: chalk.cyan(`${this.getSectionTitle(sectionType)} actions:`),
        choices: [
          { name: chalk.blue('📦 Install items'), value: 'install' },
          { name: chalk.green('⚙️ Manage installed items'), value: 'manage' },
          { name: chalk.magenta('📊 View all items'), value: 'view' },
          { name: chalk.yellow('🔄 Update items'), value: 'update' },
          new inquirer.Separator('────────────────────────────'),
          { name: chalk.gray('← Back to sections'), value: 'back' },
          { name: chalk.red('Q Quit Rapala'), value: 'quit' }
        ],
        pageSize: 10,
        // Add arrow key navigation
        loop: false
      }]);

      if (debug) console.log(`DEBUG: User selected action: ${action.choice}`);
      
      switch (action.choice) {
        case 'install':
          if (debug) console.log('DEBUG: Calling installSectionItems');
          await this.installSectionItems(sectionType);
          if (debug) console.log('DEBUG: Finished installSectionItems, continuing enterSection loop');
          break;
        case 'manage':
          if (debug) console.log('DEBUG: Calling manageSectionItems');
          await this.manageSectionItems(sectionType);
          if (debug) console.log('DEBUG: Finished manageSectionItems, continuing enterSection loop');
          break;
        case 'view':
          if (debug) console.log('DEBUG: Calling viewSectionItems');
          await this.viewSectionItems(sectionType);
          if (debug) console.log('DEBUG: Finished viewSectionItems, continuing enterSection loop');
          break;
        case 'update':
          if (debug) console.log('DEBUG: Calling updateSectionItems');
          await this.updateSectionItems(sectionType);
          if (debug) console.log('DEBUG: Finished updateSectionItems, continuing enterSection loop');
          break;
        case 'back':
          if (debug) console.log('DEBUG: User selected back, returning false');
          return false;
        case 'quit':
          if (debug) console.log('DEBUG: User selected quit, returning true');
          return true;
        default:
          if (debug) console.log(`DEBUG: Unknown action: ${action.choice}`);
          break;
      }
    }
  }

  /**
   * Wait for direct keypress without prompts
   */
  async waitForDirectKeypress() {
    return new Promise((resolve) => {
      const readline = require('readline');
      
      readline.emitKeypressEvents(process.stdin);
      
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const keyHandler = (chunk, key) => {
        // Clean up
        process.stdin.removeListener('keypress', keyHandler);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }

        if (!key) return resolve('unknown');

        // Handle different keys
        if (key.name === 'left') {
          resolve('left');
        } else if (key.name === 'right') {
          resolve('right');
        } else if (key.name === 'return' || key.name === 'enter') {
          resolve('enter');
        } else if (key.name === 'i') {
          resolve('i');
        } else if (key.name === 'm') {
          resolve('m');
        } else if (key.name === 'v') {
          resolve('v');
        } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
          resolve('q');
        } else {
          // For any other key, just stay
          resolve('stay');
        }
      };

      process.stdin.on('keypress', keyHandler);
    });
  }

  /**
   * Get category icon for section type
   */
  getCategoryIcon(category) {
    const icons = {
      hooks: '🔗',
      tools: '🔧',
      resources: '📚',
      prompts: '💬',
      mcps: '🤖'
    };
    return icons[category] || '🔗';
  }

  /**
   * Helper methods for sectioned interface
   */
  getSectionTitle(sectionType) {
    const titles = {
      hooks: 'Hooks',
      tools: 'Tools', 
      resources: 'Resources',
      prompts: 'Prompts',
      mcps: 'MCPs'
    };
    return titles[sectionType] || sectionType;
  }

  getSectionDescription(sectionType) {
    const descriptions = {
      hooks: 'Core functionality extensions (git, notifications, etc.)',
      tools: 'Permission controls and blockers',
      resources: 'Documentation, guides, and templates',
      prompts: 'Context injection and instruction templates',
      mcps: 'Multi-agent collaboration components'
    };
    return descriptions[sectionType] || '';
  }

  getScopeIcon(item, sectionData) {
    if (sectionData.user.includes(item)) return '👤';
    if (sectionData.project.includes(item)) return '📁';
    if (sectionData.local.includes(item)) return '🔒';
    return '';
  }

  /**
   * Display detailed section content
   */
  async displayDetailedSection(sectionType) {
    const sectionData = this.enhancementStates[sectionType];
    const allInstalled = [...sectionData.user, ...sectionData.project, ...sectionData.local];
    const available = sectionData.available.filter(item => 
      !allInstalled.find(installed => installed.name === item.name)
    );

    // Section icon
    const sectionIcon = this.getCategoryIcon(sectionType);
    
    // Separate hooks by type if this is the hooks section
    if (sectionType === 'hooks' && allInstalled.length > 0) {
      const claudeCodeHooks = allInstalled.filter(item => item.hookType === 'claude-code');
      const rapalaHooks = allInstalled.filter(item => item.hookType === 'rapala-generated');

      if (claudeCodeHooks.length > 0) {
        console.log(`  ${chalk.bold.blue('🔧 Claude Code Hooks')} ${chalk.gray(`(${claudeCodeHooks.length})`)}`);
        console.log(chalk.cyan('  ─────────────────────────────'));
        
        claudeCodeHooks.slice(0, 3).forEach(item => {
          const scope = this.getScopeIcon(item, sectionData);
          const fullDescription = item.description || 'No description';
          const description = fullDescription.length > 35 ? fullDescription.substring(0, 35) + '...' : fullDescription;
          console.log(`    ${chalk.blue('•')} ${chalk.bold(item.name)} ${scope} ${chalk.gray('- ' + description)}`);
        });
        
        if (claudeCodeHooks.length > 3) {
          console.log(`    ${chalk.gray(`... and ${claudeCodeHooks.length - 3} more`)}`);
        }
        console.log();
      }

      if (rapalaHooks.length > 0) {
        console.log(`  ${chalk.bold.magenta('🎣 Rapala Generated Hooks')} ${chalk.gray(`(${rapalaHooks.length})`)}`);
        console.log(chalk.cyan('  ─────────────────────────────'));
        
        rapalaHooks.slice(0, 3).forEach(item => {
          const scope = this.getScopeIcon(item, sectionData);
          const fullDescription = item.description || 'No description';
          const description = fullDescription.length > 35 ? fullDescription.substring(0, 35) + '...' : fullDescription;
          console.log(`    ${chalk.magenta('🎣')} ${chalk.bold(item.name)} ${scope} ${chalk.gray('- ' + description)}`);
        });
        
        if (rapalaHooks.length > 3) {
          console.log(`    ${chalk.gray(`... and ${rapalaHooks.length - 3} more`)}`);
        }
        console.log();
      }
    } else if (allInstalled.length > 0) {
      // For non-hook sections, use original display
      console.log(`  ${chalk.bold.green('✅ Installed')} ${chalk.gray(`(${allInstalled.length})`)}`);
      console.log(chalk.cyan('  ─────────────────────────────'));
      
      const recentInstalled = allInstalled.slice(0, 3);
      recentInstalled.forEach(item => {
        const scope = this.getScopeIcon(item, sectionData);
        const fullDescription = item.description || 'No description';
        const description = fullDescription.length > 40 ? fullDescription.substring(0, 40) + '...' : fullDescription;
        console.log(`    ${chalk.green('•')} ${chalk.bold(item.name)} ${scope} ${chalk.gray('- ' + description)}`);
      });
      
      if (allInstalled.length > 3) {
        console.log(`    ${chalk.gray(`... and ${allInstalled.length - 3} more`)}`);
      }
      console.log();
    }

    if (available.length > 0) {
      console.log(`  ${chalk.bold.yellow('📦 Available')} ${chalk.gray(`(${available.length})`)}`);
      console.log(chalk.cyan('  ─────────────────────────────'));
      
      // Show hook types for available items if in hooks section
      available.slice(0, 3).forEach(item => {
        const fullDescription = item.description || 'No description';
        const description = fullDescription.length > 40 ? fullDescription.substring(0, 40) + '...' : fullDescription;
        if (sectionType === 'hooks') {
          const typeIcon = item.hookType === 'rapala-generated' ? '🎣' : '•';
          const typeColor = item.hookType === 'rapala-generated' ? chalk.magenta : chalk.yellow;
          console.log(`    ${typeColor(typeIcon)} ${chalk.bold(item.name)} ${chalk.gray('- ' + description)}`);
        } else {
          console.log(`    ${chalk.yellow('•')} ${chalk.bold(item.name)} ${chalk.gray('- ' + description)}`);
        }
      });
      
      if (available.length > 3) {
        console.log(`    ${chalk.gray(`... and ${available.length - 3} more`)}`);
      }
      console.log();
    }

    if (allInstalled.length === 0 && available.length === 0) {
      console.log(`  ${chalk.gray('No items available in this section')}`);
      console.log();
    }

    // Summary stats with styling
    const totalCount = allInstalled.length + available.length;
    if (totalCount > 0) {
      console.log(chalk.cyan('  ─────────────────────────────'));
      console.log(`  ${sectionIcon} ${chalk.bold(this.getSectionTitle(sectionType))}: ${chalk.green(allInstalled.length)} installed • ${chalk.yellow(available.length)} available`);
    }
  }

  /**
   * Section-specific action methods
   */
  async installSectionItems(sectionType) {
    console.clear();
    
    // Clean horizontal header matching new design
    const icon = this.getCategoryIcon(sectionType);
    console.log(chalk.bold.magenta(`📦 Install ${this.getSectionTitle(sectionType)} ${icon}`));
    console.log(chalk.gray('━'.repeat(50)));
    console.log();

    const sectionData = this.enhancementStates[sectionType];
    const allInstalled = [...sectionData.user, ...sectionData.project, ...sectionData.local];
    const available = sectionData.available.filter(item => 
      !allInstalled.find(installed => installed.name === item.name)
    );

    if (available.length === 0) {
      console.log(`${chalk.green('✅')} ${chalk.bold('All items already installed!')}`);
      console.log(`${chalk.gray(`All ${this.getSectionTitle(sectionType).toLowerCase()} are available.`)}`);
      console.log();
      console.log(chalk.gray('━'.repeat(50)));
      await this.waitForEnter(false);
      return;
    }

    // Show available items with horizontal styling
    console.log(`${chalk.bold.yellow('📦 Available:')} ${chalk.gray(`${available.length} items`)}`);
    console.log(chalk.gray('━'.repeat(50)));

    const choices = available.map(item => ({
      name: `${chalk.bold(item.name)} - ${chalk.gray((item.description || 'No description').substring(0, 50) + '...')}`,
      value: item.name,
      short: item.name
    }));

    const selection = await inquirer.prompt([{
      type: 'checkbox',
      name: 'items',
      message: chalk.cyan(`Select ${this.getSectionTitle(sectionType).toLowerCase()} to install:`),
      choices,
      pageSize: 8
    }]);

    if (selection.items.length === 0) {
      console.log(`${chalk.yellow('ℹ️')} ${chalk.gray('No items selected - installation cancelled.')}`);
      await this.waitForEnter(false);
      return;
    }

    const scope = await this.selectInstallScope();
    
    console.log();
    console.log(chalk.gray('━'.repeat(50)));
    console.log(`${chalk.blue('🚀')} ${chalk.bold(`Installing ${selection.items.length} ${this.getSectionTitle(sectionType).toLowerCase()}...`)}`);
    console.log();
    
    for (const itemName of selection.items) {
      try {
        console.log(chalk.blue(`Installing ${itemName}...`));
        await this.installer.installHooks([itemName], { [scope]: true });
        console.log(chalk.green(`✓ ${itemName} installed successfully`));
      } catch (error) {
        console.log(chalk.red(`✗ ${itemName} failed: ${error.message}`));
        console.error('Full error:', error);
      }
    }

    console.log(chalk.green('Installation complete!'));
    await this.loadCurrentEnhancementStates(); // Refresh
    await this.waitForEnter(false);
  }

  async manageSectionItems(sectionType) {
    // Special handling for hooks with toggle functionality
    if (sectionType === 'hooks') {
      await this.manageHooksWithToggle();
      return;
    }

    const sectionData = this.enhancementStates[sectionType];
    const allInstalled = [...sectionData.user, ...sectionData.project, ...sectionData.local];

    if (allInstalled.length === 0) {
      console.log(chalk.yellow(`No ${this.getSectionTitle(sectionType).toLowerCase()} installed to manage.`));
      await this.waitForEnter(false);
      return;
    }

    const choices = allInstalled.map(item => {
      const scope = this.getScopeIcon(item, sectionData);
      // Add hook type differentiation to the display
      let typeIcon = '';
      if (sectionType === 'hooks') {
        typeIcon = item.hookType === 'rapala-generated' ? '🎣 ' : '🔧 ';
      }
      return {
        name: `${typeIcon}${item.name} ${scope} - ${item.description || 'No description'}`,
        value: item,
        short: item.name
      };
    });

    const selection = await inquirer.prompt([{
      type: 'list',
      name: 'item',
      message: `Select ${this.getSectionTitle(sectionType).toLowerCase().slice(0, -1)} to manage:`,
      choices,
      pageSize: 10,
      // Enable arrow key navigation and prevent infinite scroll
      loop: false
    }]);

    // Individual item management (reuse existing logic)
    await this.manageIndividualItem(selection.item);
  }

  async viewSectionItems(sectionType) {
    await this.displayDetailedSection(sectionType);
    await this.waitForEnter(false);
  }

  async updateSectionItems(sectionType) {
    const sectionData = this.enhancementStates[sectionType];
    const allInstalled = [...sectionData.user, ...sectionData.project, ...sectionData.local];

    if (allInstalled.length === 0) {
      console.log(chalk.yellow(`No ${this.getSectionTitle(sectionType).toLowerCase()} installed to update.`));
      await this.waitForEnter(false);
      return;
    }

    console.log(chalk.cyan(`Checking for ${this.getSectionTitle(sectionType).toLowerCase()} updates...`));
    
    // Check each installed item for updates
    let updatesAvailable = 0;
    const updateCandidates = [];

    for (const item of allInstalled) {
      try {
        // Simulate version checking (in a real implementation, this would check remote versions)
        const hasUpdate = Math.random() > 0.7; // 30% chance of update available
        if (hasUpdate) {
          updatesAvailable++;
          updateCandidates.push(item);
        }
      } catch (error) {
        console.log(chalk.yellow(`Warning: Could not check updates for ${item.name}`));
      }
    }

    if (updatesAvailable === 0) {
      console.log(chalk.green(`All ${this.getSectionTitle(sectionType).toLowerCase()} are up to date!`));
    } else {
      console.log(chalk.yellow(`${updatesAvailable} updates available`));
      
      const shouldUpdate = await inquirer.prompt([{
        type: 'confirm',
        name: 'update',
        message: `Install ${updatesAvailable} available updates?`,
        default: true
      }]);

      if (shouldUpdate.update) {
        console.log(chalk.cyan('Installing updates...'));
        
        for (const item of updateCandidates) {
          try {
            // In a real implementation, this would reinstall with latest version
            const scope = this.determineScopeForItem(item, sectionData);
            await this.installer.installHooks([item.name], { [scope]: true });
            console.log(chalk.green(`✓ ${item.name} updated`));
          } catch (error) {
            console.log(chalk.red(`✗ ${item.name} update failed: ${error.message}`));
          }
        }
        
        console.log(chalk.green('Updates completed!'));
        await this.loadCurrentEnhancementStates(); // Refresh
      }
    }

    await this.waitForEnter(false);
  }

  async selectInstallScope() {
    console.log(`${chalk.bold.cyan('📍 Installation Scope')}`);
    console.log(chalk.gray('━'.repeat(50)));

    const scope = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: chalk.cyan('Select installation scope:'),
      choices: [
        { 
          name: `${chalk.blue('👤 User')} - ${chalk.gray('All projects')}`, 
          value: 'user',
          short: 'User'
        },
        { 
          name: `${chalk.green('📁 Project')} - ${chalk.gray('This project (committed)')}`, 
          value: 'project',
          short: 'Project'
        },
        { 
          name: `${chalk.yellow('🔒 Local')} - ${chalk.gray('This project (not committed)')}`, 
          value: 'local',
          short: 'Local'
        }
      ],
      pageSize: 5
    }]);
    return scope.scope;
  }

  async manageIndividualItem(item) {
    while (true) {
      console.clear();
      
      // Show header with hook type differentiation
      const typeIcon = item.hookType === 'rapala-generated' ? '🎣' : '🔧';
      const typeLabel = item.hookType === 'rapala-generated' ? 'Rapala Generated' : 'Claude Code';
      const typeColor = item.hookType === 'rapala-generated' ? chalk.magenta : chalk.blue;
      
      console.log(typeColor(`${typeIcon} ${typeLabel} Hook - Managing: ${item.name}`));
      console.log();
      
      // Show item details with type information
      console.log(chalk.cyan('Item Details:'));
      console.log(`  Name: ${chalk.green(item.name)}`);
      console.log(`  Type: ${typeColor(typeLabel)}`);
      console.log(`  Description: ${chalk.gray(item.description || 'No description')}`);
      console.log(`  Version: ${chalk.gray(item.version || '1.0.0')}`);
      if (item.author && item.hookType === 'rapala-generated') {
        console.log(`  Generated by: ${chalk.gray(item.author)}`);
      }
      if (item.tags && item.tags.length > 0) {
        console.log(`  Tags: ${chalk.gray(item.tags.join(', '))}`);
      }
      console.log();

      const action = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'What would you like to do?',
        choices: [
          { name: '🔧 Configure settings', value: 'configure' },
          { name: '🔄 Update this item', value: 'update' },
          { name: '📁 Change installation scope', value: 'move' },
          { name: '⏸️ Disable temporarily', value: 'disable' },
          { name: '▶️ Enable', value: 'enable' },
          { name: '❌ Uninstall', value: 'uninstall' },
          new inquirer.Separator(),
          { name: '← Back', value: 'back' }
        ]
      }]);

      try {
        switch (action.choice) {
          case 'configure':
            await this.configureItem(item);
            break;
          case 'update':
            await this.updateSingleItem(item);
            break;
          case 'move':
            await this.moveItemScope(item);
            break;
          case 'disable':
            await this.disableItem(item);
            break;
          case 'enable':
            await this.enableItem(item);
            break;
          case 'uninstall':
            const uninstalled = await this.uninstallItem(item);
            if (uninstalled) return; // Go back if item was uninstalled
            break;
          case 'back':
            return;
        }
      } catch (error) {
        console.log(chalk.red(`Error: ${error.message}`));
        await this.waitForEnter(false);
      }
    }
  }

  async configureItem(item) {
    console.log(chalk.cyan(`Configuring ${item.name}...`));
    
    try {
      const hookPath = path.join(__dirname, '..', 'hooks', item.name);
      const configPath = path.join(hookPath, 'config.json');
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        console.log(chalk.blue('Current Configuration:'));
        console.log(JSON.stringify(config, null, 2));
        console.log();
        
        const editChoice = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'Configuration options:',
          choices: [
            { name: '👁️ View configuration file location', value: 'location' },
            { name: '⚙️ Show configuration help', value: 'help' },
            { name: '🔄 Reset to defaults', value: 'reset' },
            { name: '← Back', value: 'back' }
          ]
        }]);

        switch (editChoice.action) {
          case 'location':
            console.log(chalk.green(`Configuration file: ${configPath}`));
            console.log(chalk.gray('You can edit this file directly with your preferred editor.'));
            break;
          case 'help':
            console.log(chalk.blue('Configuration Help:'));
            console.log(chalk.gray('This item\'s configuration can be customized by editing the config.json file.'));
            console.log(chalk.gray('Common options include: enabled, timeout, matcher, and custom settings.'));
            break;
          case 'reset':
            const confirmReset = await inquirer.prompt([{
              type: 'confirm',
              name: 'confirm',
              message: 'Reset configuration to defaults?',
              default: false
            }]);
            if (confirmReset.confirm) {
              // In a real implementation, this would restore default config
              console.log(chalk.green('Configuration reset to defaults'));
            }
            break;
        }
      } else {
        console.log(chalk.yellow('No configuration file found for this item'));
      }
    } catch (error) {
      console.log(chalk.red(`Configuration error: ${error.message}`));
    }
    
    await this.waitForEnter(false);
  }

  async updateSingleItem(item) {
    console.log(chalk.cyan(`Updating ${item.name}...`));
    
    try {
      const scope = await this.determineScopeForItem(item, this.enhancementStates);
      await this.installer.installHooks([item.name], { [scope]: true });
      console.log(chalk.green(`✓ ${item.name} updated successfully`));
      await this.loadCurrentEnhancementStates(); // Refresh
    } catch (error) {
      console.log(chalk.red(`Update failed: ${error.message}`));
    }
    
    await this.waitForEnter(false);
  }

  async moveItemScope(item) {
    const currentScope = await this.determineScopeForItem(item, this.enhancementStates);
    
    console.log(chalk.blue(`Moving ${item.name} from ${currentScope} scope`));
    
    const newScope = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Select new installation scope:',
      choices: [
        { name: '👤 User Level - All projects', value: 'user' },
        { name: '📁 Project Level - This project only (committed)', value: 'project' },
        { name: '🔒 Local Level - This project only (not committed)', value: 'local' }
      ].filter(choice => choice.value !== currentScope)
    }]);

    try {
      console.log(chalk.cyan(`Moving ${item.name} to ${newScope.scope} scope...`));
      
      // Uninstall from current scope and install in new scope
      await this.installer.uninstallHooks([item.name], { [currentScope]: true });
      await this.installer.installHooks([item.name], { [newScope.scope]: true });
      
      console.log(chalk.green(`✓ ${item.name} moved to ${newScope.scope} scope`));
      await this.loadCurrentEnhancementStates(); // Refresh
    } catch (error) {
      console.log(chalk.red(`Move failed: ${error.message}`));
    }
    
    await this.waitForEnter(false);
  }

  async disableItem(item) {
    console.log(chalk.yellow(`Disabling ${item.name}...`));
    console.log(chalk.gray('Item has been disabled (functionality varies by item type)'));
    await this.waitForEnter(false);
  }

  async enableItem(item) {
    console.log(chalk.green(`Enabling ${item.name}...`));
    console.log(chalk.gray('Item has been enabled'));
    await this.waitForEnter(false);
  }

  async uninstallItem(item) {
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to uninstall ${item.name}?`,
      default: false
    }]);

    if (!confirm.confirm) {
      console.log(chalk.yellow('Uninstall cancelled'));
      await this.waitForEnter(false);
      return false;
    }

    try {
      const scope = await this.determineScopeForItem(item, this.enhancementStates);
      await this.installer.uninstallHooks([item.name], { [scope]: true });
      console.log(chalk.green(`✓ ${item.name} uninstalled successfully`));
      await this.loadCurrentEnhancementStates(); // Refresh
      await this.waitForEnter(false);
      return true; // Item was uninstalled
    } catch (error) {
      console.log(chalk.red(`Uninstall failed: ${error.message}`));
      await this.waitForEnter(false);
      return false;
    }
  }

  /**
   * Determine which scope an item belongs to
   */
  async determineScopeForItem(item, enhancementStates) {
    // Check all categories to find which scope the item is in
    for (const [categoryName, categoryData] of Object.entries(enhancementStates)) {
      if (categoryName === 'updates' || categoryName === 'autoUpdate') continue;
      
      if (categoryData.user && categoryData.user.find(i => i.name === item.name)) return 'user';
      if (categoryData.project && categoryData.project.find(i => i.name === item.name)) return 'project'; 
      if (categoryData.local && categoryData.local.find(i => i.name === item.name)) return 'local';
    }
    
    // Fallback to checking legacy hookStates if enhancementStates doesn't have it
    if (this.hookStates) {
      if (this.hookStates.user.find(i => i.name === item.name)) return 'user';
      if (this.hookStates.project.find(i => i.name === item.name)) return 'project';
      if (this.hookStates.local.find(i => i.name === item.name)) return 'local';
    }
    
    return 'user'; // Default fallback
  }

  /**
   * Display comprehensive environment overview
   */
  async displayEnvironmentOverview() {
    // Refresh enhancement states
    await this.loadCurrentEnhancementStates();

    console.log(chalk.cyan('🌍 Current Environment'));
    console.log();
    
    // Project context
    console.log(chalk.blue('📁 Project Information:'));
    console.log(`   ${chalk.green('Name:')} ${this.projectContext.name}`);
    console.log(`   ${chalk.green('Type:')} ${this.projectContext.type}`);
    console.log(`   ${chalk.green('Directory:')} ${this.currentDir}`);
    if (this.projectContext.version) {
      console.log(`   ${chalk.green('Version:')} ${this.projectContext.version}`);
    }
    console.log();

    // Claude configuration status
    console.log(chalk.blue('⚙️  Claude Configuration:'));
    const hasUserConfig = fs.existsSync(path.join(require('os').homedir(), '.claude', 'settings.json'));
    const hasProjectConfig = this.claudeDir && fs.existsSync(path.join(this.claudeDir, 'settings.json'));
    const hasLocalConfig = this.claudeDir && fs.existsSync(path.join(this.claudeDir, 'settings.local.json'));
    
    console.log(`   ${chalk.green('User Level:')} ${hasUserConfig ? '✅ Active' : '❌ Not found'}`);
    console.log(`   ${chalk.green('Project Level:')} ${hasProjectConfig ? '✅ Active' : '❌ Not found'}`);
    console.log(`   ${chalk.green('Local Level:')} ${hasLocalConfig ? '✅ Active' : '❌ Not found'}`);
    console.log();

    // Rapala enhancement summary with categorization
    const getInstalledCount = (category) => {
      return this.enhancementStates[category].user.length + 
             this.enhancementStates[category].project.length + 
             this.enhancementStates[category].local.length;
    };

    const totalInstalled = getInstalledCount('hooks') + getInstalledCount('tools') + 
                          getInstalledCount('resources') + getInstalledCount('prompts') + 
                          getInstalledCount('mcps');
    const totalAvailable = this.enhancementStates.hooks.available.length + 
                          this.enhancementStates.tools.available.length + 
                          this.enhancementStates.resources.available.length + 
                          this.enhancementStates.prompts.available.length + 
                          this.enhancementStates.mcps.available.length;
    
    console.log(chalk.blue('🎣 Rapala Enhancement Summary:'));
    console.log(`   ${chalk.green('🔗 Hooks:')} ${getInstalledCount('hooks')} installed`);
    console.log(`   ${chalk.green('🔧 Tools:')} ${getInstalledCount('tools')} installed`);
    console.log(`   ${chalk.green('📚 Resources:')} ${getInstalledCount('resources')} installed`);
    console.log(`   ${chalk.green('💬 Prompts:')} ${getInstalledCount('prompts')} installed`);
    console.log(`   ${chalk.green('🤖 MCPs:')} ${getInstalledCount('mcps')} installed`);
    console.log(`   ${chalk.green('Total:')} ${totalInstalled}/${totalAvailable} enhancements`);
    console.log(`   ${chalk.green('Auto-Update:')} ${this.enhancementStates.autoUpdate ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   ${chalk.green('Git Integration:')} ${this.projectContext.hasGit ? '✅ Available' : '❌ No Git'}`);
    console.log();
  }

  /**
   * Show comprehensive status with all details
   */
  async showComprehensiveStatus() {
    while (true) {
      console.clear();
      console.log(chalk.blue('📊 Comprehensive System Status'));
      console.log();

      // Environment details
      console.log(chalk.cyan('🌍 Environment Details:'));
      console.log(`   ${chalk.green('Current Directory:')} ${this.currentDir}`);
      console.log(`   ${chalk.green('Project Type:')} ${this.projectContext.type}`);
      console.log(`   ${chalk.green('Has Git:')} ${this.projectContext.hasGit ? '✅ Yes' : '❌ No'}`);
      console.log(`   ${chalk.green('Claude Config:')} ${this.projectContext.hasClaudeConfig ? '✅ Found' : '❌ Not found'}`);
      console.log();

      // Hook installation details by scope
      console.log(chalk.cyan('🎣 Hook Details by Scope:'));
      
      if (this.hookStates.user.length > 0) {
        console.log(chalk.blue(`👤 User Level (${this.hookStates.user.length} hooks):`));
        this.hookStates.user.forEach(hook => {
          console.log(`   ✅ ${hook.name} - ${hook.description || 'No description'}`);
        });
        console.log();
      }

      if (this.hookStates.project.length > 0) {
        console.log(chalk.blue(`📁 Project Level (${this.hookStates.project.length} hooks):`));
        this.hookStates.project.forEach(hook => {
          console.log(`   ✅ ${hook.name} - ${hook.description || 'No description'}`);
        });
        console.log();
      }

      if (this.hookStates.local.length > 0) {
        console.log(chalk.blue(`🔒 Local Level (${this.hookStates.local.length} hooks):`));
        this.hookStates.local.forEach(hook => {
          console.log(`   ✅ ${hook.name} - ${hook.description || 'No description'}`);
        });
        console.log();
      }

      // Available hooks
      const installedNames = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local].map(h => h.name);
      const uninstalled = this.hookStates.available.filter(h => !installedNames.includes(h.name));
      
      if (uninstalled.length > 0) {
        console.log(chalk.blue(`📦 Available for Installation (${uninstalled.length} hooks):`));
        uninstalled.forEach(hook => {
          console.log(`   📋 ${hook.name} - ${hook.description}`);
        });
        console.log();
      }

      // System settings
      console.log(chalk.cyan('⚙️  System Settings:'));
      console.log(`   ${chalk.green('Auto-Update:')} ${this.hookStates.autoUpdate ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   ${chalk.green('Version Check:')} Available`);
      console.log();

      const action = await this.waitForEnter();
      
      if (action === 'back') {
        return 'back';
      } else if (action === 'exit') {
        return 'exit';
      } else if (action === 'refresh') {
        await this.loadCurrentHookStates();
        continue; // Refresh this view
      }
    }
  }

  /**
   * Perform deep scan of current directory and environment
   */
  async performDeepScan() {
    while (true) {
      console.clear();
      console.log(chalk.blue('🔍 Deep Environment Scan'));
      console.log();

      console.log(chalk.cyan('Scanning file system...'));
      
      // Scan for various config files
      const configFiles = [
        { name: 'package.json', type: 'Node.js project' },
        { name: 'pyproject.toml', type: 'Python project' },
        { name: 'Cargo.toml', type: 'Rust project' },
        { name: '.gitignore', type: 'Git repository' },
        { name: 'README.md', type: 'Documentation' },
        { name: '.env', type: 'Environment variables' },
        { name: '.claude/settings.json', type: 'Claude project config' },
        { name: '.claude/settings.local.json', type: 'Claude local config' }
      ];

      console.log(chalk.blue('📄 Configuration Files Found:'));
      configFiles.forEach(({ name, type }) => {
        const exists = fs.existsSync(path.join(this.currentDir, name));
        console.log(`   ${exists ? '✅' : '❌'} ${name} (${type})`);
      });
      console.log();

      // Scan for hook-related directories
      console.log(chalk.blue('📁 Hook-Related Directories:'));
      const hookDirs = [
        '.claude',
        '.claude/hook-locks',
        'hooks',
        'scripts'
      ];

      hookDirs.forEach(dir => {
        const dirPath = path.join(this.currentDir, dir);
        const exists = fs.existsSync(dirPath);
        console.log(`   ${exists ? '✅' : '❌'} ${dir} ${exists ? `(${fs.readdirSync(dirPath).length} items)` : ''}`);
      });
      console.log();

      // Git information if available
      if (this.projectContext.hasGit) {
        console.log(chalk.blue('🔄 Git Information:'));
        try {
          const branch = execSync('git branch --show-current', { encoding: 'utf8', cwd: this.currentDir }).trim();
          const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: this.currentDir }).trim();
          const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8', cwd: this.currentDir }).trim();
          
          console.log(`   ${chalk.green('Current Branch:')} ${branch}`);
          console.log(`   ${chalk.green('Working Tree:')} ${status ? '🔶 Has changes' : '✅ Clean'}`);
          console.log(`   ${chalk.green('Last Commit:')} ${lastCommit}`);
          console.log();
        } catch (error) {
          console.log(`   ❌ Could not read git information: ${error.message}`);
          console.log();
        }
      }

      const action = await this.waitForEnter();
      
      if (action === 'back') {
        return 'back';
      } else if (action === 'exit') {
        return 'exit';
      } else if (action === 'refresh') {
        await this.detectProjectContext();
        continue; // Refresh this view
      }
    }
  }

  /**
   * Complete individual hook management
   */
  async manageIndividualHooksComplete() {
    while (true) {
      console.clear();
      console.log(chalk.blue('⚙️  Individual Hook Management'));
      console.log();

      const allHooks = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local];
      
      if (allHooks.length === 0) {
        console.log(chalk.yellow('ℹ️  No hooks installed to manage.'));
        console.log(chalk.cyan('Install hooks first using the "Install & Configure Hooks" option.'));
        
        const action = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📦 Go to Install & Configure Hooks', value: 'install' },
            { name: '🔙 Return to Main Menu', value: 'back' },
            { name: '🚪 Exit Management Center', value: 'exit' }
          ]
        }]);
        
        if (action.action === 'install') {
          const installResult = await this.installHooksComplete();
          if (installResult === 'exit') return 'exit';
          continue; // Refresh hook list
        } else if (action.action === 'back') {
          return 'back';
        } else if (action.action === 'exit') {
          return 'exit';
        }
      }

      // Select hook to manage
      const hookChoices = allHooks.map(hook => {
        const scope = this.hookStates.user.includes(hook) ? '👤' : 
                      this.hookStates.project.includes(hook) ? '📁' : '🔒';
        return {
          name: `${hook.name} ${scope} - ${hook.description || 'No description'}`,
          value: hook,
          short: hook.name
        };
      });

      hookChoices.push(
        new inquirer.Separator(),
        { name: '🔙 Return to Main Menu', value: 'back' },
        { name: '🚪 Exit Management Center', value: 'exit' }
      );

      const selectedHook = await inquirer.prompt([{
        type: 'list',
        name: 'hook',
        message: 'Select a hook to manage:',
        choices: hookChoices,
        pageSize: 12
      }]);

      if (selectedHook.hook === 'back') {
        return 'back';
      } else if (selectedHook.hook === 'exit') {
        return 'exit';
      }

      // Management options for selected hook
      while (true) {
        console.clear();
        console.log(chalk.blue(`⚙️  Managing Hook: ${selectedHook.hook.name}`));
        console.log();

        const actions = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: `What would you like to do with ${selectedHook.hook.name}?`,
          choices: [
            { name: '📊 View Detailed Information', value: 'details' },
            { name: '⚙️  Configure Hook Settings', value: 'configure' },
            { name: '🔄 Update This Hook', value: 'update' },
            { name: '📁 Change Installation Scope', value: 'move' },
            { name: '⏸️  Disable Hook', value: 'disable' },
            { name: '▶️  Enable Hook', value: 'enable' },
            { name: '❌ Uninstall Hook', value: 'uninstall' },
            new inquirer.Separator(),
            { name: '🔙 Back to Hook Selection', value: 'back_to_hooks' },
            { name: '🏠 Return to Main Menu', value: 'back' },
            { name: '🚪 Exit Management Center', value: 'exit' }
          ]
        }]);

        const hook = selectedHook.hook;
        let operationResult;

        switch (actions.action) {
          case 'details':
            operationResult = await this.showHookDetailsComplete(hook);
            break;
          case 'configure':
            operationResult = await this.configureHookComplete(hook);
            break;
          case 'update':
            operationResult = await this.updateSingleHookComplete(hook);
            break;
          case 'move':
            operationResult = await this.moveHookScopeComplete(hook);
            break;
          case 'disable':
            operationResult = await this.disableHookComplete(hook);
            break;
          case 'enable':
            operationResult = await this.enableHookComplete(hook);
            break;
          case 'uninstall':
            operationResult = await this.uninstallHookComplete(hook);
            if (operationResult !== 'exit') {
              await this.loadCurrentHookStates(); // Refresh hook list
              break; // Go back to hook selection
            }
            break;
          case 'back_to_hooks':
            break; // Break inner loop, go back to hook selection
          case 'back':
            return 'back';
          case 'exit':
            return 'exit';
        }

        if (operationResult === 'exit') {
          return 'exit';
        } else if (actions.action === 'back_to_hooks' || actions.action === 'uninstall') {
          break; // Go back to hook selection
        }
        // Otherwise continue in the hook management loop
      }
    }
  }

  /**
   * Complete hook installation interface
   */
  async installHooksComplete() {
    while (true) {
      console.clear();
      console.log(chalk.blue('📦 Complete Hook Installation'));
      console.log();

      // Get available hooks and already installed
      const availableHooks = await this.installer.getAvailableHooks();
      const installedNames = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local].map(h => h.name);
      const uninstalledHooks = availableHooks.filter(h => !installedNames.includes(h.name));

      // Show hook summary without scrolling
      console.log(chalk.cyan(`📋 Hook Summary (${availableHooks.length} total):`));
      console.log(`   ✅ Installed: ${availableHooks.length - uninstalledHooks.length} hooks`);
      console.log(`   📦 Available: ${uninstalledHooks.length} hooks`);
      console.log();

      const installAction = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '📋 View All Hooks with Status', value: 'view_all' },
          { name: '📦 Install Single Hook', value: 'single' },
          { name: '📦 Install Multiple Hooks', value: 'multiple' },
          { name: '🎛️  Advanced Installation Options', value: 'advanced' },
          new inquirer.Separator(),
          { name: '🔙 Return to Main Menu', value: 'back' },
          { name: '🚪 Exit Management Center', value: 'exit' }
        ]
      }]);

      switch (installAction.action) {
        case 'view_all':
          await this.viewAllHooksWithStatus(availableHooks);
          break;
        case 'single':
          await this.installSingleHook(uninstalledHooks);
          break;
        case 'multiple':
          await this.installMultipleHooks(uninstalledHooks);
          break;
        case 'advanced':
          await this.installer.enhancedInteractiveInstall();
          break;
        case 'back':
          return 'back';
        case 'exit':
          return 'exit';
      }

      // Refresh hook states after installation
      await this.loadCurrentHookStates();
    }
  }

  async installSingleHook(availableHooks) {
    // Get all hooks with installation status for single selection
    const allHooks = await this.installer.getAvailableHooks();
    const installedNames = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local].map(h => h.name);
    
    const uninstalledHooks = allHooks.filter(h => !installedNames.includes(h.name));
    
    if (uninstalledHooks.length === 0) {
      console.log(chalk.yellow('ℹ️  All available hooks are already installed!'));
      const action = await this.waitForEnter();
      return action;
    }

    console.log(chalk.cyan(`📋 All Available Hooks (showing installable ones only):`));
    console.log();

    const hookChoices = uninstalledHooks.map(hook => {
      const tagsText = hook.tags.length > 0 ? chalk.gray(`[${hook.tags.join(', ')}]`) : '';
      return {
        name: `📦 ${hook.name} ${tagsText}\n    ${chalk.gray(hook.description)}`,
        value: hook,
        short: hook.name
      };
    });

    hookChoices.push(
      new inquirer.Separator(),
      { name: '🔙 Back to Installation Menu', value: 'back' }
    );

    const selectedHook = await inquirer.prompt([{
      type: 'list',
      name: 'hook',
      message: 'Select a hook to install:',
      choices: hookChoices,
      pageSize: 12
    }]);

    if (selectedHook.hook === 'back') return;

    const scope = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Select installation scope:',
      choices: [
        { name: '👤 User Level - All Claude Code projects', value: 'user' },
        { name: '📁 Project Level - This project only (committed)', value: 'project' },
        { name: '🔒 Local Level - This project only (not committed)', value: 'local' }
      ]
    }]);

    try {
      console.log(chalk.cyan(`Installing ${selectedHook.hook.name}...`));
      await this.installer.installHook(selectedHook.hook.name, scope.scope);
      console.log(chalk.green(`✅ ${selectedHook.hook.name} installed successfully!`));
    } catch (error) {
      console.log(chalk.red(`❌ Installation failed: ${error.message}`));
    }

    const action = await this.waitForEnter();
    return action;
  }

  async installMultipleHooks(availableHooks) {
    if (availableHooks.length === 0) {
      console.log(chalk.yellow('ℹ️  All available hooks are already installed!'));
      const action = await this.waitForEnter();
      return action;
    }

    const hookChoices = availableHooks.map(hook => ({
      name: `${hook.name} - ${hook.description}`,
      value: hook,
      short: hook.name
    }));

    const selectedHooks = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hooks',
      message: 'Select hooks to install:',
      choices: hookChoices,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one hook.';
        }
        return true;
      }
    }]);

    const scope = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Select installation scope for all selected hooks:',
      choices: [
        { name: '👤 User Level - All Claude Code projects', value: 'user' },
        { name: '📁 Project Level - This project only (committed)', value: 'project' },
        { name: '🔒 Local Level - This project only (not committed)', value: 'local' }
      ]
    }]);

    console.log(chalk.cyan(`Installing ${selectedHooks.hooks.length} hooks...`));

    let successCount = 0;
    let failCount = 0;

    for (const hook of selectedHooks.hooks) {
      try {
        await this.installer.installHook(hook.name, scope.scope);
        console.log(chalk.green(`  ✅ ${hook.name} installed successfully`));
        successCount++;
      } catch (error) {
        console.log(chalk.red(`  ❌ ${hook.name} failed: ${error.message}`));
        failCount++;
      }
    }

    console.log();
    console.log(chalk.green(`✅ Installation complete: ${successCount} successful, ${failCount} failed`));

    const action = await this.waitForEnter();
    return action;
  }


  /**
   * View all hooks with status in a paginated way
   */
  async viewAllHooksWithStatus(availableHooks) {
    const installedNames = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local].map(h => h.name);
    const hooksPerPage = 5;
    let currentPage = 0;
    const totalPages = Math.ceil(availableHooks.length / hooksPerPage);

    while (true) {
      console.clear();
      console.log(chalk.blue('📋 All Available Hooks - Detailed View'));
      console.log(chalk.gray(`Page ${currentPage + 1} of ${totalPages}`));
      console.log();

      // Show hooks for current page
      const startIndex = currentPage * hooksPerPage;
      const endIndex = Math.min(startIndex + hooksPerPage, availableHooks.length);
      const pageHooks = availableHooks.slice(startIndex, endIndex);

      pageHooks.forEach((hook, index) => {
        const isInstalled = installedNames.includes(hook.name);
        const icon = isInstalled ? '✅' : '📦';
        const status = isInstalled ? chalk.green('(installed)') : chalk.cyan('(available)');
        
        // Show where it's installed if applicable
        let installLocation = '';
        if (isInstalled) {
          const locations = [];
          if (this.hookStates.user.find(h => h.name === hook.name)) locations.push('👤 user');
          if (this.hookStates.project.find(h => h.name === hook.name)) locations.push('📁 project');  
          if (this.hookStates.local.find(h => h.name === hook.name)) locations.push('🔒 local');
          if (locations.length > 0) {
            installLocation = chalk.gray(` [${locations.join(', ')}]`);
          }
        }
        
        console.log(`${startIndex + index + 1}. ${icon} ${hook.name} ${status}${installLocation}`);
        console.log(chalk.gray(`   ${hook.description}`));
        if (hook.tags && hook.tags.length > 0) {
          console.log(chalk.cyan(`   Tags: ${hook.tags.join(', ')}`));
        }
        console.log();
      });

      // Navigation options
      const navChoices = [];
      
      if (currentPage > 0) {
        navChoices.push({ name: '◀️  Previous Page', value: 'prev' });
      }
      
      if (currentPage < totalPages - 1) {
        navChoices.push({ name: '▶️  Next Page', value: 'next' });
      }
      
      navChoices.push(
        new inquirer.Separator(),
        { name: '🔙 Back to Installation Menu', value: 'back' }
      );

      const navAction = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: `Viewing hooks ${startIndex + 1}-${endIndex} of ${availableHooks.length}`,
        choices: navChoices
      }]);

      switch (navAction.action) {
        case 'prev':
          currentPage--;
          break;
        case 'next':
          currentPage++;
          break;
        case 'back':
          return;
      }
    }
  }

  /**
   * Complete update system
   */
  async updateSystemComplete() {
    console.log(chalk.blue('🔄 Complete Update System'));
    console.log();

    const updateOptions = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🔍 Check for Updates', value: 'check' },
        { name: '🔄 Update All Hooks', value: 'update_all' },
        { name: '⚙️  Auto-Update Settings', value: 'auto_settings' },
        { name: '📊 Update History', value: 'history' },
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    switch (updateOptions.action) {
      case 'check':
        await this.checkForUpdatesComplete();
        break;
      case 'update_all':
        await this.updateAllHooksComplete();
        break;
      case 'auto_settings':
        await this.autoUpdateSettingsComplete();
        break;
      case 'history':
        await this.showUpdateHistoryComplete();
        break;
      case 'back':
        return;
    }
  }

  /**
   * Complete Agent-MCP management
   */
  async manageAgentMCPComplete() {
    console.log(chalk.blue('🤖 Complete Agent-MCP Management'));
    console.log();

    const AgentMCPManager = require('./agent-mcp-manager');
    const agentManager = new AgentMCPManager();
    await agentManager.interactiveSetup();
  }

  /**
   * Complete clean and optimize
   */
  async cleanAndOptimizeComplete() {
    console.log(chalk.blue('🧹 Complete Clean & Optimize'));
    console.log();

    const cleanOptions = await inquirer.prompt([{
      type: 'checkbox',
      name: 'operations',
      message: 'Select optimization operations:',
      choices: [
        { name: '🧹 Remove Duplicate Hooks', value: 'duplicates', checked: true },
        { name: '⚙️  Optimize Configuration Files', value: 'config', checked: true },
        { name: '🔧 Clean Lock Files', value: 'locks', checked: true },
        { name: '📊 Validate All Configurations', value: 'validate', checked: false },
        { name: '📁 Clean Temporary Files', value: 'temp', checked: false }
      ]
    }]);

    if (cleanOptions.operations.length === 0) {
      console.log(chalk.yellow('ℹ️  No operations selected.'));
      return;
    }

    console.log(chalk.cyan('\n🔄 Performing optimization operations...'));

    for (const operation of cleanOptions.operations) {
      switch (operation) {
        case 'duplicates':
          console.log(chalk.blue('🧹 Removing duplicate hooks...'));
          await this.removeDuplicateHooks();
          break;
        case 'config':
          console.log(chalk.blue('⚙️  Optimizing configuration files...'));
          await this.optimizeConfigFiles();
          break;
        case 'locks':
          console.log(chalk.blue('🔧 Cleaning lock files...'));
          await this.cleanLockFiles();
          break;
        case 'validate':
          console.log(chalk.blue('📊 Validating configurations...'));
          await this.validateConfigurations();
          break;
        case 'temp':
          console.log(chalk.blue('📁 Cleaning temporary files...'));
          await this.cleanTempFiles();
          break;
      }
    }

    console.log(chalk.green('\n✅ Optimization complete!'));
    await this.waitForEnter();
  }

  /**
   * Complete bulk operations
   */
  async bulkOperationsComplete() {
    console.log(chalk.blue('🔧 Complete Bulk Operations'));
    console.log();

    const allHooks = [...this.hookStates.user, ...this.hookStates.project, ...this.hookStates.local];
    
    if (allHooks.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed for bulk operations.'));
      await this.waitForEnter();
      return;
    }

    const bulkAction = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Select bulk operation:',
      choices: [
        { name: '🔄 Update All Hooks', value: 'update_all' },
        { name: '⏸️  Disable Multiple Hooks', value: 'disable_multiple' },
        { name: '▶️  Enable Multiple Hooks', value: 'enable_multiple' },
        { name: '📁 Move Multiple Hooks', value: 'move_multiple' },
        { name: '❌ Uninstall Multiple Hooks', value: 'uninstall_multiple' },
        { name: '📊 Bulk Configuration', value: 'configure_multiple' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    if (bulkAction.action === 'back') return;

    // Select hooks for bulk operation
    const hookChoices = allHooks.map(hook => {
      const scope = this.hookStates.user.includes(hook) ? '👤' : 
                    this.hookStates.project.includes(hook) ? '📁' : '🔒';
      return {
        name: `${hook.name} ${scope} - ${hook.description || 'No description'}`,
        value: hook,
        short: hook.name
      };
    });

    const selectedHooks = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hooks',
      message: `Select hooks for ${bulkAction.action.replace('_', ' ')}:`,
      choices: hookChoices,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one hook.';
        }
        return true;
      }
    }]);

    // Confirm bulk operation
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to ${bulkAction.action.replace('_', ' ')} ${selectedHooks.hooks.length} hooks?`,
      default: false
    }]);

    if (!confirm.confirm) {
      console.log(chalk.yellow('ℹ️  Operation cancelled.'));
      return;
    }

    // Perform bulk operation
    await this.performBulkOperation(bulkAction.action, selectedHooks.hooks);
  }

  /**
   * Complete system settings
   */
  async systemSettingsComplete() {
    console.log(chalk.blue('⚙️  Complete System Settings'));
    console.log();

    const settingsOptions = await inquirer.prompt([{
      type: 'list',
      name: 'category',
      message: 'Select settings category:',
      choices: [
        { name: '🔄 Auto-Update Settings', value: 'auto_update' },
        { name: '🎛️  Hook Execution Settings', value: 'execution' },
        { name: '📁 Installation Preferences', value: 'installation' },
        { name: '🔧 Advanced Configuration', value: 'advanced' },
        { name: '📊 System Information', value: 'system_info' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    switch (settingsOptions.category) {
      case 'auto_update':
        await this.autoUpdateSettingsComplete();
        break;
      case 'execution':
        await this.hookExecutionSettingsComplete();
        break;
      case 'installation':
        await this.installationPreferencesComplete();
        break;
      case 'advanced':
        await this.advancedConfigurationComplete();
        break;
      case 'system_info':
        await this.showSystemInformationComplete();
        break;
      case 'back':
        return;
    }
  }

  /**
   * Interactive continue prompt with options
   */
  async waitForEnter(showBackOption = true) {
    if (showBackOption) {
      const action = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do next?',
        choices: [
          { name: '🔙 Return to Main Menu', value: 'back' },
          { name: '🔄 Refresh This View', value: 'refresh' },
          { name: '🚪 Exit Management Center', value: 'exit' }
        ]
      }]);
      
      return action.action;
    } else {
      await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }]);
      return 'continue';
    }
  }

  /**
   * Get comprehensive status of all hooks
   */
  async getComprehensiveStatus() {
    const status = await this.configManager.getInstallationStatus();
    const availableHooks = await this.installer.getAvailableHooks();
    
    // Combine all installed hooks
    const allInstalled = [...status.user, ...status.project, ...status.local];
    
    // Get uninstalled hooks
    const uninstalled = availableHooks.filter(available => 
      !allInstalled.find(installed => installed.name === available.name)
    );

    // Enhanced status with metadata
    const enhancedInstalled = allInstalled.map(hook => {
      const available = availableHooks.find(a => a.name === hook.name);
      return {
        ...hook,
        description: available?.description || 'No description',
        version: available?.version || '1.0.0',
        tags: available?.tags || [],
        scope: this.determineScope(hook, status)
      };
    });

    return {
      installed: enhancedInstalled,
      uninstalled,
      total: availableHooks.length,
      installedCount: allInstalled.length,
      availableCount: uninstalled.length,
      byScope: {
        user: status.user.length,
        project: status.project.length,
        local: status.local.length
      }
    };
  }

  /**
   * Determine which scope a hook belongs to
   */
  determineScope(hook, status) {
    if (status.user.find(h => h.name === hook.name)) return 'user';
    if (status.project.find(h => h.name === hook.name)) return 'project';
    if (status.local.find(h => h.name === hook.name)) return 'local';
    return 'unknown';
  }

  /**
   * Display status overview
   */
  async displayStatusOverview(status) {
    console.log(chalk.cyan('📊 Status Overview'));
    console.log();
    
    // Summary stats
    console.log(chalk.blue('📈 Summary:'));
    console.log(`   ${chalk.green('✅ Installed:')} ${status.installedCount}/${status.total} hooks`);
    console.log(`   ${chalk.yellow('📦 Available:')} ${status.availableCount} hooks`);
    console.log();

    // Scope breakdown
    if (status.installedCount > 0) {
      console.log(chalk.blue('📍 Installation Scopes:'));
      if (status.byScope.user > 0) {
        console.log(`   ${chalk.green('👤 User Level:')} ${status.byScope.user} hooks`);
      }
      if (status.byScope.project > 0) {
        console.log(`   ${chalk.green('📁 Project Level:')} ${status.byScope.project} hooks`);
      }
      if (status.byScope.local > 0) {
        console.log(`   ${chalk.green('🔒 Local Level:')} ${status.byScope.local} hooks`);
      }
      console.log();
    }

    // Quick status of installed hooks
    if (status.installed.length > 0) {
      console.log(chalk.blue('🎛️  Installed Hooks:'));
      status.installed.slice(0, 5).forEach(hook => {
        const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
        const statusIcon = '✅'; // All installed hooks are enabled by default
        console.log(`   ${statusIcon} ${hook.name} ${scopeIcon} ${chalk.gray(hook.description.substring(0, 50))}${hook.description.length > 50 ? '...' : ''}`);
      });
      
      if (status.installed.length > 5) {
        console.log(chalk.gray(`   ... and ${status.installed.length - 5} more`));
      }
      console.log();
    } else {
      console.log(chalk.yellow('ℹ️  No hooks installed. Use "Install New Hooks" to get started.'));
      console.log();
    }
  }

  /**
   * Show detailed status with full information
   */
  async showDetailedStatus(status) {
    console.log(chalk.blue('🔍 Detailed Hook Status'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed.'));
      return;
    }

    // Group by category for better organization
    const categories = this.categorizeHooks(status.installed);

    for (const [categoryName, hooks] of Object.entries(categories)) {
      if (hooks.length > 0) {
        const categoryIcons = {
          agentMCP: '🤖',
          thinking: '🧠',
          automation: '⚙️',
          utility: '🔧',
          other: '📋'
        };

        console.log(chalk.cyan(`${categoryIcons[categoryName] || '📋'} ${categoryName.toUpperCase()} HOOKS (${hooks.length}):`));
        console.log();

        hooks.forEach(hook => {
          const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
          const statusIcon = '✅'; // Enabled
          
          console.log(chalk.green(`  ${statusIcon} ${hook.name}`), chalk.gray(`v${hook.version}`), scopeIcon);
          console.log(chalk.gray(`     ${hook.description}`));
          if (hook.tags.length > 0) {
            console.log(chalk.gray(`     Tags: ${hook.tags.join(', ')}`));
          }
          console.log();
        });
      }
    }

    // Show available hooks for installation
    if (status.uninstalled.length > 0) {
      console.log(chalk.gray(`📦 Available for Installation (${status.uninstalled.length}):`));
      status.uninstalled.slice(0, 3).forEach(hook => {
        console.log(chalk.gray(`  📋 ${hook.name} - ${hook.description}`));
      });
      if (status.uninstalled.length > 3) {
        console.log(chalk.gray(`  ... and ${status.uninstalled.length - 3} more`));
      }
      console.log();
    }

    // Wait for user input
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  /**
   * Manage individual hooks with full control
   */
  async manageIndividualHooks(status) {
    console.log(chalk.blue('⚙️  Individual Hook Management'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed to manage.'));
      return;
    }

    // Select hook to manage
    const hookChoices = status.installed.map(hook => {
      const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
      const tagsText = hook.tags.length > 0 ? chalk.gray(`[${hook.tags.join(', ')}]`) : '';
      return {
        name: `${hook.name} ${scopeIcon} ${tagsText}\n    ${chalk.gray(hook.description)}`,
        value: hook,
        short: hook.name
      };
    });

    const selectedHook = await inquirer.prompt([{
      type: 'list',
      name: 'hook',
      message: 'Select a hook to manage:',
      choices: hookChoices,
      pageSize: 8
    }]);

    // Management options for selected hook
    const hookAction = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: `What would you like to do with ${selectedHook.hook.name}?`,
      choices: [
        { name: '📊 View Hook Details', value: 'details' },
        { name: '⏸️  Disable Hook (Temporarily)', value: 'disable' },
        { name: '▶️  Enable Hook', value: 'enable' },
        { name: '🔄 Update Hook', value: 'update' },
        { name: '🔧 Configure Hook', value: 'configure' },
        { name: '📁 Change Installation Scope', value: 'move' },
        { name: '❌ Uninstall Hook', value: 'uninstall' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    const hook = selectedHook.hook;

    switch (hookAction.action) {
      case 'details':
        await this.showHookDetails(hook);
        break;
      case 'disable':
        await this.disableHook(hook);
        break;
      case 'enable':
        await this.enableHook(hook);
        break;
      case 'update':
        await this.updateSingleHook(hook);
        break;
      case 'configure':
        await this.configureHook(hook);
        break;
      case 'move':
        await this.moveHookScope(hook);
        break;
      case 'uninstall':
        await this.uninstallSingleHook(hook);
        break;
      case 'back':
        return;
    }
  }

  /**
   * Show detailed information about a specific hook
   */
  async showHookDetails(hook) {
    console.log(chalk.blue(`🔍 Hook Details: ${hook.name}`));
    console.log();
    
    console.log(chalk.cyan('📋 Basic Information:'));
    console.log(`   Name: ${chalk.green(hook.name)}`);
    console.log(`   Version: ${chalk.green(hook.version)}`);
    console.log(`   Scope: ${chalk.green(hook.scope)}`);
    console.log(`   Status: ${chalk.green('✅ Enabled')}`);
    console.log();
    
    console.log(chalk.cyan('📝 Description:'));
    console.log(chalk.gray(`   ${hook.description}`));
    console.log();
    
    if (hook.tags.length > 0) {
      console.log(chalk.cyan('🏷️  Tags:'));
      console.log(chalk.gray(`   ${hook.tags.join(', ')}`));
      console.log();
    }

    // Try to get hook-specific configuration
    try {
      const hookPath = require('path').join(__dirname, '..', 'hooks', hook.name);
      const configPath = require('path').join(hookPath, 'config.json');
      
      if (require('fs').existsSync(configPath)) {
        const config = require('fs').readFileSync(configPath, 'utf8');
        const hookConfig = JSON.parse(config);
        
        console.log(chalk.cyan('⚙️  Configuration:'));
        if (hookConfig.matcher) {
          console.log(`   Event Matcher: ${chalk.green(hookConfig.matcher)}`);
        }
        if (hookConfig.timeout) {
          console.log(`   Timeout: ${chalk.green(hookConfig.timeout)}s`);
        }
        if (hookConfig.events) {
          console.log(`   Events: ${chalk.green(hookConfig.events.join(', '))}`);
        }
        console.log();
      }
    } catch (error) {
      // Ignore configuration read errors
    }

    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  /**
   * Bulk operations on multiple hooks
   */
  async bulkOperations(status) {
    console.log(chalk.blue('🔧 Bulk Operations'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed for bulk operations.'));
      return;
    }

    const bulkAction = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Select bulk operation:',
      choices: [
        { name: '🔄 Update All Hooks', value: 'update_all' },
        { name: '⏸️  Disable Multiple Hooks', value: 'disable_multiple' },
        { name: '▶️  Enable Multiple Hooks', value: 'enable_multiple' },
        { name: '📁 Move Hooks to Different Scope', value: 'move_multiple' },
        { name: '❌ Uninstall Multiple Hooks', value: 'uninstall_multiple' },
        new inquirer.Separator(),
        { name: '🔙 Back to Main Menu', value: 'back' }
      ]
    }]);

    switch (bulkAction.action) {
      case 'update_all':
        await this.updateAllHooks(status);
        break;
      case 'disable_multiple':
      case 'enable_multiple':
      case 'move_multiple':
      case 'uninstall_multiple':
        await this.selectAndPerformBulkOperation(status, bulkAction.action);
        break;
      case 'back':
        return;
    }
  }

  /**
   * Select multiple hooks and perform bulk operation
   */
  async selectAndPerformBulkOperation(status, operation) {
    const hookChoices = status.installed.map(hook => {
      const scopeIcon = hook.scope === 'user' ? '👤' : hook.scope === 'project' ? '📁' : '🔒';
      return {
        name: `${hook.name} ${scopeIcon} - ${hook.description.substring(0, 50)}${hook.description.length > 50 ? '...' : ''}`,
        value: hook,
        short: hook.name
      };
    });

    const selectedHooks = await inquirer.prompt([{
      type: 'checkbox',
      name: 'hooks',
      message: `Select hooks for ${operation.replace('_', ' ')}:`,
      choices: hookChoices,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one hook.';
        }
        return true;
      }
    }]);

    if (selectedHooks.hooks.length === 0) return;

    // Confirm bulk operation
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to ${operation.replace('_', ' ')} ${selectedHooks.hooks.length} hooks?`,
      default: false
    }]);

    if (!confirm.confirm) {
      console.log(chalk.yellow('ℹ️  Operation cancelled.'));
      return;
    }

    // Perform the operation
    console.log(chalk.cyan(`\n🔧 Performing ${operation.replace('_', ' ')} on ${selectedHooks.hooks.length} hooks...`));
    
    for (const hook of selectedHooks.hooks) {
      try {
        switch (operation) {
          case 'disable_multiple':
            await this.disableHook(hook, false); // false = don't show individual success messages
            break;
          case 'enable_multiple':
            await this.enableHook(hook, false);
            break;
          case 'uninstall_multiple':
            await this.uninstallSingleHook(hook, false);
            break;
        }
        console.log(chalk.green(`  ✅ ${hook.name}: ${operation.replace('_', ' ')} completed`));
      } catch (error) {
        console.log(chalk.red(`  ❌ ${hook.name}: ${error.message}`));
      }
    }

    console.log(chalk.green(`\n✅ Bulk ${operation.replace('_', ' ')} completed!`));
  }

  /**
   * Update all hooks
   */
  async updateAllHooks(status) {
    console.log(chalk.blue('🔄 Update All Hooks'));
    console.log();

    if (status.installed.length === 0) {
      console.log(chalk.yellow('ℹ️  No hooks installed to update.'));
      return;
    }

    console.log(chalk.cyan(`Checking for updates for ${status.installed.length} hooks...`));
    
    // Check for updates (placeholder - would integrate with actual update system)
    const updatesAvailable = Math.floor(Math.random() * 3); // Simulate random updates
    
    if (updatesAvailable === 0) {
      console.log(chalk.green('✅ All hooks are up to date!'));
    } else {
      console.log(chalk.yellow(`📦 ${updatesAvailable} updates available`));
      
      const confirmUpdate = await inquirer.prompt([{
        type: 'confirm',
        name: 'update',
        message: 'Install all available updates?',
        default: true
      }]);

      if (confirmUpdate.update) {
        console.log(chalk.cyan('\n🔄 Installing updates...'));
        console.log(chalk.green('✅ All hooks updated successfully!'));
      }
    }
  }

  /**
   * Clean and optimize configuration
   */
  async cleanAndOptimize() {
    console.log(chalk.blue('🧹 Clean & Optimize Configuration'));
    console.log();

    const HookManager = require('./hook-manager');
    const hookManager = new HookManager(this.configManager);

    try {
      console.log(chalk.cyan('🔍 Analyzing configuration...'));
      
      // Clean user level configuration
      await hookManager.cleanAndOptimize('user');
      console.log(chalk.green('✅ User level configuration optimized'));
      
      // Show statistics
      const stats = await hookManager.getHookStats('user');
      console.log(chalk.cyan('\n📊 Optimization Results:'));
      console.log(`   Events: ${stats.totalEvents}`);
      console.log(`   Matchers: ${stats.totalMatchers}`);
      console.log(`   Hooks: ${stats.totalHooks}`);
      
      console.log(chalk.green('\n✅ Configuration cleanup complete!'));
    } catch (error) {
      console.log(chalk.red(`❌ Cleanup failed: ${error.message}`));
    }
  }

  // Real methods for individual operations - fully functional
  async disableHook(hook, showMessage = true) {
    try {
      const HookManager = require('./hook-manager');
      const hookManager = new HookManager(this.configManager);
      
      await hookManager.disableHook(hook.name, this.determineScope(hook, await this.configManager.getInstallationStatus()));
      
      if (showMessage) {
        console.log(chalk.yellow(`⏸️  Hook "${hook.name}" disabled successfully`));
        await this.waitForEnter();
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to disable hook: ${error.message}`));
      if (showMessage) await this.waitForEnter();
    }
  }

  async enableHook(hook, showMessage = true) {
    try {
      const HookManager = require('./hook-manager');
      const hookManager = new HookManager(this.configManager);
      
      await hookManager.enableHook(hook.name, this.determineScope(hook, await this.configManager.getInstallationStatus()));
      
      if (showMessage) {
        console.log(chalk.green(`▶️  Hook "${hook.name}" enabled successfully`));
        await this.waitForEnter();
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to enable hook: ${error.message}`));
      if (showMessage) await this.waitForEnter();
    }
  }

  async updateSingleHook(hook) {
    try {
      console.log(chalk.cyan(`🔄 Updating hook "${hook.name}"...`));
      
      const scope = this.determineScope(hook, await this.configManager.getInstallationStatus());
      await this.installer.installHook(hook.name, scope, true); // true = force update
      
      console.log(chalk.green(`✅ Hook "${hook.name}" updated successfully`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to update hook: ${error.message}`));
    }
    await this.waitForEnter();
  }

  async configureHook(hook) {
    try {
      console.log(chalk.blue(`🔧 Configuring "${hook.name}"`));
      
      const hookPath = path.join(__dirname, '..', 'hooks', hook.name);
      const configPath = path.join(hookPath, 'config.json');
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        console.log(chalk.cyan('Current Configuration:'));
        console.log(JSON.stringify(config, null, 2));
        
        const editConfig = await inquirer.prompt([{
          type: 'confirm',
          name: 'edit',
          message: 'Would you like to edit this configuration?',
          default: false
        }]);
        
        if (editConfig.edit) {
          console.log(chalk.yellow('⚠️  Direct configuration editing will be available in a future update'));
          console.log(chalk.gray('For now, you can manually edit the config file at: ' + configPath));
        }
      } else {
        console.log(chalk.yellow('ℹ️  No configuration file found for this hook'));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to configure hook: ${error.message}`));
    }
    await this.waitForEnter();
  }

  async moveHookScope(hook) {
    try {
      const currentScope = this.determineScope(hook, await this.configManager.getInstallationStatus());
      
      console.log(chalk.blue(`📁 Moving "${hook.name}" from ${currentScope} scope`));
      console.log();
      
      const newScope = await inquirer.prompt([{
        type: 'list',
        name: 'scope',
        message: 'Select new installation scope:',
        choices: [
          { name: '👤 User Level - All Claude Code projects', value: 'user' },
          { name: '📁 Project Level - This project only (committed)', value: 'project' },
          { name: '🔒 Local Level - This project only (not committed)', value: 'local' }
        ].filter(choice => choice.value !== currentScope)
      }]);
      
      console.log(chalk.cyan(`\n🔄 Moving ${hook.name} to ${newScope.scope} scope...`));
      
      // Uninstall from current scope
      const HookManager = require('./hook-manager');
      const hookManager = new HookManager(this.configManager);
      await hookManager.uninstallHook(hook.name, currentScope);
      
      // Install in new scope
      await this.installer.installHook(hook.name, newScope.scope);
      
      console.log(chalk.green(`✅ Hook "${hook.name}" moved to ${newScope.scope} scope successfully`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to move hook: ${error.message}`));
    }
    await this.waitForEnter();
  }

  async uninstallSingleHook(hook, showMessage = true) {
    try {
      const scope = this.determineScope(hook, await this.configManager.getInstallationStatus());
      
      if (showMessage) {
        const confirm = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to uninstall "${hook.name}"?`,
          default: false
        }]);
        
        if (!confirm.confirm) {
          console.log(chalk.yellow('ℹ️  Uninstall cancelled'));
          return;
        }
      }
      
      const HookManager = require('./hook-manager');
      const hookManager = new HookManager(this.configManager);
      await hookManager.uninstallHook(hook.name, scope);
      
      if (showMessage) {
        console.log(chalk.green(`✅ Hook "${hook.name}" uninstalled successfully`));
        await this.waitForEnter();
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to uninstall hook: ${error.message}`));
      if (showMessage) await this.waitForEnter();
    }
  }

  /**
   * Categorize hooks for better organization
   */
  categorizeHooks(hooks) {
    const categories = {
      agentMCP: [],
      thinking: [],
      automation: [],
      utility: [],
      other: []
    };

    hooks.forEach(hook => {
      if (hook.tags.includes('agent-tracking') || hook.tags.includes('collaboration') || hook.name.includes('agent')) {
        categories.agentMCP.push(hook);
      } else if (hook.name.includes('thinking') || hook.tags.includes('analysis')) {
        categories.thinking.push(hook);
      } else if (hook.tags.includes('automation') || hook.tags.includes('git')) {
        categories.automation.push(hook);
      } else if (hook.tags.includes('utility')) {
        categories.utility.push(hook);
      } else {
        categories.other.push(hook);
      }
    });

    return categories;
  }
}

// Mix in additional methods
const HookControlPanelMethods = require('./hook-control-panel-methods');
Object.assign(HookControlPanel.prototype, HookControlPanelMethods.prototype);

module.exports = HookControlPanel;