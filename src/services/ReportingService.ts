import fs from 'fs';
import path from 'path';
import { LogStep, LogEntry } from '../core/types';

export class ReportingService {
  private currentFlowName: string | null = null;
  private logFilePath: string | null = null;
  private steps: LogStep[] = [];
  private startTime: number = 0;

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

  getCrashLogs(): string {
      // In a real scenario, this would run `adb logcat -d` and filter for Dart/Flutter exceptions.
      // For now, we return a placeholder or a mock command.
      return "No crash logs found (Not implemented fully in this iteration)";
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
