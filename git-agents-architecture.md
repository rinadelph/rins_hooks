# Intelligent Git Agents Architecture

## Core Principle: Git as Collaborative Intelligence System

Instead of separate conversation worktrees, integrate conversation context directly into main repo commits with specialized agents.

## Git Agent Types:

### 1. **Commit Intelligence Agent** (Main Agent)
- **Purpose**: Enhance main repo commits with conversation context
- **Trigger**: PreCommit + PostToolUse  
- **Function**: 
  - Stage actual code changes in main repo
  - Generate intelligent commit messages with embedded conversation context
  - Create structured commits: `feat: Add conversation archiver\n\nUser Request: "Fix it"\nContext: Enhanced transcript parsing for robust conversation capture`

### 2. **Conversation Context Agent**
- **Purpose**: Extract and format conversation data for commits
- **Function**: Parse transcript, extract relevant user prompts/Claude responses
- **Integration**: Feeds data to Commit Intelligence Agent

### 3. **Repository State Agent** 
- **Purpose**: Analyze repo changes and suggest commit strategies
- **Function**: 
  - Detect file changes, new features, bug fixes
  - Recommend commit types (feat, fix, refactor, docs)
  - Group related changes intelligently

### 4. **Git History Agent**
- **Purpose**: Maintain conversation history in structured way
- **Function**: 
  - Single conversation branch alongside main development
  - Conversation commits linked to code commits via references
  - No worktree explosion - just organized branching

## New Workflow:

```
1. User makes request → Code changes happen
2. Commit Intelligence Agent triggers on tool completion
3. Conversation Context Agent extracts user intent + Claude response  
4. Repository State Agent analyzes what changed
5. Generate intelligent commit in MAIN repo:
   - Proper git staging (git add)
   - Enhanced commit message with conversation context
   - Link to conversation branch for full context
6. Optional: Mirror to conversation branch for full transcript
```

## Example Enhanced Commit:

```
feat: Implement robust conversation archiver with transcript parsing

User Request: "Fix it" 
Claude Response: Enhanced transcript parsing logic to handle string/array/object content formats
Files Changed: hooks/conversation-archiver/index.js
Key Changes:
- Added string content handling for user messages  
- Enhanced search range to 150 entries
- Improved error logging and debugging
- Fixed parameter passing in commit message generation

Conversation Context: User wanted to fix conversation data capture issues
Technical Solution: Implemented multi-format transcript parsing with comprehensive debugging

Co-authored-by: Claude <claude@anthropic.com>
```

This integrates conversation intelligence directly into normal git workflow while maintaining clean repo structure.