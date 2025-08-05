#!/usr/bin/env node

/**
 * Intelligent Git Manager Hook
 * Advanced git management with repository state awareness and smart commit strategies
 * 
 * Features:
 * - Repository state analysis
 * - Smart commit strategies (single, batch, skip)
 * - Conflict prevention and detection
 * - User intent detection
 * - Graceful error handling with recovery suggestions
 */

const HookBase = require('../../src/hook-base');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class IntelligentGitManager extends HookBase {
  constructor() {
    super('intelligent-git-manager', {
      description: 'Advanced git management with repository state awareness',
      matcher: 'Edit|Write|MultiEdit',
      timeout: 30
    });
    
    this.thresholds = {
      maxUnstagedFiles: 15,
      maxCommitsAhead: 50,
      batchCommitMinFiles: 3,
      complexStateSkipThreshold: 25
    };
  }

  async execute(input) {
    try {
      const { tool_name, tool_input } = input;
      
      // Only process file editing tools
      if (!['Edit', 'Write', 'MultiEdit'].includes(tool_name)) {
        return this.success({ message: 'Tool not applicable for git management' });
      }

      const filePath = this.extractFilePath(tool_input);
      if (!filePath) {
        return this.success({ message: 'No file path detected' });
      }

      // Check if we're in a git repository
      if (!this.isGitRepository()) {
        return this.success({ message: 'Not a git repository' });
      }

      // Analyze repository state
      const repoState = await this.analyzeRepositoryState();
      console.log(`🔍 Repository State Analysis:`);
      console.log(`  Status: ${repoState.status}`);
      console.log(`  Unstaged files: ${repoState.unstagedFiles.length}`);
      console.log(`  Commits ahead: ${repoState.commitsAhead}`);
      console.log(`  Recommendation: ${repoState.recommendation}`);

      // Determine strategy based on repository state
      const strategy = this.determineStrategy(repoState, filePath);
      console.log(`🎯 Strategy: ${strategy.action} - ${strategy.reason}`);

      // Execute the chosen strategy
      const result = await this.executeStrategy(strategy, filePath, tool_name, input);
      
      return this.success({
        message: result.message,
        strategy: strategy.action,
        repositoryState: repoState.status,
        details: result.details || {}
      });

    } catch (error) {
      console.error('❌ Intelligent Git Manager Error:', error.message);
      return this.error(`Git management failed: ${error.message}`);
    }
  }

  /**
   * Analyze the current repository state
   */
  async analyzeRepositoryState() {
    try {
      const status = {
        isClean: false,
        unstagedFiles: [],
        stagedFiles: [],
        commitsAhead: 0,
        commitsBehind: 0,
        currentBranch: '',
        hasConflicts: false,
        inMerge: false,
        inRebase: false,
        recommendation: ''
      };

      // Get current branch
      try {
        status.currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      } catch (e) {
        status.currentBranch = 'unknown';
      }

      // Check for special git states
      const gitDir = path.join(process.cwd(), '.git');
      status.inMerge = fs.existsSync(path.join(gitDir, 'MERGE_HEAD'));
      status.inRebase = fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'));

      // Get file status
      const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
      const lines = statusOutput.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const status_char = line.substring(0, 2);
        const fileName = line.substring(3);
        
        if (status_char.includes('M') && status_char[1] === 'M') {
          // Modified in both index and working tree
          status.stagedFiles.push(fileName);
          status.unstagedFiles.push(fileName);
        } else if (status_char[0] !== ' ' && status_char[0] !== '?') {
          // Staged changes
          status.stagedFiles.push(fileName);
        } else if (status_char[1] !== ' ') {
          // Unstaged changes
          status.unstagedFiles.push(fileName);
        }
        
        // Check for conflicts
        if (status_char.includes('U') || line.includes('both modified')) {
          status.hasConflicts = true;
        }
      }

      // Check ahead/behind status
      try {
        const trackingBranch = execSync(`git rev-parse --abbrev-ref ${status.currentBranch}@{upstream}`, { encoding: 'utf8' }).trim();
        const aheadBehind = execSync(`git rev-list --left-right --count ${trackingBranch}...HEAD`, { encoding: 'utf8' }).trim();
        const [behind, ahead] = aheadBehind.split('\t').map(Number);
        status.commitsBehind = behind;
        status.commitsAhead = ahead;
      } catch (e) {
        // No upstream or other issue - not necessarily an error
        status.commitsAhead = 0;
        status.commitsBehind = 0;
      }

      status.isClean = status.unstagedFiles.length === 0 && status.stagedFiles.length === 0;

      // Generate recommendation
      status.recommendation = this.generateRecommendation(status);
      status.status = this.summarizeStatus(status);

      return status;
    } catch (error) {
      throw new Error(`Repository analysis failed: ${error.message}`);
    }
  }

  /**
   * Generate human-readable recommendation
   */
  generateRecommendation(status) {
    if (status.hasConflicts) return 'Resolve conflicts first';
    if (status.inMerge) return 'Complete merge operation first';
    if (status.inRebase) return 'Complete rebase operation first';
    if (status.commitsAhead > this.thresholds.maxCommitsAhead) return 'Consider pushing commits to remote';
    if (status.unstagedFiles.length > this.thresholds.complexStateSkipThreshold) return 'Too many changes - manual review recommended';
    if (status.unstagedFiles.length > this.thresholds.batchCommitMinFiles) return 'Batch commit recommended';
    if (status.unstagedFiles.length > 0) return 'Individual file commit suitable';
    return 'Repository is clean';
  }

  /**
   * Summarize repository status
   */
  summarizeStatus(status) {
    if (status.hasConflicts) return 'CONFLICTS';
    if (status.inMerge) return 'MERGING';
    if (status.inRebase) return 'REBASING';
    if (status.unstagedFiles.length > this.thresholds.complexStateSkipThreshold) return 'COMPLEX';
    if (status.commitsAhead > this.thresholds.maxCommitsAhead) return 'AHEAD';
    if (status.unstagedFiles.length > this.thresholds.batchCommitMinFiles) return 'BATCH_READY';
    if (status.unstagedFiles.length > 0) return 'DIRTY';
    return 'CLEAN';
  }

  /**
   * Determine the best strategy based on repository state
   */
  determineStrategy(repoState, filePath) {
    // Blocking conditions - never auto-commit
    if (repoState.hasConflicts) {
      return { action: 'SKIP', reason: 'Repository has merge conflicts' };
    }
    
    if (repoState.inMerge || repoState.inRebase) {
      return { action: 'SKIP', reason: 'Repository is in merge/rebase state' };
    }

    if (repoState.unstagedFiles.length > this.thresholds.complexStateSkipThreshold) {
      return { action: 'SKIP', reason: `Too many changes (${repoState.unstagedFiles.length}) - manual review needed` };
    }

    // Check if the specific file should be excluded
    if (this.shouldExcludeFile(filePath)) {
      return { action: 'SKIP', reason: 'File matches exclusion patterns' };
    }

    // Warning conditions - proceed with caution
    if (repoState.commitsAhead > this.thresholds.maxCommitsAhead) {
      return { action: 'SINGLE_COMMIT', reason: `Branch is ${repoState.commitsAhead} commits ahead - single commit only` };
    }

    // Optimal conditions - choose best strategy
    if (repoState.unstagedFiles.length >= this.thresholds.batchCommitMinFiles) {
      // Check if most changes are related to current edit
      const relatedFiles = this.findRelatedFiles(filePath, repoState.unstagedFiles);
      if (relatedFiles.length >= 2) {
        return { action: 'BATCH_COMMIT', reason: `Found ${relatedFiles.length} related files` };
      }
    }

    // Default to single file commit
    return { action: 'SINGLE_COMMIT', reason: 'Standard single file commit' };
  }

  /**
   * Find files related to the current edit
   */
  findRelatedFiles(currentFile, allFiles) {
    const currentDir = path.dirname(currentFile);
    const currentExt = path.extname(currentFile);
    const currentBase = path.basename(currentFile, currentExt);
    
    return allFiles.filter(file => {
      // Same directory
      if (path.dirname(file) === currentDir) return true;
      
      // Same extension and similar name
      if (path.extname(file) === currentExt && 
          path.basename(file, path.extname(file)).includes(currentBase)) return true;
      
      // Configuration files that often go together
      const configFiles = ['.json', '.yml', '.yaml', '.toml', '.ini'];
      if (configFiles.includes(currentExt) && configFiles.includes(path.extname(file))) return true;
      
      return false;
    });
  }

  /**
   * Execute the chosen strategy
   */
  async executeStrategy(strategy, filePath, toolName, input) {
    switch (strategy.action) {
      case 'SKIP':
        return {
          message: `Git commit skipped: ${strategy.reason}`,
          details: { skipped: true, reason: strategy.reason }
        };

      case 'SINGLE_COMMIT':
        return await this.executeSingleCommit(filePath, toolName, input);

      case 'BATCH_COMMIT':
        return await this.executeBatchCommit(filePath, toolName, input);

      default:
        throw new Error(`Unknown strategy: ${strategy.action}`);
    }
  }

  /**
   * Execute single file commit
   */
  async executeSingleCommit(filePath, toolName, input) {
    try {
      // Check if file has actual changes
      const relativePath = path.relative(process.cwd(), filePath);
      const diffOutput = execSync(`git diff -- "${relativePath}"`, { encoding: 'utf8' });
      
      if (!diffOutput.trim()) {
        return {
          message: `No changes detected in ${path.basename(filePath)}`,
          details: { committed: false, reason: 'no_changes' }
        };
      }

      // Stage and commit the file
      execSync(`git add "${filePath}"`);
      const commitMessage = this.generateCommitMessage(toolName, filePath, input);
      execSync(`git commit -m "${commitMessage}"`);
      
      const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      
      return {
        message: `Successfully committed ${path.basename(filePath)}`,
        details: { 
          committed: true, 
          commitHash: commitHash.substring(0, 8),
          filesCommitted: 1 
        }
      };
    } catch (error) {
      throw new Error(`Single commit failed: ${error.message}`);
    }
  }

  /**
   * Execute batch commit for related files
   */
  async executeBatchCommit(filePath, toolName, input) {
    try {
      const repoState = await this.analyzeRepositoryState();
      const relatedFiles = this.findRelatedFiles(filePath, repoState.unstagedFiles);
      
      // Add all related files
      const filesToCommit = [filePath, ...relatedFiles.slice(0, 5)]; // Limit to 5 files max
      
      for (const file of filesToCommit) {
        try {
          execSync(`git add "${file}"`);
        } catch (e) {
          // Skip files that can't be added
          console.log(`⚠️ Skipped ${file}: ${e.message}`);
        }
      }

      const commitMessage = this.generateBatchCommitMessage(toolName, filesToCommit, input);
      execSync(`git commit -m "${commitMessage}"`);
      
      const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      
      return {
        message: `Successfully batch committed ${filesToCommit.length} related files`,
        details: { 
          committed: true, 
          commitHash: commitHash.substring(0, 8),
          filesCommitted: filesToCommit.length,
          primaryFile: path.basename(filePath)
        }
      };
    } catch (error) {
      // Fallback to single commit
      console.log(`⚠️ Batch commit failed, falling back to single commit: ${error.message}`);
      return await this.executeSingleCommit(filePath, toolName, input);
    }
  }

  /**
   * Generate commit message for single file
   */
  generateCommitMessage(toolName, filePath, input) {
    const action = this.getCommitAction(toolName);
    const fileName = path.basename(filePath);
    const sessionId = input.session_id || `pid-${process.pid}`;
    
    return `${action}: ${toolName} modified ${fileName}

Session: ${sessionId}
Tool: ${toolName}
File: ${path.relative(process.cwd(), filePath)}
Timestamp: ${new Date().toISOString()}

# Auto-committed by Intelligent Git Manager`;
  }

  /**
   * Generate commit message for batch commit
   */
  generateBatchCommitMessage(toolName, files, input) {
    const action = this.getCommitAction(toolName);
    const primaryFile = path.basename(files[0]);
    const sessionId = input.session_id || `pid-${process.pid}`;
    
    let message = `${action}: ${toolName} batch update (${files.length} files)

Primary: ${primaryFile}
Session: ${sessionId}
Tool: ${toolName}

Files modified:`;

    files.slice(0, 5).forEach(file => {
      message += `\n- ${path.relative(process.cwd(), file)}`;
    });

    if (files.length > 5) {
      message += `\n... and ${files.length - 5} more files`;
    }

    message += `\n\nTimestamp: ${new Date().toISOString()}
# Auto-committed by Intelligent Git Manager (Batch)`;

    return message;
  }

  /**
   * Get appropriate commit action prefix
   */
  getCommitAction(toolName) {
    switch (toolName) {
      case 'Write': return 'feat';
      case 'Edit': return 'refactor';
      case 'MultiEdit': return 'refactor';
      default: return 'chore';
    }
  }

  /**
   * Extract file path from tool input
   */
  extractFilePath(toolInput) {
    return toolInput.file_path || 
           toolInput.filePath || 
           (toolInput.edits && toolInput.edits[0] && toolInput.edits[0].file_path) || 
           null;
  }

  /**
   * Check if we're in a git repository
   */
  isGitRepository() {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file should be excluded from auto-commit
   */
  shouldExcludeFile(filePath) {
    const excludePatterns = [
      /\.log$/,
      /\.tmp$/,
      /\.temp$/,
      /\.lock$/,
      /\.env$/,
      /\.git\//,
      /\.agent\//,
      /node_modules\//,
      /\.pyc$/,
      /__pycache__\//,
      /\.DS_Store$/,
      /Thumbs\.db$/
    ];

    const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    
    // Don't commit files outside the repository
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      return true;
    }

    return excludePatterns.some(pattern => pattern.test(normalizedPath));
  }
}

// Main execution logic
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const gitManager = new IntelligentGitManager();
      const result = await gitManager.execute(input);
      HookBase.outputResult(result);
    } catch (e) {
      HookBase.outputResult({
        success: false,
        error: `IntelligentGitManager execution failed: ${e.message}`,
        hook: 'intelligent-git-manager'
      });
    }
  })();
}

module.exports = IntelligentGitManager;