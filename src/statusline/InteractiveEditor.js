const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

/**
 * Advanced Interactive Status Line Editor
 * Real-time preview, drag-and-drop components, visual customization
 */
class InteractiveEditor {
  constructor(statusLineManager) {
    this.manager = statusLineManager;
    this.currentTemplate = null;
    this.currentComponents = [];
    this.currentColors = {};
    this.currentSeparator = ' | ';
    this.previewEnabled = true;
  }

  /**
   * Main interactive editor interface
   */
  async start() {
    console.clear();
    this.showHeader();
    
    while (true) {
      await this.showCurrentDesign();
      await this.showLivePreview();
      
      const action = await this.showMainMenu();
      
      switch (action) {
        case 'components':
          await this.editComponents();
          break;
        case 'colors':
          await this.editColors();
          break;
        case 'templates':
          await this.selectTemplate();
          break;
        case 'separator':
          await this.editSeparator();
          break;
        case 'test':
          await this.testStatusLine();
          break;
        case 'save':
          await this.saveConfiguration();
          break;
        case 'export':
          await this.exportConfiguration();
          break;
        case 'import':
          await this.importConfiguration();
          break;
        case 'back':
          return false;
        case 'quit':
          return true;
      }
    }
  }

  /**
   * Show editor header
   */
  showHeader() {
    console.log(chalk.bold.magenta('🎨 Advanced Status Line Editor'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log();
  }

  /**
   * Show current design preview
   */
  async showCurrentDesign() {
    console.log(chalk.bold.cyan('Current Design:'));
    
    if (this.currentComponents.length === 0) {
      console.log(chalk.gray('  No components selected'));
    } else {
      const preview = await this.generatePreview();
      console.log(`  ${preview}`);
      
      console.log();
      console.log(chalk.blue('Components: ') + 
        this.currentComponents.map(comp => {
          const component = this.manager.availableComponents.find(c => c.name === comp);
          return component ? `${component.icon} ${component.displayName}` : comp;
        }).join(chalk.gray(' → '))
      );
      
      console.log(chalk.blue('Separator: ') + chalk.yellow(`"${this.currentSeparator}"`));
    }
    console.log();
  }

  /**
   * Generate live preview
   */
  async generatePreview() {
    if (this.currentComponents.length === 0) {
      return chalk.gray('(empty)');
    }

    const parts = [];
    
    for (const compName of this.currentComponents) {
      const component = this.manager.availableComponents.find(c => c.name === compName);
      if (!component) continue;

      const color = this.currentColors[compName] || 'white';
      const chalkColor = this.getChalkColor(color);
      
      switch (compName) {
        case 'model':
          parts.push(chalkColor('[Rapala]'));
          break;
        case 'directory':
          parts.push(chalkColor('📁 rins_hooks'));
          break;
        case 'git':
          parts.push(chalkColor('🌿 main*'));
          break;
        case 'time':
          parts.push(chalkColor(new Date().toLocaleTimeString().slice(0, 8)));
          break;
        case 'system':
          parts.push(chalkColor('CPU:45%'));
          break;
        case 'docker':
          parts.push(chalkColor('🐳 3'));
          break;
        case 'custom':
          parts.push(chalkColor('✨ custom'));
          break;
        default:
          parts.push(chalkColor(`${component.icon} ${component.displayName}`));
      }
    }

    return parts.join(chalk.gray(this.currentSeparator));
  }

  /**
   * Show live preview panel
   */
  async showLivePreview() {
    if (this.previewEnabled && this.currentComponents.length > 0) {
      console.log(chalk.bold.green('Live Preview:'));
      console.log(chalk.gray('┌') + chalk.gray('─'.repeat(58)) + chalk.gray('┐'));
      const preview = await this.generatePreview();
      const paddedPreview = ` ${preview} `.padEnd(58);
      console.log(chalk.gray('│') + paddedPreview + chalk.gray('│'));
      console.log(chalk.gray('└') + chalk.gray('─'.repeat(58)) + chalk.gray('┘'));
      console.log();
    }
  }

  /**
   * Show main menu
   */
  async showMainMenu() {
    const choices = [
      { name: '🧩 Edit Components', value: 'components' },
      { name: '🎨 Customize Colors', value: 'colors' },
      { name: '📄 Load Template', value: 'templates' },
      { name: '🔗 Change Separator', value: 'separator' },
      new inquirer.Separator(),
      { name: '🧪 Test Status Line', value: 'test' },
      { name: '💾 Save Configuration', value: 'save' },
      new inquirer.Separator(),
      { name: '📤 Export Config', value: 'export' },
      { name: '📥 Import Config', value: 'import' },
      new inquirer.Separator(),
      { name: '← Back to Menu', value: 'back' },
      { name: '❌ Quit Editor', value: 'quit' }
    ];

    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: choices,
      pageSize: 15
    }]);

