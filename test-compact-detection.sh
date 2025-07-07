#!/bin/bash

# Test script to run during Claude Code session to detect /compact

echo "🎯 Claude Code /compact Detection Test"
echo "======================================"

# Create test directory for monitoring
TEST_DIR="/tmp/claude-compact-test"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📁 Test directory: $TEST_DIR"

# Function to take before/after snapshots
take_snapshot() {
    local name="$1"
    echo "📸 Taking snapshot: $name"
    
    # Process info
    ps aux | grep claude | grep -v grep > "snapshot_${name}_processes.txt"
    
    # Memory info
    free -h > "snapshot_${name}_memory.txt"
    
    # File system info
    find ~/.claude -type f -exec stat {} \; 2>/dev/null > "snapshot_${name}_claude_files.txt"
    find ~/.config/claude -type f -exec stat {} \; 2>/dev/null > "snapshot_${name}_config_files.txt"
    find /tmp -name "*claude*" -type f -exec stat {} \; 2>/dev/null > "snapshot_${name}_temp_files.txt"
    
    # System info
    cat /proc/meminfo > "snapshot_${name}_meminfo.txt"
    
    echo "✅ Snapshot $name completed"
}

# Function to compare snapshots
compare_snapshots() {
    echo "🔍 Comparing snapshots..."
    
    echo "Process changes:"
    diff snapshot_before_processes.txt snapshot_after_processes.txt || echo "No process changes"
    
    echo "Memory changes:"
    diff snapshot_before_memory.txt snapshot_after_memory.txt || echo "No memory changes"
    
    echo "Claude files changes:"
    diff snapshot_before_claude_files.txt snapshot_after_claude_files.txt || echo "No claude files changes"
    
    echo "Config files changes:"
    diff snapshot_before_config_files.txt snapshot_after_config_files.txt || echo "No config files changes"
    
    echo "Temp files changes:"
    diff snapshot_before_temp_files.txt snapshot_after_temp_files.txt || echo "No temp files changes"
    
    echo "Memory info changes:"
    diff snapshot_before_meminfo.txt snapshot_after_meminfo.txt || echo "No meminfo changes"
}

# Function to monitor file changes in real-time
start_file_monitoring() {
    echo "📁 Starting file monitoring..."
    
    # Monitor Claude directories
    inotifywait -m -r --format '%T %w%f %e' --timefmt '%Y-%m-%d %H:%M:%S' \
        ~/.claude/ \
        ~/.config/claude/ \
        /tmp/ \
        2>/dev/null > file_changes.log &
    
    MONITOR_PID=$!
    echo "🔍 File monitoring started (PID: $MONITOR_PID)"
    
    # Return the PID so we can stop it later
    echo $MONITOR_PID
}

# Function to stop file monitoring
stop_file_monitoring() {
    local pid=$1
    if [ ! -z "$pid" ]; then
        kill $pid 2>/dev/null
        echo "⏹️  File monitoring stopped"
    fi
}

# Main test sequence
echo ""
echo "🚀 INSTRUCTIONS FOR TESTING:"
echo "1. Run this script in one terminal"
echo "2. In another terminal, run: tmux new-session -d -s claude-debug 'claude -c --debug'"
echo "3. Attach to tmux: tmux attach-session -t claude-debug"
echo "4. In Claude Code session, run: /compact"
echo "5. Come back here and press ENTER to stop monitoring"
echo ""
echo "Press ENTER to start monitoring..."
read

# Start monitoring
take_snapshot "before"
MONITOR_PID=$(start_file_monitoring)

echo ""
echo "🔍 MONITORING ACTIVE"
echo "Go to Claude Code and run: /compact"
echo "Then press ENTER here to stop monitoring and see results..."
read

# Stop monitoring and take after snapshot
stop_file_monitoring $MONITOR_PID
take_snapshot "after"

echo ""
echo "📊 ANALYSIS RESULTS"
echo "==================="
compare_snapshots

echo ""
echo "📋 File change events:"
if [ -f "file_changes.log" ]; then
    echo "Recent file changes detected:"
    tail -20 file_changes.log
    
    echo ""
    echo "🔍 Filtering for potential compact-related changes..."
    grep -i "claude\|memory\|compact\|anthropic" file_changes.log || echo "No compact-related file changes found"
else
    echo "No file changes log found"
fi

echo ""
echo "✅ Test completed. Files saved to: $TEST_DIR"
echo "📁 Check these files for detailed analysis:"
ls -la *.txt *.log 2>/dev/null