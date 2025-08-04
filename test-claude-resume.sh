#!/bin/bash

# Test Claude Resume Functionality with Debug Capture
# This script comprehensively tests claude -r with full debug logging and terminal capture

set -euo pipefail

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="./test-logs"
SESSION_LOG="$LOG_DIR/claude-resume-test-$TIMESTAMP.log"
SCREEN_LOG="$LOG_DIR/claude-resume-screen-$TIMESTAMP.log"
DEBUG_LOG="$LOG_DIR/claude-resume-debug-$TIMESTAMP.log"
HOOKS_LOG="$LOG_DIR/claude-resume-hooks-$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Setup function
setup_logging() {
    echo -e "${BLUE}🔧 Setting up comprehensive Claude resume testing...${NC}"
    
    # Create logs directory
    mkdir -p "$LOG_DIR"
    
    # Initialize log files
    echo "=== Claude Resume Test Session - $TIMESTAMP ===" > "$SESSION_LOG"
    echo "=== Screen Capture Log - $TIMESTAMP ===" > "$SCREEN_LOG"
    echo "=== Debug Output Log - $TIMESTAMP ===" > "$DEBUG_LOG"
    echo "=== Hooks Activity Log - $TIMESTAMP ===" > "$HOOKS_LOG"
    
    echo -e "${GREEN}✅ Log files created:${NC}"
    echo "  📋 Session: $SESSION_LOG"
    echo "  🖥️  Screen:  $SCREEN_LOG"
    echo "  🐛 Debug:   $DEBUG_LOG"
    echo "  🎣 Hooks:   $HOOKS_LOG"
    echo
}

# Function to capture environment state
capture_environment() {
    echo -e "${YELLOW}📊 Capturing environment state...${NC}"
    
    {
        echo "=== ENVIRONMENT STATE ==="
        echo "Date: $(date)"
        echo "PWD: $(pwd)"
        echo "USER: $USER"
        echo "Shell: $SHELL"
        echo "Terminal: $TERM"
        echo
        
        echo "=== CLAUDE CODE STATUS ==="
        which claude || echo "Claude not found in PATH"
        claude --version 2>/dev/null || echo "Could not get Claude version"
        echo
        
        echo "=== GIT STATUS ==="
        git status --porcelain || echo "Not a git repository"
        echo
        
        echo "=== HOOK STATUS ==="
        ls -la .claude/ 2>/dev/null || echo "No .claude directory"
        echo
        
        echo "=== ACTIVE PROCESSES ==="
        pgrep -f claude || echo "No Claude processes running"
        echo
        
    } >> "$SESSION_LOG"
}