    console.clear();
    this.showHeader();
    return answer.action;
  }

  /**
   * Edit components with drag-and-drop simulation
   */
  async editComponents() {
    console.log(chalk.bold.blue('🧩 Component Editor'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();

    const action = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Component actions:',
      choices: [
        { name: '➕ Add Components', value: 'add' },
        { name: '🔄 Reorder Components', value: 'reorder' },
        { name: '❌ Remove Components', value: 'remove' },
        { name: '🔧 Configure Components', value: 'configure' },
        { name: '← Back', value: 'back' }
      ]
    }]);

    switch (action.action) {
      case 'add':
        await this.addComponents();
        break;
      case 'reorder':
        await this.reorderComponents();
        break;
      case 'remove':
        await this.removeComponents();
        break;
      case 'configure':
        await this.configureComponents();
        break;
    }
  }

  /**
   * Add components
   */
  async addComponents() {
    const available = this.manager.availableComponents.filter(
      comp => !this.currentComponents.includes(comp.name)
    );

    if (available.length === 0) {
      console.log(chalk.yellow('All components are already added!'));
      await this.waitForEnter();
      return;
    }

    const choices = available.map(comp => ({
      name: `${comp.icon} ${comp.displayName} - ${comp.description}`,
      value: comp.name
    }));

    const answer = await inquirer.prompt([{
      type: 'checkbox',
      name: 'components',
      message: 'Select components to add:',
      choices: choices
    }]);

    this.currentComponents.push(...answer.components);
    
    // Set default colors for new components
    answer.components.forEach(comp => {
      const component = this.manager.availableComponents.find(c => c.name === comp);
      if (component && component.defaultConfig) {
        this.currentColors[comp] = component.defaultConfig.color || 'white';
      }
    });

    console.log(chalk.green(`✅ Added ${answer.components.length} components`));
    await this.waitForEnter();
  }

  /**
   * Reorder components
   */
  async reorderComponents() {
    if (this.currentComponents.length === 0) {
      console.log(chalk.yellow('No components to reorder!'));
      await this.waitForEnter();
      return;
    }

    console.log(chalk.blue('Drag and drop components to reorder:'));
    console.log(chalk.gray('(Select the order you want)'));
    console.log();

    const choices = this.currentComponents.map(comp => {
      const component = this.manager.availableComponents.find(c => c.name === comp);
      return {
        name: `${component.icon} ${component.displayName}`,
        value: comp
      };
    });

    // Simulate drag-and-drop with multiple selections
    const newOrder = [];
    let remaining = [...this.currentComponents];

    while (remaining.length > 0) {
      const availableChoices = remaining.map(comp => {
        const component = this.manager.availableComponents.find(c => c.name === comp);
        return {
          name: `${component.icon} ${component.displayName}`,
          value: comp
        };
      });

      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'component',
        message: `Select component #${newOrder.length + 1}:`,
        choices: availableChoices
      }]);

      newOrder.push(answer.component);
      remaining = remaining.filter(c => c !== answer.component);
    }

    this.currentComponents = newOrder;
    console.log(chalk.green('✅ Components reordered!'));
    await this.waitForEnter();
  }

  /**
   * Remove components
   */
  async removeComponents() {
    if (this.currentComponents.length === 0) {
      console.log(chalk.yellow('No components to remove!'));
      await this.waitForEnter();
      return;
    }

    const choices = this.currentComponents.map(comp => {
      const component = this.manager.availableComponents.find(c => c.name === comp);
      return {
        name: `${component.icon} ${component.displayName}`,
        value: comp
      };
    });

    const answer = await inquirer.prompt([{
      type: 'checkbox',
      name: 'components',
      message: 'Select components to remove:',
      choices: choices
    }]);

    this.currentComponents = this.currentComponents.filter(
      comp => !answer.components.includes(comp)
    );

    // Remove colors for removed components
    answer.components.forEach(comp => {
      delete this.currentColors[comp];
    });

    console.log(chalk.green(`✅ Removed ${answer.components.length} components`));
    await this.waitForEnter();
  }

  /**
   * Edit colors with visual picker
   */
  async editColors() {
    if (this.currentComponents.length === 0) {
      console.log(chalk.yellow('Add components first to customize colors!'));
      await this.waitForEnter();
      return;
    }

    console.log(chalk.bold.magenta('🎨 Color Customization'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();

    for (const comp of this.currentComponents) {
      const component = this.manager.availableComponents.find(c => c.name === comp);
      if (!component) continue;

      const currentColor = this.currentColors[comp] || 'white';
      
      console.log(`${component.icon} ${chalk.bold(component.displayName)}`);
      console.log(`Current: ${this.getChalkColor(currentColor)(currentColor)}`);
      
      const colorChoices = [
        { name: chalk.red('red'), value: 'red' },
        { name: chalk.green('green'), value: 'green' },
        { name: chalk.yellow('yellow'), value: 'yellow' },
        { name: chalk.blue('blue'), value: 'blue' },
        { name: chalk.magenta('magenta'), value: 'magenta' },
        { name: chalk.cyan('cyan'), value: 'cyan' },
        { name: chalk.white('white'), value: 'white' },
        { name: chalk.bold.red('bold_red'), value: 'bold_red' },
        { name: chalk.bold.green('bold_green'), value: 'bold_green' },
        { name: chalk.bold.yellow('bold_yellow'), value: 'bold_yellow' },
        { name: chalk.bold.blue('bold_blue'), value: 'bold_blue' },
        { name: chalk.bold.magenta('bold_magenta'), value: 'bold_magenta' },
        { name: chalk.bold.cyan('bold_cyan'), value: 'bold_cyan' },
        { name: chalk.bold.white('bold_white'), value: 'bold_white' },
        { name: '(keep current)', value: currentColor }
      ];

      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'color',
        message: `Choose color for ${component.displayName}:`,
        choices: colorChoices,
        default: currentColor
      }]);

      this.currentColors[comp] = answer.color;
      console.log(chalk.green(`✅ ${component.displayName} color set to ${answer.color}`));
      console.log();
    }

    await this.waitForEnter();
  }

  /**
   * Select template
   */
  async selectTemplate() {
    console.log(chalk.bold.yellow('📄 Template Gallery'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();

    const choices = this.manager.availableTemplates.map(template => ({
      name: `${template.displayName} - ${template.description}\n  Preview: ${template.preview}`,
      value: template.name,
      short: template.displayName
    }));

    choices.push({ name: '← Back', value: 'back' });

    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'template',
      message: 'Choose a template:',
      choices: choices,
      pageSize: 8
    }]);

    if (answer.template === 'back') return;

    const template = this.manager.availableTemplates.find(t => t.name === answer.template);
    if (template) {
      this.currentTemplate = template;
      this.currentComponents = [...template.components];
      this.currentColors = { ...template.colors };
      this.currentSeparator = template.separator || ' | ';
      
      console.log(chalk.green(`✅ Applied template: ${template.displayName}`));
    }

    await this.waitForEnter();
  }

  /**
   * Edit separator
   */
  async editSeparator() {
    console.log(chalk.bold.blue('🔗 Separator Editor'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();

    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'separator',
      message: 'Choose separator style:',
      choices: [
        { name: 'Pipe: " | "', value: ' | ' },
        { name: 'Arrow: " → "', value: ' → ' },
        { name: 'Dot: " • "', value: ' • ' },
        { name: 'Space: "   "', value: '   ' },
        { name: 'Minimal: " "', value: ' ' },
        { name: 'Powerline: "  "', value: '  ' },
        { name: 'Custom...', value: 'custom' }
      ]
    }]);

    if (answer.separator === 'custom') {
      const custom = await inquirer.prompt([{
        type: 'input',
        name: 'separator',
        message: 'Enter custom separator:',
        default: this.currentSeparator
      }]);
      this.currentSeparator = custom.separator;
    } else {
      this.currentSeparator = answer.separator;
    }

    console.log(chalk.green(`✅ Separator set to: "${this.currentSeparator}"`));
    await this.waitForEnter();
  }

  /**
   * Test status line
   */
  async testStatusLine() {
    console.log(chalk.bold.blue('🧪 Status Line Testing'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();

    if (this.currentComponents.length === 0) {
      console.log(chalk.yellow('No components to test! Add some first.'));
      await this.waitForEnter();
      return;
    }

    console.log(chalk.green('Generated Status Line:'));
    const preview = await this.generatePreview();
    console.log();
    console.log(chalk.gray('┌') + chalk.gray('─'.repeat(58)) + chalk.gray('┐'));
    console.log(chalk.gray('│') + ` ${preview} `.padEnd(59) + chalk.gray('│'));
    console.log(chalk.gray('└') + chalk.gray('─'.repeat(58)) + chalk.gray('┘'));
    console.log();

    console.log(chalk.blue('Components: ') + this.currentComponents.length);
    console.log(chalk.blue('Separator: ') + `"${this.currentSeparator}"`);
    console.log(chalk.blue('Colors: ') + Object.keys(this.currentColors).length + ' configured');

    console.log();
    await this.waitForEnter();
  }

  /**
   * Save configuration
   */
  async saveConfiguration() {
    if (this.currentComponents.length === 0) {
      console.log(chalk.yellow('Nothing to save! Add components first.'));
      await this.waitForEnter();
      return;
    }

    console.log(chalk.bold.green('💾 Save Configuration'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();

    const template = this.currentTemplate || {
      name: 'custom',
      displayName: 'Custom Configuration',
      components: this.currentComponents,
      separator: this.currentSeparator,
      colors: this.currentColors
    };

    // Generate script
    const script = this.manager.generateScript(template, this.currentComponents, {
      separator: this.currentSeparator,
      colors: this.currentColors
    });

    const scope = await inquirer.prompt([{
      type: 'list',
      name: 'scope',
      message: 'Save where?',
      choices: [
        { name: 'Global (~/.claude/settings.json)', value: 'user' },
        { name: 'Project (.claude/settings.json)', value: 'project' }
      ]
    }]);

    // Save script file
    const scriptPath = scope.scope === 'user'
      ? path.join(require('os').homedir(), '.claude', 'statusline.sh')
      : path.join(process.cwd(), '.claude', 'statusline.sh');

    await fs.promises.mkdir(path.dirname(scriptPath), { recursive: true });
    await fs.promises.writeFile(scriptPath, script, { mode: 0o755 });

    // Save configuration
    const config = {
      type: 'command',
      command: scriptPath.replace(require('os').homedir(), '~'),
      padding: 0
    };

    await this.manager.saveConfig(config, scope.scope);

    console.log(chalk.green('✅ Configuration saved successfully!'));
    console.log(chalk.blue('Script: ') + scriptPath);
    console.log(chalk.blue('Config: ') + (scope.scope === 'user' ? '~/.claude/settings.json' : '.claude/settings.json'));

    await this.waitForEnter();
  }

  /**
   * Export configuration
   */
  async exportConfiguration() {
    if (this.currentComponents.length === 0) {
      console.log(chalk.yellow('Nothing to export! Create a design first.'));
      await this.waitForEnter();
      return;
    }

    const exportData = {
      name: this.currentTemplate?.name || 'custom',
      displayName: this.currentTemplate?.displayName || 'Custom Design',
      components: this.currentComponents,
      separator: this.currentSeparator,
      colors: this.currentColors,
      exportedAt: new Date().toISOString(),
      exportedBy: 'Rapala Status Line Editor'
    };

    console.log(chalk.bold.blue('📤 Export Configuration'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();
    console.log(chalk.green('Configuration JSON:'));
    console.log(chalk.gray(JSON.stringify(exportData, null, 2)));

    await this.waitForEnter();
  }

  /**
   * Import configuration
   */
  async importConfiguration() {
    console.log(chalk.bold.blue('📥 Import Configuration'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log();
    console.log(chalk.blue('🚧 Import functionality coming soon!'));
    console.log(chalk.gray('This will allow importing shared configurations'));

    await this.waitForEnter();
  }

  /**
   * Wait for enter key
   */
  async waitForEnter() {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  /**
   * Get chalk color function
   */
  getChalkColor(color) {
    const colors = {
      red: chalk.red,
      green: chalk.green,
      yellow: chalk.yellow,
      blue: chalk.blue,
      magenta: chalk.magenta,
      cyan: chalk.cyan,
      white: chalk.white,
      bold_red: chalk.bold.red,
      bold_green: chalk.bold.green,
      bold_yellow: chalk.bold.yellow,
      bold_blue: chalk.bold.blue,
      bold_magenta: chalk.bold.magenta,
      bold_cyan: chalk.bold.cyan,
      bold_white: chalk.bold.white
    };
    return colors[color] || chalk.white;
  }
}

module.exports = InteractiveEditor;