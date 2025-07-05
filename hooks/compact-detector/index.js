#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const HookBase = require('../../src/hook-base');

class CompactDetectorHook extends HookBase {
  constructor(config = {}) {
    super('compact-detector', config);
    this.lastMemorySnapshot = null;
    this.monitoringActive = false;
    this.logFile = path.join(process.cwd(), 'compact-detection.log');
    this.setupMonitoring();
  }

  getDefaultConfig() {
    return {
      enabled: true,
      matcher: '.*', // Monitor all tool calls
      timeout: 5,
      description: 'Detect /compact operations through indirect monitoring',
      monitorInterval: 1000,
      memoryThreshold: 10 * 1024 * 1024, // 10MB
      checkClaudeFiles: true,
      checkTempFiles: true,
      checkProcessMemory: true
    };
  }

  setupMonitoring() {
    this.log('🔍 Compact detector initialized');
    
    // Monitor common Claude Code directories
    this.claudeDirectories = [
      path.join(process.env.HOME, '.claude'),
      path.join(process.env.HOME, '.config', 'claude'),
      '/tmp'
    ];

    // Take initial memory snapshot
    this.takeMemorySnapshot();
    
    // Start continuous monitoring
    if (!this.monitoringActive) {
      this.startContinuousMonitoring();
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    console.log(message);
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      // Fail silently if can't write to log
    }
  }

  async takeMemorySnapshot() {
    try {
      const snapshot = {
        timestamp: Date.now(),
        claudeProcesses: await this.getClaudeProcessInfo(),
        fileStats: await this.getFileStats(),
        tempFiles: await this.getTempFiles()
      };
      
      this.lastMemorySnapshot = snapshot;
      return snapshot;
    } catch (error) {
      this.log(`⚠️  Memory snapshot failed: ${error.message}`);
      return null;
    }
  }