# Function to test claude -r with full capture
test_claude_resume() {
    echo -e "${BLUE}🚀 Starting Claude resume test with debug capture...${NC}"
    
    # Create a test prompt to resume from
    TEST_PROMPT="Test prompt for resume functionality - timestamp: $TIMESTAMP"
    
    echo -e "${YELLOW}📝 Creating test context...${NC}"
    {
        echo "=== TEST CONTEXT ==="
        echo "Test prompt: $TEST_PROMPT"
        echo "Starting claude -r --debug test..."
        echo "Timestamp: $(date)"
        echo
    } >> "$SESSION_LOG"
    
    # Method 1: Use script command to capture everything including screen control
    echo -e "${YELLOW}🎬 Method 1: Full terminal capture with 'script'${NC}"
    {
        echo "=== SCRIPT COMMAND CAPTURE ==="
        echo "Capturing all terminal activity including screen clears..."
        echo
    } >> "$SCREEN_LOG"
    
    # Test 1: Basic claude -r
    echo -e "${BLUE}Test 1: Basic claude -r${NC}"
    {
        echo "=== TEST 1: Basic claude -r ==="
        echo "Timestamp: $(date)"
        echo "Command: echo '$TEST_PROMPT' | claude -r"
        echo
        
        timeout 30s script -q -c "echo '$TEST_PROMPT' | claude -r 2>&1" "$SCREEN_LOG.script1" || {
            echo "Script command timed out or failed (exit code: $?)"
            echo "Attempting to capture any partial output..."
            cat "$SCREEN_LOG.script1" 2>/dev/null || echo "No script output captured"
        }
        
        echo "=== END TEST 1 ==="
        echo
    } | tee -a "$SESSION_LOG" "$DEBUG_LOG"
    
    # Test 2: claude -r --debug
    echo -e "${BLUE}Test 2: claude -r --debug${NC}"
    {
        echo "=== TEST 2: claude -r --debug ==="
        echo "Timestamp: $(date)"
        echo "Command: echo '$TEST_PROMPT' | claude -r --debug"
        echo
        
        timeout 60s script -q -c "echo '$TEST_PROMPT' | claude -r --debug 2>&1" "$SCREEN_LOG.script2" || {
            echo "Debug script command timed out or failed (exit code: $?)"
            echo "Attempting to capture any partial debug output..."
            cat "$SCREEN_LOG.script2" 2>/dev/null || echo "No debug script output captured"
        }
        
        echo "=== END TEST 2 ==="
        echo
    } | tee -a "$SESSION_LOG" "$DEBUG_LOG"
    
    # Method 2: Direct capture with tee for live monitoring
    echo -e "${YELLOW}🔍 Method 2: Direct capture with tee${NC}"
    
    # Test 3: Direct with debug and tee
    echo -e "${BLUE}Test 3: Direct capture with tee${NC}"
    {
        echo "=== TEST 3: DIRECT TEE CAPTURE ==="
        echo "Timestamp: $(date)"
        echo "Command: echo '$TEST_PROMPT' | claude -r --debug"
        echo
        
        timeout 60s sh -c "echo '$TEST_PROMPT' | claude -r --debug 2>&1" | tee -a "$DEBUG_LOG.tee" || {
            echo "Direct tee command failed or timed out (exit code: $?)"
            echo "Checking if any output was captured in tee file..."
            [ -f "$DEBUG_LOG.tee" ] && echo "Tee file size: $(wc -l < "$DEBUG_LOG.tee") lines" || echo "No tee file created"
        }
        echo
        echo "=== END TEST 3: DIRECT CAPTURE ==="
    } | tee -a "$SESSION_LOG" "$DEBUG_LOG"
    
    # Method 3: Background monitoring
    echo -e "${YELLOW}📡 Method 3: Background process monitoring${NC}"
    
    # Monitor hook activity during the test
    if [ -d ".agent/session-activity" ]; then
        echo "Monitoring hook activity..." >> "$HOOKS_LOG"
        ls -la .agent/session-activity/ >> "$HOOKS_LOG" 2>&1
        
        # Watch for new entries (run in background)
        {
            sleep 2
            echo "=== HOOK ACTIVITY DURING TEST ===" >> "$HOOKS_LOG"
            find .agent/session-activity/ -name "*.jsonl" -newer "$SESSION_LOG" 2>/dev/null | while read -r file; do
                echo "New activity in: $file" >> "$HOOKS_LOG"
                tail -5 "$file" >> "$HOOKS_LOG" 2>/dev/null || true
            done
        } &
        MONITOR_PID=$!
    fi
    
    # Test 4: Environment variable debugging
    echo -e "${BLUE}Test 4: With environment debugging${NC}"
    {
        echo "=== ENVIRONMENT DEBUG TEST ==="
        echo "Setting debug environment variables..."
        
        CLAUDE_DEBUG=1 CLAUDE_VERBOSE=1 timeout 45s sh -c "echo '$TEST_PROMPT' | claude -r --debug 2>&1" || {
            echo "Environment debug test failed or timed out"
        }
        echo
    } >> "$DEBUG_LOG" 2>&1
    
    # Clean up background monitoring
    if [ -n "${MONITOR_PID:-}" ]; then
        kill $MONITOR_PID 2>/dev/null || true
        wait $MONITOR_PID 2>/dev/null || true
    fi
}

