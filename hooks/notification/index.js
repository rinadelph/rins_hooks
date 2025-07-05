#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const HookBase = require('../../src/hook-base');

class NotificationHook extends HookBase {
  constructor(config = {}) {
    super('notification', config);
  }

  getDefaultConfig() {
    return {
      enabled: true,
      matcher: '',
      timeout: 10,
      description: 'Enhanced notifications for Claude Code events',
      desktopNotifications: true,
      soundEnabled: false,
      iconPath: '',
      notificationTypes: {
        'task_completed': {
          'enabled': true,
          'title': 'Claude Code Task Completed',
          'message': 'Task has been completed successfully'
        },
        'permission_required': {
          'enabled': true,
          'title': 'Claude Code Permission Required',
          'message': 'Claude Code is waiting for your permission'
        },
        'error': {
          'enabled': true,
          'title': 'Claude Code Error',
          'message': 'An error occurred during task execution'
        },
        'idle': {
          'enabled': false,
          'title': 'Claude Code Idle',
          'message': 'Claude Code is waiting for input'
        }
      },
      integrations: {
        'slack': {
          'enabled': false,
          'webhook': '',
          'channel': '#general'
        },
        'discord': {
          'enabled': false,
          'webhook': ''
        },
        'teams': {
          'enabled': false,
          'webhook': ''
        }
      },
      customCommands: {
        'onTaskCompleted': '',
        'onError': '',
        'onIdle': ''
      }
    };
  }

  async execute(input) {
    try {
      const { message, title } = input;

      if (!message && !title) {
        return this.success({ message: 'No notification data provided' });
      }

      // Determine notification type based on message content
      const notificationType = this.determineNotificationType(message, title);

      // Check if this notification type is enabled
      const typeConfig = this.config.notificationTypes[notificationType];
      if (!typeConfig || !typeConfig.enabled) {
        return this.success({ message: `Notification type '${notificationType}' is disabled` });
      }

      // Get notification content
      const notificationTitle = title || typeConfig.title;
      const notificationMessage = message || typeConfig.message;

      // Send notifications
      const results = [];

      // Desktop notification
      if (this.config.desktopNotifications) {
        const desktopResult = await this.sendDesktopNotification(notificationTitle, notificationMessage);
        results.push({ type: 'desktop', ...desktopResult });
      }

      // Integration notifications
      if (this.config.integrations.slack.enabled) {
        const slackResult = await this.sendSlackNotification(notificationTitle, notificationMessage);
        results.push({ type: 'slack', ...slackResult });
      }

      if (this.config.integrations.discord.enabled) {
        const discordResult = await this.sendDiscordNotification(notificationTitle, notificationMessage);
        results.push({ type: 'discord', ...discordResult });
      }

      if (this.config.integrations.teams.enabled) {
        const teamsResult = await this.sendTeamsNotification(notificationTitle, notificationMessage);
        results.push({ type: 'teams', ...teamsResult });
      }

      // Custom commands
      const customCommand = this.config.customCommands[`on${this.capitalizeFirst(notificationType.replace('_', ''))}`];
      if (customCommand) {
        const customResult = await this.executeCustomCommand(customCommand, notificationTitle, notificationMessage);
        results.push({ type: 'custom', ...customResult });
      }

      return this.success({
        message: `Notification sent: ${notificationTitle}`,
        type: notificationType,
        results: results
      });

    } catch (error) {
      return this.error(`Notification failed: ${error.message}`);
    }
  }

  determineNotificationType(message, title) {
    const content = (`${message} ${title}`).toLowerCase();

    if (content.includes('permission') || content.includes('waiting') || content.includes('approve')) {
      return 'permission_required';
    }

    if (content.includes('error') || content.includes('failed') || content.includes('fail')) {
      return 'error';
    }

    if (content.includes('completed') || content.includes('finished') || content.includes('done')) {
      return 'task_completed';
    }

    if (content.includes('idle') || content.includes('input')) {
      return 'idle';
    }

    return 'task_completed'; // Default
  }

  async sendDesktopNotification(title, message) {
    try {
      // Try to use node-notifier if available
      try {
        const notifier = require('node-notifier');

        const options = {
          title: title,
          message: message,
          sound: this.config.soundEnabled,
          wait: false
        };

        if (this.config.iconPath && fs.existsSync(this.config.iconPath)) {
          options.icon = this.config.iconPath;
        }

        notifier.notify(options);

        return { success: true, message: 'Desktop notification sent via node-notifier' };
      } catch (nodeNotifierError) {
        // Fallback to platform-specific commands
        return await this.sendPlatformNotification(title, message);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendPlatformNotification(title, message) {
    const platform = process.platform;

    try {
      let command, args;

      switch (platform) {
        case 'darwin': // macOS
          command = 'osascript';
          args = ['-e', `display notification "${message}" with title "${title}"`];
          break;

        case 'linux':
          command = 'notify-send';
          args = [title, message];
          break;

        case 'win32':
          // Use PowerShell for Windows notifications
          command = 'powershell';
          args = ['-Command', `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $template.GetElementsByTagName('text')[0].InnerText = '${title}'; $template.GetElementsByTagName('text')[1].InnerText = '${message}'; $toast = [Windows.UI.Notifications.ToastNotification]::new($template); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show($toast)`];
          break;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      await this.executeCommand(command, args);
      return { success: true, message: `Desktop notification sent via ${command}` };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendSlackNotification(title, message) {
    try {
      const webhook = this.config.integrations.slack.webhook;
      const channel = this.config.integrations.slack.channel;

      if (!webhook) {
        throw new Error('Slack webhook URL not configured');
      }

      const payload = {
        channel: channel,
        text: `*${title}*\n${message}`,
        username: 'Claude Code',
        icon_emoji: ':robot_face:'
      };

      await this.sendWebhook(webhook, payload);
      return { success: true, message: 'Slack notification sent' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendDiscordNotification(title, message) {
    try {
      const webhook = this.config.integrations.discord.webhook;

      if (!webhook) {
        throw new Error('Discord webhook URL not configured');
      }

      const payload = {
        embeds: [{
          title: title,
          description: message,
          color: 0x1f8b4c,
          footer: {
            text: 'Claude Code via rins_hooks'
          },
          timestamp: new Date().toISOString()
        }]
      };

      await this.sendWebhook(webhook, payload);
      return { success: true, message: 'Discord notification sent' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendTeamsNotification(title, message) {
    try {
      const webhook = this.config.integrations.teams.webhook;

      if (!webhook) {
        throw new Error('Teams webhook URL not configured');
      }

      const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        'themeColor': '0076D7',
        'summary': title,
        'sections': [{
          'activityTitle': title,
          'activitySubtitle': 'Claude Code Notification',
          'activityImage': 'https://claude.ai/favicon.ico',
          'text': message,
          'markdown': true
        }]
      };

      await this.sendWebhook(webhook, payload);
      return { success: true, message: 'Teams notification sent' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  sendWebhook(url, payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  async executeCustomCommand(command, title, message) {
    try {
      // Replace placeholders in command
      const processedCommand = command
        .replace(/\{\{title\}\}/g, title)
        .replace(/\{\{message\}\}/g, message);

      const result = await this.executeCommand('sh', ['-c', processedCommand]);

      return {
        success: result.success,
        message: result.success ? 'Custom command executed' : 'Custom command failed',
        output: result.output,
        error: result.error
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  executeCommand(command, args) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
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

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// If called directly, execute the hook
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const hook = new NotificationHook();
      const result = await hook.execute(input);
      HookBase.outputResult(result);
    } catch (error) {
      console.error(`Notification hook error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = NotificationHook;
