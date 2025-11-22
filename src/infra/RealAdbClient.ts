import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { AdbClient } from '../core/interfaces';
import { InstallOptions, Rect } from '../core/types';

const execFileAsync = promisify(execFile);

export class RealAdbClient implements AdbClient {
  private adbPath: string;

  constructor() {
    // Simple path resolution or environment variable
    this.adbPath = process.env.ADB_PATH || 'adb';
  }

  private async exec(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync(this.adbPath, args);
      return stdout.trim();
    } catch (e: any) {
      throw new Error(`ADB Error: ${e.message} (Stderr: ${e.stderr})`);
    }
  }

  private execSync(args: string[]): Buffer {
      return execFileSync(this.adbPath, args);
  }

  async shell(command: string): Promise<string> {
    return this.exec(['shell', command]);
  }

  async install(apkPath: string, options?: InstallOptions): Promise<void> {
    const args = ['install'];
    if (options?.clean) args.push('-r'); // Reinstall (replace existing)
    if (options?.grantPermissions) args.push('-g');
    args.push(apkPath);
    await this.exec(args);
  }

  async uninstall(packageName: string): Promise<void> {
    await this.exec(['uninstall', packageName]);
  }

  async push(localPath: string, remotePath: string): Promise<void> {
    await this.exec(['push', localPath, remotePath]);
  }

  async pull(remotePath: string, localPath: string): Promise<void> {
    await this.exec(['pull', remotePath, localPath]);
  }

  async tap(x: number, y: number): Promise<void> {
    await this.shell(`input tap ${x} ${y}`);
  }

  async inputText(text: string): Promise<void> {
    // Escape special chars for shell
    const escaped = text.replace(/([\\"'`$()<>|&;*])/g, '\\$1');
    await this.shell(`input text "${escaped}"`);
  }

  async keyEvent(keyCode: string | number): Promise<void> {
    await this.shell(`input keyevent ${keyCode}`);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration: number = 500): Promise<void> {
    await this.shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
  }

  async getScreenSize(): Promise<Rect> {
    const output = await this.shell('wm size');
    // Physical size: 1080x1920
    const match = output.match(/(\d+)x(\d+)/);
    if (match) {
        return { x: 0, y: 0, width: parseInt(match[1]), height: parseInt(match[2]) };
    }
    throw new Error("Could not determine screen size");
  }

  async takeScreenshot(): Promise<Buffer> {
    return this.execSync(['exec-out', 'screencap', '-p']);
  }

  async dumpWindowHierarchy(): Promise<string> {
    // New method `uiautomator dump` writes to file, then we cat it.
    await this.shell('uiautomator dump /data/local/tmp/window_dump.xml');
    return this.shell('cat /data/local/tmp/window_dump.xml');
  }
}
