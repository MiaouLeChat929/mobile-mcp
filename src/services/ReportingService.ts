import fs from 'fs';
import path from 'path';
import { LogStep, LogEntry } from '../core/types';
import { AdbClient } from '../core/interfaces';

export class ReportingService {
  private currentFlowName: string | null = null;
  private logFilePath: string | null = null;
  private steps: LogStep[] = [];
  private startTime: number = 0;

  constructor(private adb?: AdbClient) {}

  initTestLog(flowName: string): string {
    this.currentFlowName = flowName;
    this.startTime = Date.now();
    this.steps = [];

    const gatestDir = 'gatest';
    const resultsDir = path.join(gatestDir, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(resultsDir, `${flowName}_${timestamp}_log.md`);

    this.flushLog();
    return `Initialized log for ${flowName} at ${this.logFilePath}`;
  }

  logStep(number: number, description: string): string {
    this.steps.push({
        number,
        description,
        entries: [],
        status: 'PENDING'
    });
    this.flushLog();
    return `Started step ${number}: ${description}`;
  }

  logAction(command: string, result: string, level: 'INFO'|'WARN'|'ERROR'|'DEBUG' = 'INFO', screenshotPath?: string): string {
    if (this.steps.length === 0) return "No active step";

    const currentStep = this.steps[this.steps.length - 1];
    currentStep.entries.push({
        timestamp: new Date().toISOString(),
        level,
        message: `Action: ${command} -> ${result}`,
        command,
        result,
        screenshotPath
    });
    this.flushLog();
    return "Action logged";
  }

  finalizeLog(status: 'PASSED' | 'FAILED', summary: string): string {
    this.flushLog(status, summary);
    return `Log finalized: ${status}`;
  }

  async getCrashLogs(): Promise<string> {
      if (!this.adb) {
          return "ADB Client not available for crash logs.";
      }
      try {
          // Dump last 500 lines
          const logs = await this.adb.shell('logcat -d -t 500');
          return this.filterLogs(logs);
      } catch (e: any) {
          return `Failed to retrieve logs: ${e.message}`;
      }
  }

  private filterLogs(rawLogs: string): string {
      const lines = rawLogs.split('\n');
      const filtered = lines.filter(line =>
          line.includes('AndroidRuntime:E') ||
          line.includes('FATAL EXCEPTION') ||
          line.includes('flutter:')
      );

      if (filtered.length === 0) {
          return "No relevant crash logs (AndroidRuntime:E, FATAL EXCEPTION, flutter:) found in the last 500 lines.";
      }

      return filtered.join('\n');
  }

  private flushLog(finalStatus: 'PENDING' | 'PASSED' | 'FAILED' = 'PENDING', summary?: string) {
      if (!this.logFilePath) return;

      let content = `# Test Report: ${this.currentFlowName}\n`;
      content += `**Date:** ${new Date(this.startTime).toLocaleString()}\n`;
      content += `**Status:** ${finalStatus}\n\n`;

      if (summary) {
          content += `## Summary\n${summary}\n\n`;
      }

      content += `## Chronology\n`;

      for (const step of this.steps) {
          content += `### Step ${step.number}: ${step.description}\n`;
          for (const entry of step.entries) {
              content += `- **${entry.timestamp.split('T')[1].split('.')[0]}** [${entry.level}] ${entry.message}\n`;
              if (entry.screenshotPath) {
                  content += `  ![Screenshot](${entry.screenshotPath})\n`;
              }
          }
          content += `\n`;
      }

      fs.writeFileSync(this.logFilePath, content);
  }
}
