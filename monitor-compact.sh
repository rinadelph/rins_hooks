#!/bin/bash

# Monitor script for detecting /compact operations in Claude Code
# This script sets up comprehensive monitoring before launching Claude Code

echo "🔍 Setting up /compact detection monitoring..."

# Create monitoring directory
mkdir -p /tmp/claude-compact-monitor
cd /tmp/claude-compact-monitor

# Start file system monitoring for Claude Code related files
echo "📁 Starting filesystem monitoring..."

# Monitor common Claude Code directories
inotifywait -m -r --format '%T %w%f %e' --timefmt '%Y-%m-%d %H:%M:%S' \
  ~/.claude/ \
  ~/.config/claude/ \
  /tmp/ \
  . \
  2>/dev/null | tee fs-monitor.log &
FS_MONITOR_PID=$!

# Monitor process activity
echo "🔄 Starting process monitoring..."
while true; do
  ps aux | grep claude | grep -v grep >> process-monitor.log
  sleep 1
done &
PROCESS_MONITOR_PID=$!

# Monitor system calls for claude processes
echo "🔍 Starting system call monitoring..."
strace -e trace=file,memory,process -f -o syscall-monitor.log -p $(pgrep claude) 2>/dev/null &
STRACE_PID=$!

# Monitor network activity (in case compact involves remote operations)
echo "🌐 Starting network monitoring..."
netstat -tuln | grep claude >> network-monitor.log &
NETWORK_MONITOR_PID=$!

# Create cleanup function
cleanup() {
  echo "🧹 Cleaning up monitoring processes..."
  kill $FS_MONITOR_PID 2>/dev/null
  kill $PROCESS_MONITOR_PID 2>/dev/null  
  kill $STRACE_PID 2>/dev/null
  kill $NETWORK_MONITOR_PID 2>/dev/null
  echo "✅ Monitoring stopped"
}

trap cleanup EXIT

echo "🚀 Starting Claude Code with debug in tmux..."
echo "📍 Monitoring logs will be saved to: $(pwd)"
echo ""
echo "INSTRUCTIONS:"
echo "1. In the Claude Code session, run: /compact"
echo "2. Watch the monitoring logs for any activity"
echo "3. Press Ctrl+C here to stop monitoring"
echo ""

# Launch Claude Code in tmux with debug
tmux new-session -d -s claude-debug "claude -c --debug"
tmux attach-session -t claude-debug

# When tmux exits, cleanup will run automatically