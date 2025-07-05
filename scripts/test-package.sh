#!/bin/bash

# rins_hooks testing script
set -e

echo "🧪 Testing rins_hooks package..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((FAILED++))
}

info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

# Test 1: Package structure
echo -e "\n${BLUE}Test 1: Package Structure${NC}"
echo "------------------------"

if [ -f "package.json" ]; then
    pass "package.json exists"
else
    fail "package.json missing"
fi

if [ -f "bin/rins_hooks" ]; then
    pass "CLI binary exists"
else
    fail "CLI binary missing"
fi

if [ -d "src" ] && [ -f "src/cli.js" ]; then
    pass "Source files exist"
else
    fail "Source files missing"
fi

if [ -d "hooks" ]; then
    HOOK_COUNT=$(find hooks -name "index.js" | wc -l)
    if [ $HOOK_COUNT -gt 0 ]; then
        pass "Found $HOOK_COUNT hooks"
    else
        fail "No hooks found"
    fi
else
    fail "Hooks directory missing"
fi

# Test 2: Dependencies
echo -e "\n${BLUE}Test 2: Dependencies${NC}"
echo "-------------------"

if npm list --depth=0 >/dev/null 2>&1; then
    pass "All dependencies installed"
else
    fail "Missing dependencies - run 'npm install'"
fi

# Test 3: CLI functionality
echo -e "\n${BLUE}Test 3: CLI Functionality${NC}"
echo "------------------------"

if node src/cli.js --version >/dev/null 2>&1; then
    VERSION=$(node src/cli.js --version)
    pass "CLI version: $VERSION"
else
    fail "CLI version command failed"
fi

if node src/cli.js --help >/dev/null 2>&1; then
    pass "CLI help command works"
else
    fail "CLI help command failed"
fi

if node src/cli.js list >/dev/null 2>&1; then
    pass "CLI list command works"
else
    fail "CLI list command failed"
fi

if node src/cli.js doctor >/dev/null 2>&1; then
    pass "CLI doctor command works"
else
    fail "CLI doctor command failed"
fi

# Test 4: Hook validation
echo -e "\n${BLUE}Test 4: Hook Validation${NC}"
echo "----------------------"

for hook_dir in hooks/*/; do
    if [ -d "$hook_dir" ]; then
        hook_name=$(basename "$hook_dir")
        
        if [ -f "$hook_dir/index.js" ]; then
            pass "Hook $hook_name has index.js"
        else
            fail "Hook $hook_name missing index.js"
        fi
        
        if [ -f "$hook_dir/config.json" ]; then
            if jq empty "$hook_dir/config.json" >/dev/null 2>&1; then
                pass "Hook $hook_name has valid config.json"
            else
                fail "Hook $hook_name has invalid config.json"
            fi
        else
            fail "Hook $hook_name missing config.json"
        fi
        
        if [ -x "$hook_dir/index.js" ]; then
            pass "Hook $hook_name is executable"
        else
            fail "Hook $hook_name is not executable"
        fi
    fi
done

# Test 5: Hook execution
echo -e "\n${BLUE}Test 5: Hook Execution${NC}"
echo "---------------------"

# Test auto-commit hook with mock input
TEST_INPUT='{"session_id":"test-session","tool_name":"Write","tool_input":{"file_path":"/tmp/test.js","content":"console.log(\"test\");"}}'

if echo "$TEST_INPUT" | timeout 5 node hooks/auto-commit/index.js >/dev/null 2>&1; then
    pass "Auto-commit hook executes without error"
else
    warn "Auto-commit hook test failed (may be expected outside git repo)"
fi

# Test code formatter hook
if echo "$TEST_INPUT" | timeout 5 node hooks/code-formatter/index.js >/dev/null 2>&1; then
    pass "Code formatter hook executes without error"
else
    warn "Code formatter hook test failed (may be expected without formatters)"
fi

# Test notification hook  
if echo '{"message":"Test notification","title":"Test"}' | timeout 5 node hooks/notification/index.js >/dev/null 2>&1; then
    pass "Notification hook executes without error"
else
    warn "Notification hook test failed (may be expected without notifier)"
fi

# Test 6: Linting
echo -e "\n${BLUE}Test 6: Code Quality${NC}"
echo "------------------"

if command -v npx >/dev/null 2>&1; then
    if npx eslint src/ hooks/ --quiet; then
        pass "ESLint passes"
    else
        fail "ESLint found issues"
    fi
else
    warn "ESLint not available"
fi

# Test 7: Package integrity
echo -e "\n${BLUE}Test 7: Package Integrity${NC}"
echo "-------------------------"

if npm pack --dry-run >/dev/null 2>&1; then
    pass "Package builds successfully"
else
    fail "Package build failed"
fi

# Test 8: Git integration (if in git repo)
echo -e "\n${BLUE}Test 8: Git Integration${NC}"
echo "----------------------"

if git rev-parse --git-dir >/dev/null 2>&1; then
    pass "Running in git repository"
    
    if git status --porcelain >/dev/null 2>&1; then
        pass "Git status works"
    else
        fail "Git status failed"
    fi
else
    warn "Not in git repository - some hooks may not work"
fi

# Test 9: Cross-platform compatibility
echo -e "\n${BLUE}Test 9: Platform Compatibility${NC}"
echo "------------------------------"

PLATFORM=$(node -e "console.log(process.platform)")
pass "Platform detected: $PLATFORM"

if [ "$PLATFORM" = "linux" ] || [ "$PLATFORM" = "darwin" ] || [ "$PLATFORM" = "win32" ]; then
    pass "Supported platform"
else
    warn "Untested platform: $PLATFORM"
fi

# Test 10: Required tools
echo -e "\n${BLUE}Test 10: Required Tools${NC}"
echo "----------------------"

if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    pass "Node.js available: $NODE_VERSION"
else
    fail "Node.js not found"
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    pass "npm available: $NPM_VERSION"
else
    fail "npm not found"
fi

if command -v git >/dev/null 2>&1; then
    GIT_VERSION=$(git --version)
    pass "Git available: $GIT_VERSION"
else
    warn "Git not found (required for auto-commit hook)"
fi

if command -v jq >/dev/null 2>&1; then
    pass "jq available (JSON processing)"
else
    warn "jq not found (useful for hook development)"
fi

# Summary
echo -e "\n${BLUE}Test Summary${NC}"
echo "============"
echo -e "Tests passed: ${GREEN}$PASSED${NC}"
echo -e "Tests failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! Package is ready.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please fix issues before publishing.${NC}"
    exit 1
fi