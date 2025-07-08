
// Enhanced hook for tool investigation
const fs = require('fs');
const path = require('path');

class ToolAnalyzer {
  constructor() {
    this.logFile = path.join(process.cwd(), 'hook-analysis.log');
  }

  logToolEvent(event, data) {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({
      timestamp,
      event,
      toolName: data.toolName,
      parameters: Object.keys(data.parameters || {}),
      fullData: data
    }, null, 2);

    fs.appendFileSync(this.logFile, `${logEntry}\n\n`);
  }
}

module.exports = ToolAnalyzer;