# Function to analyze captured output
analyze_output() {
    echo -e "${YELLOW}🔍 Analyzing captured output...${NC}"
    
    ANALYSIS_LOG="$LOG_DIR/claude-resume-analysis-$TIMESTAMP.txt"
    
    {
        echo "=== CLAUDE RESUME TEST ANALYSIS ==="
        echo "Analysis timestamp: $(date)"
        echo
        
        echo "=== FILE SIZES ==="
        ls -lh "$LOG_DIR"/*"$TIMESTAMP"* 2>/dev/null || echo "No log files found"
        echo
        
        echo "=== SCRIPT CAPTURES ==="
        for script_file in "$LOG_DIR"/*.script*; do
            if [ -f "$script_file" ]; then
                echo "--- $script_file ---"
                wc -l "$script_file" 2>/dev/null || echo "Could not count lines"
                echo "First 10 lines:"
                head -10 "$script_file" 2>/dev/null || echo "Could not read file"
                echo "Last 10 lines:"
                tail -10 "$script_file" 2>/dev/null || echo "Could not read file"
                echo
            fi
        done
        
        echo "=== SEARCH FOR KEY PATTERNS ==="
        echo "Searching for hook executions..."
        grep -i "hook" "$LOG_DIR"/*"$TIMESTAMP"* 2>/dev/null || echo "No hook references found"
        echo
        
        echo "Searching for debug output..."
        grep -i "debug\|verbose" "$LOG_DIR"/*"$TIMESTAMP"* 2>/dev/null || echo "No debug output found"
        echo
        
        echo "Searching for errors..."
        grep -i "error\|fail\|exception" "$LOG_DIR"/*"$TIMESTAMP"* 2>/dev/null || echo "No errors found"
        echo
        
        echo "Searching for model information..."
        grep -i "model\|sonnet\|haiku\|opus" "$LOG_DIR"/*"$TIMESTAMP"* 2>/dev/null || echo "No model references found"
        echo
        
        echo "=== UNIQUE PATTERNS ==="
        echo "Unique first words of lines (showing patterns):"
        cat "$LOG_DIR"/*"$TIMESTAMP"* 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -nr | head -20 || echo "Could not analyze patterns"
        
    } > "$ANALYSIS_LOG"
    
    echo -e "${GREEN}📊 Analysis complete: $ANALYSIS_LOG${NC}"
}

# Function to create summary report
create_summary() {
    echo -e "${YELLOW}📄 Creating summary report...${NC}"
    
    SUMMARY_LOG="$LOG_DIR/claude-resume-summary-$TIMESTAMP.md"
    
    {
        echo "# Claude Resume Test Summary"
        echo
        echo "**Test Date:** $(date)"
        echo "**Test Directory:** $(pwd)"
        echo "**Test Duration:** Approximately 5-10 minutes"
        echo
        echo "## Test Objectives"
        echo "- Understand how \`claude -r\` (resume) functionality works"
        echo "- Capture all terminal output including screen clears"
        echo "- Monitor hook execution during resume"
        echo "- Analyze debug output patterns"
        echo
        echo "## Files Generated"
        echo "| File | Purpose | Size |"
        echo "|------|---------|------|"
        
        for file in "$LOG_DIR"/*"$TIMESTAMP"*; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                size=$(ls -lh "$file" | awk '{print $5}')
                purpose="Captured output"
                case "$filename" in
                    *screen*) purpose="Screen capture with terminal control sequences" ;;
                    *debug*) purpose="Debug output and verbose logging" ;;
                    *hooks*) purpose="Hook execution monitoring" ;;
                    *session*) purpose="General session information" ;;
                    *analysis*) purpose="Automated analysis of captured data" ;;
                    *summary*) purpose="Human-readable summary report" ;;
                esac
                echo "| $filename | $purpose | $size |"
            fi
        done
        
        echo
        echo "## Next Steps"
        echo "1. Review the generated log files"
        echo "2. Look for patterns in hook execution"
        echo "3. Identify any model switching behavior"
        echo "4. Understand the resume mechanism"
        echo
        echo "## Quick Access Commands"
        echo "\`\`\`bash"
        echo "# View main session log"
        echo "cat $SESSION_LOG"
        echo
        echo "# View debug output"
        echo "cat $DEBUG_LOG"
        echo
        echo "# View analysis"
        echo "cat $ANALYSIS_LOG"
        echo
        echo "# Search for specific patterns"
        echo "grep -i 'pattern' $LOG_DIR/*$TIMESTAMP*"
        echo "\`\`\`"
        
    } > "$SUMMARY_LOG"
    
    echo -e "${GREEN}📋 Summary report: $SUMMARY_LOG${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🎯 Claude Resume Debug Test - Starting...${NC}"
    echo
    
    # Check prerequisites
    if ! command -v claude >/dev/null 2>&1; then
        echo -e "${RED}❌ Claude command not found. Please ensure Claude Code is installed and in PATH.${NC}"
        exit 1
    fi
    
    if ! command -v script >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  'script' command not found. Some capture methods may not work.${NC}"
    fi
    
    # Run the test sequence
    setup_logging
    capture_environment
    test_claude_resume
    analyze_output
    create_summary
    
    echo
    echo -e "${GREEN}✅ Claude resume test complete!${NC}"
    echo -e "${BLUE}📁 All logs saved to: $LOG_DIR${NC}"
    echo -e "${YELLOW}📋 Start with the summary: $SUMMARY_LOG${NC}"
    echo
    echo -e "${BLUE}🔍 Quick preview of what we captured:${NC}"
    ls -la "$LOG_DIR"/*"$TIMESTAMP"* | head -10
}

# Handle interruption gracefully
trap 'echo -e "\n${YELLOW}⚠️  Test interrupted. Logs saved to $LOG_DIR${NC}"; exit 130' INT TERM

# Run main function
main "$@"