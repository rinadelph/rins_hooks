#!/usr/bin/env node

/**
 * Conversation Query Tool
 * Query the git worktree conversation archive
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ConversationQuery {
  constructor() {
    this.worktreePath = path.resolve(__dirname, '../../rins_hooks_conversations');
  }

  async runGitCommand(args) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd: this.worktreePath });
      let output = '';
      let error = '';
      
      git.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || 'Git command failed'));
        }
      });
    });
  }

  async queryByTool(toolName) {
    console.log(`\n🔍 Tool Usage: ${toolName}\n`);
    
    try {
      const result = await this.runGitCommand([
        'log', '--grep', `Tool: ${toolName}`, '--oneline', '--graph'
      ]);
      console.log(result || 'No usage found');
    } catch (error) {
      console.error('Error querying tool usage:', error.message);
    }
  }

  async queryBySession(sessionId) {
    console.log(`\n🔍 Session: ${sessionId}\n`);
    
    try {
      const result = await this.runGitCommand([
        'log', '--grep', `Session: ${sessionId}`, '--oneline', '--graph'
      ]);
      console.log(result || 'No session found');
    } catch (error) {
      console.error('Error querying session:', error.message);
    }
  }

  async queryByFile(fileName) {
    console.log(`\n🔍 File Usage: ${fileName}\n`);
    
    try {
      const result = await this.runGitCommand([
        'log', '--grep', `File: ${fileName}`, '--oneline', '--graph'
      ]);
      console.log(result || 'No file usage found');
    } catch (error) {
      console.error('Error querying file usage:', error.message);
    }
  }

  async recentActivity(limit = 10) {
    console.log(`\n📊 Recent Activity (last ${limit})\n`);
    
    try {
      const result = await this.runGitCommand([
        'log', '--oneline', '--graph', `--max-count=${limit}`, '--format=%h %s %cr'
      ]);
      console.log(result || 'No activity found');
    } catch (error) {
      console.error('Error querying recent activity:', error.message);
    }
  }

  async toolStats() {
    console.log('\n📈 Tool Usage Statistics\n');
    
    try {
      const result = await this.runGitCommand([
        'log', '--grep', 'Tool:', '--format=%s'
      ]);
      
      const tools = {};
      result.split('\n').forEach(line => {
        const match = line.match(/Tool: (\\w+)/);
        if (match) {
          const tool = match[1];
          tools[tool] = (tools[tool] || 0) + 1;
        }
      });
      
      const sorted = Object.entries(tools)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      sorted.forEach(([tool, count]) => {
        console.log(`${tool.padEnd(15)} ${count} uses`);
      });
      
    } catch (error) {
      console.error('Error generating tool stats:', error.message);
    }
  }

  async sessionList() {
    console.log('\n📋 Active Sessions\n');
    
    try {
      const sessionsDir = path.join(this.worktreePath, 'conversations', 'sessions');
      
      if (!fs.existsSync(sessionsDir)) {
        console.log('No sessions found');
        return;
      }
      
      const sessions = fs.readdirSync(sessionsDir);
      
      for (const sessionId of sessions) {
        const sessionFile = path.join(sessionsDir, sessionId, 'session.json');
        
        if (fs.existsSync(sessionFile)) {
          const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
          const toolCount = data.tools ? data.tools.length : 0;
          const lastUpdate = data.last_update ? new Date(data.last_update).toLocaleString() : 'Unknown';
          
          console.log(`${sessionId.substring(0, 8)}... | ${toolCount} tools | Last: ${lastUpdate}`);
        }
      }
      
    } catch (error) {
      console.error('Error listing sessions:', error.message);
    }
  }

  showUsage() {
    console.log(`
🔍 Conversation Query Tool

Usage:
  node conversation-query.js <command> [args]

Commands:
  tool <name>       Show usage of specific tool
  session <id>      Show session activity  
  file <name>       Show file modification history
  recent [limit]    Show recent activity (default: 10)
  stats             Show tool usage statistics
  sessions          List all sessions
  help              Show this help

Examples:
  node conversation-query.js tool Edit
  node conversation-query.js session d8388337
  node conversation-query.js file index.js
  node conversation-query.js recent 20
  node conversation-query.js stats
`);
  }
}

// CLI Interface
async function main() {
  const query = new ConversationQuery();
  const [,, command, ...args] = process.argv;
  
  if (!command || command === 'help') {
    query.showUsage();
    return;
  }
  
  try {
    switch (command) {
      case 'tool':
        await query.queryByTool(args[0]);
        break;
      case 'session':
        await query.queryBySession(args[0]);
        break;
      case 'file':
        await query.queryByFile(args[0]);
        break;
      case 'recent':
        await query.recentActivity(parseInt(args[0]) || 10);
        break;
      case 'stats':
        await query.toolStats();
        break;
      case 'sessions':
        await query.sessionList();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        query.showUsage();
    }
  } catch (error) {
    console.error('Query failed:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = ConversationQuery;