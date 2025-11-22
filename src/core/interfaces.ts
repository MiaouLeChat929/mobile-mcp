import { Readable } from 'stream';
import { BuildResult, InstallOptions, Rect, SemanticNode } from './types';

export interface AdbClient {
  // Core ADB commands
  shell(command: string): Promise<string>;
  install(apkPath: string, options?: InstallOptions): Promise<void>;
  uninstall(packageName: string): Promise<void>;
  push(localPath: string, remotePath: string): Promise<void>;
  pull(remotePath: string, localPath: string): Promise<void>;

  // Interaction
  tap(x: number, y: number): Promise<void>;
  inputText(text: string): Promise<void>;
  keyEvent(keyCode: string | number): Promise<void>;
  swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void>;

  // Info
  getScreenSize(): Promise<Rect>; // x,y usually 0,0
  takeScreenshot(): Promise<Buffer>;
  dumpWindowHierarchy(): Promise<string>; // XML
}

export interface FlutterRunner {
  spawn(args: string[]): Promise<void>;
  stop(): Promise<void>;

  // Hot Reload/Restart
  hotReload(): Promise<string>; // Returns error string if any
  hotRestart(): Promise<void>;

  // Info
  getVmServiceUri(): Promise<string | null>;

  // Streams
  getStdout(): Readable;
  getStderr(): Readable;
}

export interface VmServiceClient {
  connect(uri: string): Promise<void>;
  disconnect(): Promise<void>;

  // Inspection
  getRenderObjectDiagnostics(subtreeDepth: number): Promise<any>; // Raw JSON tree
  evaluate(expression: string): Promise<any>;
}
