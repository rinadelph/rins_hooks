// Hook Testing File
// This file will trigger various hook events for systematic testing

console.log("=== HOOK TESTING SESSION ===");
console.log("Testing all active hooks in the system");
console.log("Expected triggers:");
console.log("- Write tool (this file creation) should trigger:");
console.log("  * extended-thinking (PostToolUse)");
console.log("  * git-agentmcp (PostToolUse)");
console.log();

console.log("Active hooks from status:");
console.log("1. version-checker (SessionStart only)");
console.log("2. extended-thinking (UserPromptSubmit, PreToolUse, PostToolUse)");
console.log("3. git-agentmcp (PostToolUse on Edit|Write|MultiEdit)");
console.log();

console.log("Let's see what actually runs...");