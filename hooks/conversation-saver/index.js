#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function saveConversations() {
  try {
    const projectPath = process.cwd();
    const encodedPath = projectPath.replace(/\//g, '-');
    
    const claudeDir = path.join(process.env.HOME, '.claude', 'projects', encodedPath);
    const agentDir = path.join(projectPath, '.agent', 'conversations');
    
    // Create .agent/conversations directory
    await fs.mkdir(agentDir, { recursive: true });
    
    // Check if Claude conversations exist
    try {
      const files = await fs.readdir(claudeDir);
      const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
      
      console.log(`[ConversationSaver] Found ${jsonlFiles.length} conversation files`);
      
      // Copy each JSONL file
      for (const file of jsonlFiles) {
        const source = path.join(claudeDir, file);
        const target = path.join(agentDir, file);
        await fs.copyFile(source, target);
        console.log(`[ConversationSaver] Copied: ${file}`);
      }
      
      // Simple index file
      const index = {
        saved_at: new Date().toISOString(),
        project: projectPath,
        files: jsonlFiles.length
      };
      
      await fs.writeFile(
        path.join(agentDir, 'index.json'), 
        JSON.stringify(index, null, 2)
      );
      
      console.log(`[ConversationSaver] Saved ${jsonlFiles.length} conversations to .agent/conversations/`);
      
    } catch (error) {
      console.log(`[ConversationSaver] No Claude conversations found for this project`);
    }
    
  } catch (error) {
    console.error(`[ConversationSaver] Error:`, error.message);
  }
}

if (require.main === module) {
  saveConversations();
}

module.exports = { saveConversations };