  async getClaudeProcessInfo() {
    return new Promise((resolve) => {
      exec('ps aux | grep claude | grep -v grep', (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        
        const processes = stdout.trim().split('\n')
          .filter(line => line.includes('claude'))
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[1],
              cpu: parts[2],
              mem: parts[3],
              command: parts.slice(10).join(' ')
            };
          });
        
        resolve(processes);
      });
    });
  }

  async getFileStats() {
    const stats = {};
    
    for (const dir of this.claudeDirectories) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir, { recursive: true });
          stats[dir] = {
            count: files.length,
            files: files.filter(f => {
              const fullPath = path.join(dir, f);
              try {
                return fs.statSync(fullPath).isFile();
              } catch {
                return false;
              }
            }).map(f => {
              const fullPath = path.join(dir, f);
              try {
                const stat = fs.statSync(fullPath);
                return {
                  name: f,
                  size: stat.size,
                  mtime: stat.mtime.getTime()
                };
              } catch {
                return null;
              }
            }).filter(Boolean)
          };
        } catch (error) {
          stats[dir] = { error: error.message };
        }
      }
    }
    
    return stats;
  }

  async getTempFiles() {
    try {
      const tempDir = '/tmp';
      const files = fs.readdirSync(tempDir);
      return files.filter(f => 
        f.includes('claude') || 
        f.includes('anthropic') ||
        f.startsWith('tmp') && f.includes('claude')
      ).map(f => {
        const fullPath = path.join(tempDir, f);
        try {
          const stat = fs.statSync(fullPath);
          return {
            name: f,
            size: stat.size,
            mtime: stat.mtime.getTime()
          };
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  detectMemoryChanges(oldSnapshot, newSnapshot) {
    const changes = [];
    
    // Check for process changes
    if (oldSnapshot && newSnapshot) {
      const oldProcs = oldSnapshot.claudeProcesses || [];
      const newProcs = newSnapshot.claudeProcesses || [];
      
      if (oldProcs.length !== newProcs.length) {
        changes.push(`Process count changed: ${oldProcs.length} → ${newProcs.length}`);
      }
      
      // Check memory usage changes
      newProcs.forEach(proc => {
        const oldProc = oldProcs.find(p => p.pid === proc.pid);
        if (oldProc && Math.abs(parseFloat(proc.mem) - parseFloat(oldProc.mem)) > 1.0) {
          changes.push(`Memory usage changed for PID ${proc.pid}: ${oldProc.mem}% → ${proc.mem}%`);
        }
      });
      
      // Check file changes
      Object.keys(newSnapshot.fileStats || {}).forEach(dir => {
        const oldFiles = oldSnapshot.fileStats[dir]?.files || [];
        const newFiles = newSnapshot.fileStats[dir]?.files || [];
        
        if (oldFiles.length !== newFiles.length) {
          changes.push(`File count in ${dir}: ${oldFiles.length} → ${newFiles.length}`);
        }
        
        // Check for modified files
        newFiles.forEach(file => {
          const oldFile = oldFiles.find(f => f.name === file.name);
          if (oldFile && oldFile.mtime !== file.mtime) {
            changes.push(`File modified: ${dir}/${file.name}`);
          }
        });
      });
    }
    
    return changes;
  }

  startContinuousMonitoring() {
    this.monitoringActive = true;
    
    setInterval(async () => {
      const newSnapshot = await this.takeMemorySnapshot();
      if (this.lastMemorySnapshot && newSnapshot) {
        const changes = this.detectMemoryChanges(this.lastMemorySnapshot, newSnapshot);
        
        if (changes.length > 0) {
          this.log('🔍 POTENTIAL COMPACT ACTIVITY DETECTED:');
          changes.forEach(change => this.log(`  - ${change}`));
          
          // Check if this could be a compact operation
          const compactIndicators = changes.filter(change => 
            change.includes('Memory usage changed') ||
            change.includes('File count') ||
            change.includes('File modified')
          );
          
          if (compactIndicators.length > 0) {
            this.log('🚨 POSSIBLE /COMPACT OPERATION DETECTED!');
            this.log('🕒 Timestamp: ' + new Date().toISOString());
            this.log('📊 Changes: ' + JSON.stringify(compactIndicators, null, 2));
            
            // Trigger our own compact detection hook
            this.triggerCompactDetection(compactIndicators);
          }
        }
        
        this.lastMemorySnapshot = newSnapshot;
      }
    }, this.config.monitorInterval);
  }

  triggerCompactDetection(indicators) {
    // This is where we can trigger custom actions when compact is detected
    const detection = {
      timestamp: new Date().toISOString(),
      indicators: indicators,
      confidence: this.calculateConfidence(indicators)
    };
    
    // Save detection to file
    const detectionFile = path.join(process.cwd(), 'compact-detections.json');
    let detections = [];
    
    if (fs.existsSync(detectionFile)) {
      try {
        detections = JSON.parse(fs.readFileSync(detectionFile, 'utf8'));
      } catch (error) {
        detections = [];
      }
    }
    
    detections.push(detection);
    
    try {
      fs.writeFileSync(detectionFile, JSON.stringify(detections, null, 2));
    } catch (error) {
      this.log(`⚠️  Failed to save detection: ${error.message}`);
    }
    
    this.log('💾 Compact detection saved to compact-detections.json');
  }

  calculateConfidence(indicators) {
    let confidence = 0;
    
    indicators.forEach(indicator => {
      if (indicator.includes('Memory usage changed')) confidence += 30;
      if (indicator.includes('File count')) confidence += 25;
      if (indicator.includes('File modified')) confidence += 20;
    });
    
    return Math.min(confidence, 100);
  }

  async execute(input) {
    try {
      // This gets called on every tool use
      const { tool_name, tool_input } = input;
      
      // Take a snapshot after any tool use to detect changes
      const snapshot = await this.takeMemorySnapshot();
      
      if (this.lastMemorySnapshot) {
        const changes = this.detectMemoryChanges(this.lastMemorySnapshot, snapshot);
        if (changes.length > 0) {
          this.log(`🔧 Tool ${tool_name} may have triggered memory changes`);
        }
      }
      
      return this.success({
        message: `Compact detector monitoring tool: ${tool_name}`,
        changesDetected: this.lastMemorySnapshot ? 
          this.detectMemoryChanges(this.lastMemorySnapshot, snapshot).length : 0
      });

    } catch (error) {
      return this.error(`Compact detector failed: ${error.message}`);
    }
  }
}

// If called directly, execute the hook
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const hook = new CompactDetectorHook();
      const result = await hook.execute(input);
      HookBase.outputResult(result);
    } catch (error) {
      console.error(`Compact detector error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = CompactDetectorHook;