#!/usr/bin/env node

/**
 * Intelligent Git Agent - Rapala Managed
 * Integrates conversation intelligence directly into main repo git commits
 * 
 * This replaces separate worktree chaos with intelligent main repo commits
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class IntelligentGitManager {
  constructor() {
    this.debugLog = '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/git-agent-debug.log';
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${message}\n`;
    require('fs').appendFileSync(this.debugLog, logMsg);
  }

  async execute(toolRecord) {
    try {
      this.log(`=== INTELLIGENT GIT AGENT START ===`);
      this.log(`Tool: ${toolRecord.tool_name}, File: ${toolRecord.file_path || 'N/A'}`);
      
      // Get conversation context using the working conversation archiver logic
      const conversationContext = await this.getConversationContext(toolRecord.transcript_path);
      this.log(`User Intent: "${conversationContext.userPrompt}"`);
      
      // Analyze what actually changed in the repo
      const repoAnalysis = await this.analyzeRepositoryChanges(toolRecord);
      this.log(`Changes: ${repoAnalysis.changeType} - ${repoAnalysis.summary}`);
      
      // Only commit meaningful main repo changes (not archiver files or debug logs)
      if (this.shouldCommitToMainRepo(toolRecord, repoAnalysis)) {
        await this.createIntelligentMainRepoCommit(toolRecord, conversationContext, repoAnalysis);
        this.log(`✅ Created intelligent main repo commit`);
      } else {
        this.log(`⏭️  Skipped - archiver activity or no meaningful changes`);
      }
      
      this.log(`=== INTELLIGENT GIT AGENT COMPLETE ===\n`);
      return '';
    } catch (error) {
      this.log(`❌ Error: ${error.message}`);
      return '';
    }
  }

  async getConversationContext(transcriptPath) {
    try {
      if (!transcriptPath) return { userPrompt: '', claudeResponse: '' };
      
      const data = await fs.readFile(transcriptPath, 'utf8');
      const lines = data.trim().split('\n');
      const recentLines = lines.slice(-150);
      
      // Use the same robust parsing logic as conversation archiver
      for (let i = recentLines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(recentLines[i]);
          if (entry.type === 'user' && entry.message) {
            let userText = '';
            
            // Handle string content (most common)
            if (typeof entry.message.content === 'string') {
              userText = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
              const textParts = entry.message.content
                .filter(item => item.type === 'text')
                .map(item => item.text);
              userText = textParts.join(' ');
            }
            
            // Skip hook/system messages, find real user intent
            if (userText && 
                !userText.includes('<user-prompt-submit-hook>') &&
                !userText.includes('tool_use_id') &&
                !userText.includes('<system-reminder>') &&
                userText.trim().length > 5) {
              
              // Find corresponding Claude response
              const claudeResponse = await this.findClaudeResponse(recentLines, i);
              return { 
                userPrompt: userText.length > 150 ? userText.substring(0, 150) + '...' : userText,
                claudeResponse: claudeResponse.length > 200 ? claudeResponse.substring(0, 200) + '...' : claudeResponse
              };
            }
          }
        } catch (parseError) {
          continue;
        }
      }
      
      return { userPrompt: '', claudeResponse: '' };
    } catch (error) {
      this.log(`Error getting conversation context: ${error.message}`);
      return { userPrompt: '', claudeResponse: '' };
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

  async analyzeRepositoryChanges(toolRecord) {
    try {
      const workingDir = toolRecord.working_directory || '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks';
      
      // Get git status
      const status = execSync('git status --porcelain', { 
        cwd: workingDir,
        encoding: 'utf8' 
      }).trim();
      
      let changeType = 'chore';
      let summary = 'Update files';
      
      if (toolRecord.file_path) {
        const fileName = path.basename(toolRecord.file_path);
        const fileDir = path.dirname(toolRecord.file_path);
        
        // Intelligent change type detection
        if (fileName.includes('test') || fileName.includes('debug')) {
          changeType = 'test';
          summary = `Update ${fileName}`;
        } else if (fileDir.includes('hooks') && fileName.endsWith('.js')) {
          changeType = 'feat';
          summary = `Enhance ${fileName.replace('.js', '')} hook`;
        } else if (fileName.endsWith('.md')) {
          changeType = 'docs';
          summary = `Update ${fileName}`;
        } else if (fileName.endsWith('.json')) {
          changeType = 'config';
          summary = `Update ${fileName}`;
        } else if (toolRecord.tool_name === 'Write') {
          changeType = 'feat';
          summary = `Add ${fileName}`;
        } else if (toolRecord.tool_name === 'Edit') {
          changeType = 'refactor';
          summary = `Refactor ${fileName}`;
        } else if (toolRecord.tool_name === 'MultiEdit') {
          changeType = 'refactor';
          summary = `Refactor ${fileName}`;
        }
      }
      
      return {
        status,
        changeType,
        summary,
        hasChanges: status.length > 0
      };
      
    } catch (error) {
      this.log(`Error analyzing repo: ${error.message}`);
      return {
        status: '',
        changeType: 'chore',
        summary: 'Update files',
        hasChanges: false
      };
    }
  }

  shouldCommitToMainRepo(toolRecord, repoAnalysis) {
    // Skip if no actual repository changes
    if (!repoAnalysis.hasChanges) return false;
    
    // Skip conversation archiver activities (they create their own commits in worktrees)
    if (toolRecord.file_path && toolRecord.file_path.includes('/prompt-')) return false;
    
    // Skip debug/log files that don't need main repo commits
    if (toolRecord.file_path && (
        toolRecord.file_path.includes('.log') ||
        toolRecord.file_path.includes('-debug') ||
        toolRecord.file_path.includes('test-') ||
        toolRecord.file_path.includes('archiver-debug')
    )) return false;
    
    return true;
  }

  async createIntelligentMainRepoCommit(toolRecord, conversationContext, repoAnalysis) {
    try {
      const workingDir = toolRecord.working_directory || '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks';
      
      // Stage changes in main repo
      execSync('git add .', { cwd: workingDir });
      this.log(`Staged main repo changes in ${workingDir}`);
      
      // Generate intelligent commit message with conversation context
      const commitMessage = this.generateIntelligentCommitMessage(
        toolRecord, 
        conversationContext, 
        repoAnalysis
      );
      
      // Commit to main repo with conversation intelligence
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\\\"')}"`, { 
        cwd: workingDir 
      });
      
      this.log(`🎉 Main repo commit: ${repoAnalysis.changeType}: ${repoAnalysis.summary}`);
      
    } catch (error) {
      // Don't fail if nothing to commit
      if (error.message.includes('nothing to commit')) {
        this.log(`Nothing to commit - working tree clean`);
        return;
      }
      throw error;
    }
  }

  generateIntelligentCommitMessage(toolRecord, conversationContext, repoAnalysis) {
    const fileName = toolRecord.file_path ? path.basename(toolRecord.file_path) : '';
    
    let message = `${repoAnalysis.changeType}: ${repoAnalysis.summary}`;
    
    // Add conversation context to give commits meaning
    if (conversationContext.userPrompt) {
      message += `\\n\\nUser Request: "${conversationContext.userPrompt}"`;
    }
    
    if (conversationContext.claudeResponse) {
      message += `\\nImplementation: ${conversationContext.claudeResponse}`;
    }
    
    // Add technical metadata
    message += `\\n\\nTechnical Details:`;
    message += `\\n- Tool: ${toolRecord.tool_name}`;
    if (fileName) {
      message += `\\n- File: ${fileName}`;
    }
    message += `\\n- Session: ${toolRecord.session_id?.substring(0, 8)}`;
    message += `\\n- Timestamp: ${new Date(toolRecord.timestamp).toLocaleString()}`;
    
    // Mark as AI-assisted
    message += `\\n\\nCo-authored-by: Claude <claude@anthropic.com>`;
    
    return message;
  }
}

// Rapala execution pattern
if (require.main === module) {
  const manager = new IntelligentGitManager();
  
  // Parse input from Rapala
  let input = '';
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', async () => {
    try {
      const toolRecord = JSON.parse(input);
      const result = await manager.execute(toolRecord);
      console.log(result);
    } catch (error) {
      console.error('');
      process.exit(1);
    }
  });
}

module.exports = IntelligentGitManager;