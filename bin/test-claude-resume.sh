#!/bin/bash

# Test Claude Resume Functionality with Full Terminal Capture
# This script captures all terminal output including screen clears and debug info

set -e

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="./test-logs"
SESSION_LOG="$LOG_DIR/claude-resume-test-$TIMESTAMP.log"
DEBUG_LOG="$LOG_DIR/claude-debug-$TIMESTAMP.log"
SCREEN_LOG="$LOG_DIR/claude-screen-$TIMESTAMP.log"
COMBINED_LOG="$LOG_DIR/claude-combined-$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Claude Resume Test Script${NC}"
echo -e "${BLUE}=============================${NC}"
echo "Timestamp: $TIMESTAMP"
echo "Test directory: $(pwd)"
echo

# Create log directory
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log_message() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$SESSION_LOG"
}

# Function to capture command output with multiple methods
capture_command() {
    local cmd="$1"
    local description="$2"
    
    log_message "${YELLOW}Starting: $description${NC}"
    log_message "Command: $cmd"
    
    echo "=== $description ===" >> "$COMBINED_LOG"
    echo "Command: $cmd" >> "$COMBINED_LOG"
    echo "Timestamp: $(date)" >> "$COMBINED_LOG"
    echo >> "$COMBINED_LOG"
    
    # Method 1: Standard output capture with unbuffer (if available)
    if command -v unbuffer >/dev/null 2>&1; then
        log_message "Using unbuffer for real-time capture"
        {
            unbuffer $cmd 2>&1 | tee -a "$DEBUG_LOG"
        } 2>&1 | tee -a "$COMBINED_LOG"
    else
        log_message "Using standard capture (unbuffer not available)"
        {
            $cmd 2>&1 | tee -a "$DEBUG_LOG"
        } 2>&1 | tee -a "$COMBINED_LOG"
    fi
    
    local exit_code=$?
    
    echo >> "$COMBINED_LOG"
    echo "Exit code: $exit_code" >> "$COMBINED_LOG"
    echo "=== End of $description ===" >> "$COMBINED_LOG"
    echo >> "$COMBINED_LOG"
    
    log_message "Completed: $description (exit code: $exit_code)"
    return $exit_code
}

# Function to capture with script command (records everything including screen clears)
capture_with_script() {
    local cmd="$1"
    local description="$2"
    local script_log="$LOG_DIR/script-$(echo "$description" | tr ' ' '-')-$TIMESTAMP.typescript"
    
    log_message "${YELLOW}Script capture: $description${NC}"
    
    # Use script command to capture absolutely everything
    if command -v script >/dev/null 2>&1; then
        log_message "Using 'script' command for complete terminal capture"
        script -f -c "$cmd" "$script_log" 2>&1 | tee -a "$COMBINED_LOG"
        local exit_code=$?
        
        # Also append the script output to our combined log
        echo "=== Script capture: $description ===" >> "$COMBINED_LOG"
        cat "$script_log" >> "$COMBINED_LOG" 2>/dev/null || true
        echo "=== End script capture ===" >> "$COMBINED_LOG"
        echo >> "$COMBINED_LOG"
        
        return $exit_code
    else
        log_message "Script command not available, falling back to standard capture"
        capture_command "$cmd" "$description"
        return $?
    fi
}

# Test setup
log_message "${GREEN}Setting up test environment${NC}"

# Check if claude command exists
if ! command -v claude >/dev/null 2>&1; then
    log_message "${RED}ERROR: claude command not found${NC}"
    exit 1
fi

# Check claude version
log_message "Checking Claude version"
capture_command "claude --version" "Claude Version Check"

# Test 1: Basic claude -r without debug
log_message "${GREEN}Test 1: Basic claude -r${NC}"
capture_with_script "echo 'test message for resume' | timeout 10s claude -r" "Basic Resume Test"

# Test 2: claude -r with --debug
log_message "${GREEN}Test 2: claude -r with --debug${NC}"
capture_with_script "echo 'test message with debug' | timeout 15s claude -r --debug" "Resume with Debug"

# Test 3: Interactive claude -r (with timeout to prevent hanging)
log_message "${GREEN}Test 3: Interactive claude -r with debug${NC}"
capture_with_script "timeout 20s claude -r --debug" "Interactive Resume with Debug"

# Test 4: Check if there are any session files
log_message "${GREEN}Test 4: Session file investigation${NC}"
if [ -d "$HOME/.claude" ]; then
    log_message "Found .claude directory, listing contents"
    capture_command "find $HOME/.claude -name '*.jsonl' -mtime -1 | head -10" "Recent Session Files"
    
    # Try to find the most recent session
    recent_session=$(find "$HOME/.claude" -name '*.jsonl' -mtime -1 | head -1)
    if [ -n "$recent_session" ]; then
        log_message "Examining recent session: $recent_session"
        capture_command "tail -20 '$recent_session'" "Recent Session Content"
    fi
else
    log_message "No .claude directory found"
fi

# Test 5: Environment variable check
log_message "${GREEN}Test 5: Environment Variables${NC}"
capture_command "env | grep -i claude" "Claude Environment Variables"

# Test 6: Process monitoring during claude execution
log_message "${GREEN}Test 6: Process monitoring${NC}"
{
    echo "Starting background process monitoring..."
    (
        while true; do
            ps aux | grep -i claude | grep -v grep >> "$LOG_DIR/processes-$TIMESTAMP.log" 2>/dev/null || true
            sleep 1
        done
    ) &
    MONITOR_PID=$!
    
    # Run claude with monitoring
    capture_with_script "echo 'process monitoring test' | timeout 10s claude -r --debug" "Process Monitored Resume"
    
    # Stop monitoring
    kill $MONITOR_PID 2>/dev/null || true
    
    echo "Process monitoring stopped"
} 2>&1 | tee -a "$COMBINED_LOG"

# Summary
log_message "${GREEN}Test Summary${NC}"
echo -e "${BLUE}Test Results:${NC}"
echo "- Session log: $SESSION_LOG"
echo "- Debug log: $DEBUG_LOG"
echo "- Combined log: $COMBINED_LOG"
echo "- All logs in: $LOG_DIR"
echo

# Show log file sizes
echo -e "${BLUE}Log file sizes:${NC}"
ls -lh "$LOG_DIR"/*$TIMESTAMP* 2>/dev/null || echo "No log files generated"

# Quick analysis
log_message "${GREEN}Quick Analysis${NC}"
echo -e "${BLUE}Searching for interesting patterns in logs:${NC}"

# Look for hook-related output
if grep -q "hook" "$COMBINED_LOG" 2>/dev/null; then
    echo "Found hook-related output:"
    grep -n "hook" "$COMBINED_LOG" | head -5
fi

# Look for debug output
if grep -q "debug\|DEBUG" "$COMBINED_LOG" 2>/dev/null; then
    echo "Found debug output:"
    grep -n -i "debug" "$COMBINED_LOG" | head -5
fi

# Look for resume-related output
if grep -q "resume\|Resume\|RESUME" "$COMBINED_LOG" 2>/dev/null; then
    echo "Found resume-related output:"
    grep -n -i "resume" "$COMBINED_LOG" | head -5
fi

log_message "${GREEN}Claude resume test completed${NC}"
echo -e "${YELLOW}Check the log files in $LOG_DIR for detailed analysis${NC}"