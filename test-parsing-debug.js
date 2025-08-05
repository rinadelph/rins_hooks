#!/usr/bin/env node

const fs = require('fs').promises;

async function testParsing() {
  const transcriptPath = '/home/alejandro/.claude/projects/-home-alejandro-Code-MCP-Hooks-Git-rins-hooks/95b222d7-d392-4e22-a55a-9caaee33673d.jsonl';
  
  try {
    const data = await fs.readFile(transcriptPath, 'utf8');
    const lines = data.trim().split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    // Get the last 50 entries to find the most recent conversation pair  
    const recentLines = lines.slice(-50); // More lines for better context
    console.log(`Examining last ${recentLines.length} entries`);
    
    // Look for real user prompts (not hook messages) in reverse order
    let lastRealUserPrompt = '';
    let lastUserIndex = -1;
    
    for (let i = recentLines.length - 1; i >= 0; i--) {
      const line = recentLines[i];
      try {
        const entry = JSON.parse(line);
        console.log(`Entry ${i}: type=${entry.type}, has_message=${!!entry.message}`);
        
        // Handle user messages - Claude Code format
        if (entry.type === 'user' && entry.message) {
          let userText = '';
          
          if (typeof entry.message.content === 'string') {
            userText = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            // Extract text from content array
            const textParts = entry.message.content
              .filter(item => item.type === 'text')
              .map(item => item.text);
            userText = textParts.join(' ');
          } else if (typeof entry.message.content === 'object' && entry.message.content) {
            // Handle object format - might have nested text
            if (entry.message.content.text) {
              userText = entry.message.content.text;
            } else if (entry.message.content.content) {
              userText = entry.message.content.content;
            }
          }
          
          // Check if this is a real user prompt (not hook/system message)
          const isRealUserPrompt = userText && 
              !userText.includes('<user-prompt-submit-hook>') &&
              !userText.includes('tool_use_id') &&
              !userText.includes('<system-reminder>') &&
              !userText.includes('system-reminder') &&
              !userText.startsWith('[') &&
              userText.trim().length > 5; // More lenient length check
          
          console.log(`  User text: "${userText}"`);
          console.log(`  Is real user prompt: ${isRealUserPrompt}`);
          
          if (isRealUserPrompt && !lastRealUserPrompt) {
            lastRealUserPrompt = userText;
            lastUserIndex = i;
            console.log(`Found real user prompt at ${i}: ${userText}`);
            break;
          }
        }
      } catch (parseError) {
        console.error(`Failed to parse line ${i}: ${parseError.message}`);
      }
    }
    
    console.log(`\nFinal result: "${lastRealUserPrompt}"`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testParsing();