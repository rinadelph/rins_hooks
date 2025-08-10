#!/bin/bash

echo "🧪 Testing Rapala Status Line Editor in tmux"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create a tmux session for testing
tmux new-session -d -s rapala-statusline-test

# Navigate to the status line section (6 right arrows to get to the last section)
echo "Navigating to Status Line section..."
tmux send-keys -t rapala-statusline-test "cd $PWD" Enter
tmux send-keys -t rapala-statusline-test "node src/cli.js status" Enter

# Wait for interface to load
sleep 2

# Navigate to Status Line section (press right arrow 5 times to get to Status Line)
for i in {1..5}; do
    tmux send-keys -t rapala-statusline-test "Right"
    sleep 0.5
done

# Press Enter to enter the section
tmux send-keys -t rapala-statusline-test "Enter"
sleep 1

# Capture the screen
echo "Capturing screen..."
tmux capture-pane -t rapala-statusline-test -p > /tmp/rapala-statusline-test.txt

# Show what's on screen
echo
echo "Current screen content:"
cat /tmp/rapala-statusline-test.txt

# Send 'q' to quit
tmux send-keys -t rapala-statusline-test "q"

# Clean up
tmux kill-session -t rapala-statusline-test

echo
echo "✅ Test complete"