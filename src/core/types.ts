export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SemanticNode {
  id?: string;
  type: string; // "Button", "Text", "Input", etc.
  text?: string;
  rect: Rect;
  children?: SemanticNode[];
  // Flags
  isClickable?: boolean;
  isFocusable?: boolean;
  isFocused?: boolean;
  isVisible?: boolean;
}

export type AppMode = 'debug' | 'profile' | 'release';
export type Platform = 'android' | 'ios';

export interface BuildResult {
  success: boolean;
  apkPath?: string;
  error?: string;
}

export interface InstallOptions {
  clean?: boolean;
  grantPermissions?: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  screenshotPath?: string;
  command?: string;
  result?: string;
}

export interface TestFlowLog {
  flowName: string;
  deviceInfo: string;
  startTime: string;
  steps: LogStep[];
  status: 'PENDING' | 'PASSED' | 'FAILED';
  summary?: string;
}

export interface LogStep {
  number: number;
  description: string;
  entries: LogEntry[];
  status: 'PENDING' | 'PASSED' | 'FAILED';
}
