#!/usr/bin/env node

// Standalone transcript parser debugger
const fs = require('fs');

async function debugTranscriptParsing() {
  const transcriptPath = '/home/alejandro/.claude/projects/-home-alejandro-Code-MCP-Hooks-Git-rins-hooks/95b222d7-d392-4e22-a55a-9caaee33673d.jsonl';
  
  console.log('=== TRANSCRIPT PARSING DEBUG ===');
  console.log(`Reading: ${transcriptPath}`);
  
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    console.log(`Total lines: ${lines.length}`);
    
    // Look at last 20 entries
    const recentLines = lines.slice(-20);
    console.log(`\n=== LAST 20 ENTRIES ===`);
    
    let userMessages = [];
    let assistantMessages = [];
    
    recentLines.forEach((line, index) => {
      try {
        const entry = JSON.parse(line);
        const entryNumber = lines.length - 20 + index;
        
        console.log(`\nEntry ${entryNumber}:`);
        console.log(`  Type: ${entry.type}`);
        console.log(`  Has message: ${!!entry.message}`);
        
        if (entry.type === 'user' && entry.message) {
          console.log(`  Message role: ${entry.message.role}`);
          console.log(`  Content type: ${typeof entry.message.content}`);
          
          let userText = '';
          if (typeof entry.message.content === 'string') {
            userText = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            userText = entry.message.content
              .filter(item => item.type === 'text')
              .map(item => item.text)
              .join(' ');
          }
          
          if (userText) {
            console.log(`  USER TEXT: ${userText.substring(0, 100)}...`);
            userMessages.push({ entry: entryNumber, text: userText });
          }
        }
        
        if (entry.type === 'assistant' && entry.message) {
          console.log(`  Message role: ${entry.message.role}`);
          console.log(`  Content type: ${typeof entry.message.content}`);
          
          let assistantText = '';
          if (Array.isArray(entry.message.content)) {
            assistantText = entry.message.content
              .filter(item => item.type === 'text')
              .map(item => item.text)
              .join(' ');
          }
          
          if (assistantText) {
            console.log(`  ASSISTANT TEXT: ${assistantText.substring(0, 100)}...`);
            assistantMessages.push({ entry: entryNumber, text: assistantText });
          }
        }
        
      } catch (error) {
        console.log(`  ERROR parsing line: ${error.message}`);
      }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`User messages found: ${userMessages.length}`);
    console.log(`Assistant messages found: ${assistantMessages.length}`);
    
    if (userMessages.length > 0) {
      const latest = userMessages[userMessages.length - 1];
      console.log(`\nLatest user message (entry ${latest.entry}):`);
      console.log(latest.text);
    }
    
    if (assistantMessages.length > 0) {
      const latest = assistantMessages[assistantMessages.length - 1];
      console.log(`\nLatest assistant message (entry ${latest.entry}):`);
      console.log(latest.text.substring(0, 500));
    }
    
    // Search for 444clover
    console.log(`\n=== SEARCHING FOR 444CLOVER ===`);
    const cloverLines = lines.filter((line, index) => {
      return line.includes('444clover');
    });
    
    console.log(`Found ${cloverLines.length} lines with 444clover`);
    cloverLines.forEach((line, index) => {
      try {
        const entry = JSON.parse(line);
        console.log(`\nClover entry ${index + 1}:`);
        console.log(`  Type: ${entry.type}`);
        if (entry.message && entry.message.content) {
          console.log(`  Content: ${JSON.stringify(entry.message.content).substring(0, 200)}`);
        }
      } catch (e) {
        console.log(`  Parse error: ${e.message}`);
      }
    });
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

debugTranscriptParsing();