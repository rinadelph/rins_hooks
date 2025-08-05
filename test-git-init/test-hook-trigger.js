// Test file to trigger git hooks
console.log('Testing git initialization in new project');

function testFunction() {
    return 'This should trigger the git hooks and auto-initialize a repo';
}

module.exports = { testFunction };