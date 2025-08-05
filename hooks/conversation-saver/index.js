#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ConversationSaver {
    constructor() {
        this.projectRoot = process.cwd();
        this.agentDir = path.join(this.projectRoot, '.agent');
        this.conversationsDir = path.join(this.agentDir, 'conversations');
        this.registryPath = path.join(this.agentDir, 'registry.json');
        this.claudeProjectsDir = path.join(process.env.HOME, '.claude', 'projects');
        
        // Ensure conversations directory exists
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.conversationsDir)) {
            fs.mkdirSync(this.conversationsDir, { recursive: true });
        }
        
        // Create subdirectories for organization
        const subDirs = ['active', 'archived', 'metadata'];
        subDirs.forEach(dir => {
            const fullPath = path.join(this.conversationsDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    encodeProjectPath(projectPath) {
        return projectPath.replace(/\//g, '-');
    }

    getCurrentSessionInfo() {
        try {
            const registry = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
            const sessions = Object.values(registry.sessions || {});
            
            // Find most recent session for this project
            const currentSession = sessions
                .filter(s => s.working_directory === this.projectRoot)
                .sort((a, b) => b.last_activity - a.last_activity)[0];
                
            return currentSession;
        } catch (error) {
            console.log(`[ConversationSaver] Could not read registry: ${error.message}`);
            return null;
        }
    }

    findConversationFiles(sessionId) {
        const encodedPath = this.encodeProjectPath(this.projectRoot);
        const projectConversationsDir = path.join(this.claudeProjectsDir, encodedPath);
        
        if (!fs.existsSync(projectConversationsDir)) {
            console.log(`[ConversationSaver] No conversations directory found: ${projectConversationsDir}`);
            return [];
        }

        const files = fs.readdirSync(projectConversationsDir);
        const conversationFiles = [];

        // Find all JSONL files (both summary and full conversations)
        files.forEach(file => {
            if (file.endsWith('.jsonl')) {
                const filePath = path.join(projectConversationsDir, file);
                const stat = fs.statSync(filePath);
                
                conversationFiles.push({
                    filename: file,
                    path: filePath,
                    size: stat.size,
                    modified: stat.mtime,
                    type: stat.size > 10000 ? 'conversation' : 'summary'
                });
            }
        });

        return conversationFiles;
    }

    archiveConversation(file, sessionInfo) {
        const timestamp = new Date().toISOString();
        const archiveFilename = `${timestamp.split('T')[0]}_${file.filename}`;
        const archivePath = path.join(this.conversationsDir, 'archived', archiveFilename);
        
        // Copy conversation file
        fs.copyFileSync(file.path, archivePath);
        
        // Create metadata
        const metadata = {
            original_path: file.path,
            original_filename: file.filename,
            archived_at: timestamp,
            file_type: file.type,
            file_size: file.size,
            last_modified: file.modified,
            session_info: sessionInfo,
            project_path: this.projectRoot,
            archive_path: archivePath
        };
        
        const metadataPath = path.join(this.conversationsDir, 'metadata', `${archiveFilename}.meta.json`);
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        
        return { archivePath, metadataPath, metadata };
    }

    generateSummary(conversations) {
        const summary = {
            timestamp: new Date().toISOString(),
            project_path: this.projectRoot,
            total_conversations: conversations.length,
            total_size: conversations.reduce((sum, c) => sum + c.file_size, 0),
            file_types: {
                conversations: conversations.filter(c => c.file_type === 'conversation').length,
                summaries: conversations.filter(c => c.file_type === 'summary').length
            },
            archived_files: conversations.map(c => ({
                filename: c.original_filename,
                type: c.file_type,
                size: c.file_size
            }))
        };
        
        const summaryPath = path.join(this.conversationsDir, 'metadata', `archive_summary_${Date.now()}.json`);
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        return summaryPath;
    }

    logActivity(action, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: action,
            project_path: this.projectRoot,
            details: details
        };
        
        const activityLogPath = path.join(this.agentDir, 'session-activity', 'conversation-saver.jsonl');
        fs.appendFileSync(activityLogPath, JSON.stringify(logEntry) + '\n');
    }

    execute() {
        console.log('[ConversationSaver] Starting conversation archival...');
        
        try {
            // Get current session info
            const sessionInfo = this.getCurrentSessionInfo();
            if (!sessionInfo) {
                console.log('[ConversationSaver] No current session found');
                return;
            }
            
            // Find conversation files
            const conversationFiles = this.findConversationFiles(sessionInfo.session_id);
            if (conversationFiles.length === 0) {
                console.log('[ConversationSaver] No conversation files found');
                return;
            }
            
            console.log(`[ConversationSaver] Found ${conversationFiles.length} conversation files`);
            
            // Archive each conversation file
            const archivedConversations = [];
            conversationFiles.forEach(file => {
                console.log(`[ConversationSaver] Archiving ${file.filename} (${file.type}, ${file.size} bytes)`);
                const archived = this.archiveConversation(file, sessionInfo);
                archivedConversations.push(archived.metadata);
            });
            
            // Generate summary
            const summaryPath = this.generateSummary(archivedConversations);
            console.log(`[ConversationSaver] Archive summary created: ${summaryPath}`);
            
            // Log activity
            this.logActivity('conversation_archive', {
                session_id: sessionInfo.session_id,
                files_archived: conversationFiles.length,
                total_size: conversationFiles.reduce((sum, f) => sum + f.size, 0),
                summary_path: summaryPath
            });
            
            console.log(`[ConversationSaver] Successfully archived ${conversationFiles.length} conversation files`);
            
        } catch (error) {
            console.error(`[ConversationSaver] Error: ${error.message}`);
            this.logActivity('conversation_archive_error', {
                error: error.message,
                stack: error.stack
            });
        }
    }
}

// Execute if called directly
if (require.main === module) {
    const saver = new ConversationSaver();
    saver.execute();
}

module.exports = ConversationSaver;