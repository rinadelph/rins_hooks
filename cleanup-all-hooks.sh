#!/bin/bash

# Mass cleanup script to remove all hardcoded hooks from system-wide settings files
# Only keeps Rapala Router in essential locations

echo "🧹 Starting system-wide hook cleanup..."

# Keep track of files cleaned
cleaned_count=0

# List of essential settings files to preserve (only clean content, don't delete)
essential_files=(
    "/home/alejandro/.claude/settings.json"
    "/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/.claude/settings.json"
)

# Find all settings files with hardcoded hooks
echo "🔍 Finding all settings files with hardcoded hooks..."
settings_files=$(find /home/alejandro -name "settings.json" -path "*/.claude/*" | xargs grep -l "command.*node" 2>/dev/null || true)

for file in $settings_files; do
    echo "Processing: $file"
    
    # Check if this is an essential file that should only be cleaned
    is_essential=false
    for essential in "${essential_files[@]}"; do
        if [[ "$file" == "$essential" ]]; then
            is_essential=true
            break
        fi
    done
    
    if [[ "$is_essential" == "true" ]]; then
        echo "  ⚠️  Essential file - preserving with clean Rapala-only configuration"
        # These files should already be clean, skip them
        continue
    else
        echo "  🗑️  Removing all hooks from non-essential settings file"
        # Replace hooks section with empty object
        if [[ -f "$file" ]]; then
            # Create backup
            cp "$file" "$file.backup.$(date +%s)" 2>/dev/null || true
            
            # Replace hooks with empty object or remove hooks section entirely
            if grep -q "hooks" "$file"; then
                # If file has hooks, replace with empty
                sed -i 's/"hooks"[[:space:]]*:[[:space:]]*{[^}]*}/"hooks": {}/g' "$file" 2>/dev/null || true
                # Handle multi-line hooks sections
                python3 -c "
import json
import sys
try:
    with open('$file', 'r') as f:
        data = json.load(f)
    if 'hooks' in data:
        data['hooks'] = {}
    with open('$file', 'w') as f:
        json.dump(data, f, indent=2)
    print('    ✅ Cleaned')
except:
    pass
" 2>/dev/null || echo "    ⚠️  Manual cleanup needed"
                
                ((cleaned_count++))
            fi
        fi
    fi
done

echo ""
echo "🎣 Cleanup Summary:"
echo "   📁 Files processed: $(echo "$settings_files" | wc -l)"
echo "   🧹 Files cleaned: $cleaned_count"
echo "   🔒 Essential files preserved: ${#essential_files[@]}"
echo ""
echo "✅ System-wide hook cleanup complete!"
echo "   Only Rapala Router should now be active system-wide"
echo "   All other hooks managed through Rapala system"