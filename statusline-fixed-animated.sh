#!/bin/bash
# Fixed Advanced Animated Status Line Script for Claude Code

input=$(cat)

# Extract basic info
if command -v jq >/dev/null 2>&1; then
    MODEL_DISPLAY=$(echo "$input" | jq -r '.model.display_name')
    CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir')
else
    MODEL_DISPLAY="Claude"
    CURRENT_DIR=$(basename "$(pwd)")
fi

# Use Node.js for advanced animations if available
if command -v node >/dev/null 2>&1; then
    # Get component paths
    COMPONENTS_DIR="/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/src/statusline/components"
    
    if [ -d "$COMPONENTS_DIR" ]; then
        # Create temp script for animation processing
        TEMP_SCRIPT="/tmp/statusline-animate-$$"
        
        cat > "$TEMP_SCRIPT" << EOF
const path = require('path');
const { execSync } = require('child_process');

try {
    const AnimatedModel = require('$COMPONENTS_DIR/animated-model.js');
    const AnimatedDirectory = require('$COMPONENTS_DIR/animated-directory.js');
    const AnimatedGit = require('$COMPONENTS_DIR/animated-git.js');
    const AnimatedTime = require('$COMPONENTS_DIR/animated-time.js');

    const modelName = '$MODEL_DISPLAY';
    const currentDir = path.basename('$CURRENT_DIR');

    // Initialize components with subtle animations
    const modelComp = new AnimatedModel({ 
        animationStyle: 'pulse', 
        speed: 'medium' 
    });

    const dirComp = new AnimatedDirectory({ 
        animationStyle: 'icon-pulse', 
        maxLength: 15,
        speed: 'slow' 
    });

    const gitComp = new AnimatedGit({ 
        animationStyle: 'icon-rotation', 
        speed: 'medium' 
    });

    const timeComp = new AnimatedTime({ 
        animationStyle: 'separator-blink', 
        showSeconds: false,
        speed: 'medium' 
    });

    // Get current frames
    const modelFrame = modelComp.getCurrentFrame();
    const dirFrame = dirComp.getCurrentFrame();
    const gitFrame = gitComp.getCurrentFrame();
    const timeFrame = timeComp.getCurrentFrame();

    // Generate components
    const model = modelComp.generate(modelName, modelFrame);
    const directory = dirComp.generate(currentDir, dirFrame);
    const time = timeComp.generate(timeFrame);

    // Check git status
    let gitStatus = '';
    try {
        const branch = execSync('git branch --show-current 2>/dev/null || echo ""', { 
            encoding: 'utf8', 
            timeout: 1000 
        }).trim();
        
        if (branch) {
            const isDirty = execSync('git diff --quiet HEAD 2>/dev/null; echo \$?', { 
                encoding: 'utf8', 
                timeout: 1000 
            }).trim() !== '0';
            
            gitStatus = ' ' + gitComp.generate(branch, isDirty, gitFrame);
        }
    } catch (error) {
        // Git not available or not a repo
    }

    // Output animated status line
    console.log(\`\${model} \${directory}\${gitStatus} \${time}\`);
} catch (error) {
    // Fallback to simple display
    console.log(\`[\$MODEL_DISPLAY] 📁\${path.basename('\$CURRENT_DIR')} \${new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit'})}\`);
}
EOF

        # Execute the Node.js script
        node "$TEMP_SCRIPT" 2>/dev/null
        
        # Clean up temp script
        rm -f "$TEMP_SCRIPT"
    else
        echo "[$MODEL_DISPLAY] 📁$(basename "$CURRENT_DIR") $(date +%H:%M)"
    fi
else
    # Fallback to basic status line with simple bash animations
    
    # Compact model name
    case "$MODEL_DISPLAY" in
        "Claude Sonnet"*|"Sonnet"*) MODEL="S4" ;;
        "Claude Opus"*|"Opus"*) MODEL="O4" ;;  
        "Claude Haiku"*|"Haiku"*) MODEL="H4" ;;
        *) MODEL="${MODEL_DISPLAY:0:3}" ;;
    esac
    
    # Directory name (truncate if too long)
    DIR_NAME=$(basename "$CURRENT_DIR")
    if [ ${#DIR_NAME} -gt 15 ]; then
        DIR_NAME="${DIR_NAME:0:12}..."
    fi
    
    # Simple animated separators
    FRAME=$(($(date +%s) % 2))
    if [ $FRAME -eq 0 ]; then
        TIME_SEP=":"
    else
        TIME_SEP="·"
    fi
    
    # Git info
    GIT_STATUS=""
    if git rev-parse --git-dir >/dev/null 2>&1; then
        BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
        if [ ${#BRANCH} -gt 10 ]; then
            BRANCH="${BRANCH:0:7}..."
        fi
        
        # Simple animated git icon
        GIT_FRAME=$(($(date +%s) % 3))
        case $GIT_FRAME in
            0) GIT_ICON="🌿" ;;
            1) GIT_ICON="🌱" ;;
            2) GIT_ICON="🌿" ;;
        esac
        
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            GIT_STATUS=" ${GIT_ICON}${BRANCH}*"
        else
            GIT_STATUS=" ${GIT_ICON}${BRANCH}"
        fi
    fi
    
    # Time with animated separator
    TIME=$(date +%H${TIME_SEP}%M)
    
    # Output simple animated status line
    echo -e "\033[35m[${MODEL}]\033[0m \033[36m📁${DIR_NAME}\033[0m\033[32m${GIT_STATUS}\033[0m \033[33m${TIME}\033[0m"
fi