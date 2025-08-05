#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

class ConversationSaver {
  constructor() {
    this.name = 'conversation-saver';
  }

  async execute() {
    try {
      const projectPath = process.cwd();
      const encodedPath = this.encodeProjectPath(projectPath);
      
      await this.saveConversations(projectPath, encodedPath);
      
      return { success: true, message: 'Conversations archived to .agent' };
    } catch (error) {
      console.error('[ConversationSaver] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  encodeProjectPath(projectPath) {
    // Match Claude's encoding: /home/user/project -> -home-user-project
    return projectPath.replace(/\//g, '-');
  }

  async saveConversations(projectPath, encodedPath) {
    const claudeProjectsDir = path.join(process.env.HOME, '.claude', 'projects', encodedPath);
    const agentDir = path.join(projectPath, '.agent', 'conversations');
    
    try {
      // Create .agent/conversations directory
      await fs.mkdir(agentDir, { recursive: true });
      
      // Check if Claude conversation directory exists
      try {
        await fs.access(claudeProjectsDir);
      } catch {
        console.error(`[ConversationSaver] No Claude conversations found for this project`);
        return;
      }

      // Get all JSONL files
      const files = await fs.readdir(claudeProjectsDir);
      const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        console.error(`[ConversationSaver] No conversation files to archive`);
        return;
      }

      console.error(`[ConversationSaver] Copying ${jsonlFiles.length} conversation files...`);
      
      // Simple copy operation - no modification of originals
      for (const file of jsonlFiles) {
        const sourcePath = path.join(claudeProjectsDir, file);
        const targetPath = path.join(agentDir, file);
        
        try {
          await fs.copyFile(sourcePath, targetPath);
          console.error(`[ConversationSaver] Copied: ${file}`);
        } catch (error) {
          console.error(`[ConversationSaver] Failed to copy ${file}:`, error.message);
        }
      }
      
      // Create simple index file
      const indexData = {
        project_path: projectPath,
        claude_source: claudeProjectsDir,
        archived_at: new Date().toISOString(),
        file_count: jsonlFiles.length,
        files: jsonlFiles
      };
      
      await fs.writeFile(
        path.join(agentDir, 'index.json'), 
        JSON.stringify(indexData, null, 2)
      );
      
      console.error(`[ConversationSaver] Archive complete: ${jsonlFiles.length} files saved to .agent/conversations`);
      
    } catch (error) {
      console.error(`[ConversationSaver] Archive error:`, error.message);
    }
  }
}

// Command-line execution
if (require.main === module) {
  const saver = new ConversationSaver();
  
  saver.execute()
    .then(result => {
      if (result.success) {
        console.error(`[ConversationSaver] ${result.message}`);
      } else {
        console.error(`[ConversationSaver] Failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(`[ConversationSaver] Execution error:`, error.message);
      process.exit(1);
    });
}

module.exports = ConversationSaver;