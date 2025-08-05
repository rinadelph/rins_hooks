#!/usr/bin/env node

/**
 * Session-Based Conversation Archiver - Rapala Managed
 * 
 * New Architecture:
 * - Sessions as worktrees (not individual prompts)
 * - Messages/tools as commits within session
 * - Clean hierarchy: conversations/session-XXXX/
 * - Scalable: 100 sessions = 100 worktrees (not thousands)
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class SessionConversationArchiver {
  constructor() {
    this.debugLog = '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/session-archiver-debug.log';
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${message}\n`;
    require('fs').appendFileSync(this.debugLog, logMsg);
  }

  async execute(toolRecord) {
    try {
      this.log(`=== SESSION ARCHIVER START ===`);
      
      // Extract session ID
      const sessionId = toolRecord.session_id || toolRecord.conversation_id;
      if (!sessionId) {
        this.log(`❌ No session ID available`);
        return '';
      }
      
      const shortSessionId = sessionId.substring(0, 8);
      this.log(`📋 Processing session: ${shortSessionId}`);
      
      // Set up session worktree path
      const conversationsDir = '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/conversations';
      const sessionWorktreePath = path.join(conversationsDir, `session-${shortSessionId}`);
      
      this.log(`📁 Session worktree: ${sessionWorktreePath}`);
      
      // Ensure session worktree exists
      await this.ensureSessionWorktree(conversationsDir, sessionWorktreePath, shortSessionId);
      
      // Get conversation context
      const conversationData = await this.getConversationData(toolRecord.transcript_path);
      this.log(`💬 User prompt: "${conversationData.userPrompt}"`);
      this.log(`🔧 Tool: ${toolRecord.tool_name}`);
      
      // Create commit in session repo
      await this.createSessionCommit(sessionWorktreePath, toolRecord, conversationData);
      
      this.log(`✅ Session commit created`);
      this.log(`=== SESSION ARCHIVER COMPLETE ===\n`);
      
      return '';
    } catch (error) {
      this.log(`❌ Error: ${error.message}`);
      return '';
    }
  }

  async ensureSessionWorktree(conversationsDir, sessionWorktreePath, shortSessionId) {
    try {
      // Check if conversations directory exists
      try {
        await fs.access(conversationsDir);
      } catch {
        await fs.mkdir(conversationsDir, { recursive: true });
        this.log(`📁 Created conversations directory`);
      }
      
      // Check if session worktree already exists
      try {
        await fs.access(sessionWorktreePath);
        this.log(`📋 Session worktree exists: ${shortSessionId}`);
        return;
      } catch {
        this.log(`🆕 Creating new session worktree: ${shortSessionId}`);
      }
      
      // Create git worktree for this session
      const mainRepoPath = '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks';
      const branchName = `session-${shortSessionId}`;
      
      // Create new orphan branch and worktree
      await this.runGitCommand(mainRepoPath, [
        'worktree', 'add', '--detach', sessionWorktreePath
      ]);
      
      // Initialize as independent git repo in the worktree
      await this.runGitCommand(sessionWorktreePath, ['checkout', '--orphan', branchName]);
      await this.runGitCommand(sessionWorktreePath, ['rm', '-rf', '.'], true); // Allow failure
      
      // Create initial commit
      const initFile = path.join(sessionWorktreePath, 'session-info.md');
      await fs.writeFile(initFile, `# Session ${shortSessionId}\\n\\nConversation started: ${new Date().toISOString()}\\n`);
      
      await this.runGitCommand(sessionWorktreePath, ['add', 'session-info.md']);
      await this.runGitCommand(sessionWorktreePath, [
        'commit', '-m', `Session ${shortSessionId}: Conversation started`
      ]);
      
      this.log(`🎉 Created session worktree: ${shortSessionId}`);
      
    } catch (error) {
      this.log(`❌ Failed to create session worktree: ${error.message}`);
      throw error;
    }
  }

  async getConversationData(transcriptPath) {
    try {
      if (!transcriptPath) return { userPrompt: '', claudeResponse: '', messageNumber: 1 };
      
      const data = await fs.readFile(transcriptPath, 'utf8');
      const lines = data.trim().split('\\n');
      
      // Search ALL lines, not just recent 150 - user prompts might be much earlier!
      this.log(`📊 Parsing ${lines.length} transcript lines for conversation context`);
      
      // Find the most recent real user prompt by searching backwards through ALL lines
      let userEntriesFound = 0;
      let userTextFound = 0;
      let userTextFiltered = 0;
      let jsonParseErrors = 0;
      
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === 'user') {
            userEntriesFound++;
            this.log(`🔍 Found user entry ${userEntriesFound}: ${JSON.stringify(entry.message || {}).substring(0, 100)}...`);
            
            if (entry.message) {
              let userText = '';
              
              if (typeof entry.message.content === 'string') {
                userText = entry.message.content;
              } else if (Array.isArray(entry.message.content)) {
                const textParts = entry.message.content
                  .filter(item => item.type === 'text')
                  .map(item => item.text);
                userText = textParts.join(' ');
              }
              
              if (userText && userText.trim().length > 0) {
                userTextFound++;
                this.log(`📝 User text candidate: "${userText.substring(0, 100)}..."`);
                
                // Skip hook/system messages
                if (!userText.includes('<user-prompt-submit-hook>') &&
                    !userText.includes('tool_use_id') &&
                    !userText.includes('<system-reminder>') &&
                    userText.trim().length > 5) {
                  userTextFiltered++;
              
              // Find corresponding Claude response
              const claudeResponse = await this.findClaudeResponse(lines, i);
              
              // Count total messages to get message number
              const messageNumber = this.countUserMessages(lines);
              
              return { 
                userPrompt: userText.length > 150 ? userText.substring(0, 150) + '...' : userText,
                claudeResponse: claudeResponse.length > 200 ? claudeResponse.substring(0, 200) + '...' : claudeResponse,
                messageNumber
              };
            }
          }
        } catch (parseError) {
          continue;
        }
      }
      
      this.log(`📈 Parsing results: ${userEntriesFound} user entries, ${userTextFound} with text, ${userTextFiltered} passed filters`);
      return { userPrompt: '', claudeResponse: '', messageNumber: 1 };
    } catch (error) {
      this.log(`Error getting conversation data: ${error.message}`);
      return { userPrompt: '', claudeResponse: '', messageNumber: 1 };
    }
  }

  async findClaudeResponse(lines, userIndex) {
    for (let i = userIndex + 1; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message && Array.isArray(entry.message.content)) {
          const textParts = entry.message.content
            .filter(item => item.type === 'text')
            .map(item => item.text);
          const response = textParts.join(' ');
          if (response && response.trim().length > 10) {
            return response;
          }
        }
      } catch (parseError) {
        continue;
      }
    }
    return '';
  }

  countUserMessages(lines) {
    let count = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' && entry.message) {
          let userText = '';
          if (typeof entry.message.content === 'string') {
            userText = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            const textParts = entry.message.content
              .filter(item => item.type === 'text')
              .map(item => item.text);
            userText = textParts.join(' ');
          }
          
          // Count real user messages (not hook messages)
          if (userText && 
              !userText.includes('<user-prompt-submit-hook>') &&
              !userText.includes('tool_use_id') &&
              userText.trim().length > 5) {
            count++;
          }
        }
      } catch (parseError) {
        continue;
      }
    }
    return count;
  }

  async createSessionCommit(sessionWorktreePath, toolRecord, conversationData) {
    try {
      // Create tool execution record file
      const toolFile = path.join(sessionWorktreePath, `${toolRecord.tool_name}-${Date.now()}.json`);
      await fs.writeFile(toolFile, JSON.stringify(toolRecord, null, 2));
      
      // Stage the file
      await this.runGitCommand(sessionWorktreePath, ['add', '.']);
      
      // Generate commit message with full conversation context
      const commitMessage = this.generateSessionCommitMessage(toolRecord, conversationData);
      
      // Create commit
      await this.runGitCommand(sessionWorktreePath, ['commit', '-m', commitMessage, '--allow-empty']);
      
      this.log(`💾 Commit created: Message ${conversationData.messageNumber}`);
      
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        this.log(`⏭️  Nothing to commit - clean working tree`);
        return;
      }
      throw error;
    }
  }

  generateSessionCommitMessage(toolRecord, conversationData) {
    const messageType = conversationData.userPrompt ? 'Prompt' : 'Tool';
    const messageNum = conversationData.messageNumber.toString().padStart(3, '0');
    const toolName = toolRecord.tool_name;
    const fileName = toolRecord.file_path ? path.basename(toolRecord.file_path) : '';
    
    let message = `${messageType} ${messageNum}: ${toolName}`;
    if (fileName) {
      message += ` | ${fileName}`;
    }
    
    // Add conversation context in commit body
    message += `\\n\\n===== CONVERSATION CONTEXT =====`;
    
    if (conversationData.userPrompt) {
      message += `\\nUser: "${conversationData.userPrompt}"`;
    }
    
    if (conversationData.claudeResponse) {
      message += `\\nClaude: ${conversationData.claudeResponse}`;
    }
    
    message += `\\n\\n===== TOOL EXECUTION =====`;
    message += `\\nTool: ${toolName}`;
    message += `\\nTime: ${new Date(toolRecord.timestamp).toLocaleTimeString()}`;
    message += `\\nSession: ${toolRecord.session_id?.substring(0, 8)}`;
    
    if (fileName) {
      message += `\\nFile: ${fileName}`;
    }
    
    return message;
  }

  async runGitCommand(cwd, args, allowFailure = false) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd });
      let output = '';
      let error = '';
      
      git.stdout.on('data', data => output += data.toString());
      git.stderr.on('data', data => error += data.toString());
      
      git.on('close', code => {
        if (code !== 0 && !allowFailure) {
          reject(new Error(`Git command failed: ${error || output}`));
        } else {
          resolve(output.trim());
        }
      });
    });
  }
}

// Rapala execution pattern
if (require.main === module) {
  const archiver = new SessionConversationArchiver();
  
  let input = '';
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', async () => {
    try {
      const toolRecord = JSON.parse(input);
      const result = await archiver.execute(toolRecord);
      console.log(result);
    } catch (error) {
      console.error('');
      process.exit(1);
    }
  });
}

module.exports = SessionConversationArchiver;