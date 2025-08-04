---
description: Generate Claude Code hook from natural language description and create it using the Rapala system
argument-hint: "description of hook behavior"
allowed-tools: Bash(node:*), Read, Write, Edit
---

🎣 **Rapala Hook Generator - Claude Instructions**

You are Claude Code with access to a sophisticated hook generation and management system. The user wants you to create a Claude Code hook from this description: "{{prompt}}"

## Your Task:
1. **Generate the hook** using the Rapala hook generator system
2. **Create the actual hook files** in the project
3. **Make it discoverable** through the Rapala management system
4. **Provide installation instructions**

## Available Tools & Context:

### Hook Generator System:
- **Location**: `/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/src/hook-generator.js`
- **Function**: Generates dynamic JavaScript hooks from natural language
- **Output**: Creates complete hook directory with index.js and config.json

### Hook Architecture:
- **Claude Code Hooks**: JavaScript files that intercept tool usage (PreToolUse, PostToolUse, etc.)
- **Dynamic Hooks**: Generated hooks that can execute other scripts/hooks
- **Rapala System**: Manages, installs, and discovers hooks

### Hook Events:
- **PreToolUse**: Runs BEFORE a tool executes (can block execution)
- **PostToolUse**: Runs AFTER a tool completes successfully  
- **Stop**: Runs when Claude Code finishes responding
- **UserPromptSubmit**: Runs when user submits input

### Tool Matchers:
- **Bash**: Matches bash commands
- **Edit|MultiEdit|Write**: Matches file editing operations
- **Read**: Matches file reading operations
- **All tools**: No matcher specified

## Step-by-Step Process:

1. **Run the hook generator** with the user's description
2. **Examine the generated hook** to understand its functionality
3. **Test if it's discoverable** in the Rapala system
4. **Provide the Claude Code JSON configuration** for manual installation
5. **Explain how the hook works** and what it will do

## Execute the Generation:
Use the hook generator system to create a dynamic hook from the user's description: "{{prompt}}"