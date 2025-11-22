import { AdbClient } from '../../src/core/interfaces';
import { InstallOptions, Rect } from '../../src/core/types';

export class MockAdbClient implements AdbClient {
  public logs: string[] = [];
  public installedApps: Set<string> = new Set();
  public screenSize: Rect = { x: 0, y: 0, width: 1080, height: 1920 };

  async shell(command: string): Promise<string> {
    this.logs.push(`shell: ${command}`);
    if (command.includes('pm list packages')) {
      return Array.from(this.installedApps).map(app => `package:${app}`).join('\n');
    }
    return "success";
  }

  async install(apkPath: string, options?: InstallOptions): Promise<void> {
    this.logs.push(`install: ${apkPath} clean=${options?.clean}`);
    // Simulate package name derivation or just assume it works
    this.installedApps.add("com.example.app");
  }

  async uninstall(packageName: string): Promise<void> {
    this.logs.push(`uninstall: ${packageName}`);
    this.installedApps.delete(packageName);
  }

  async push(localPath: string, remotePath: string): Promise<void> {
    this.logs.push(`push: ${localPath} -> ${remotePath}`);
  }

  async pull(remotePath: string, localPath: string): Promise<void> {
    this.logs.push(`pull: ${remotePath} -> ${localPath}`);
  }

  async tap(x: number, y: number): Promise<void> {
    this.logs.push(`tap: ${x},${y}`);
  }

  async inputText(text: string): Promise<void> {
    this.logs.push(`input: ${text}`);
  }

  async keyEvent(keyCode: string | number): Promise<void> {
    this.logs.push(`keyEvent: ${keyCode}`);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void> {
    this.logs.push(`swipe: ${x1},${y1} to ${x2},${y2}`);
  }

  async getScreenSize(): Promise<Rect> {
    return this.screenSize;
  }

  async takeScreenshot(): Promise<Buffer> {
    this.logs.push(`screenshot`);
    // Return a 1x1 pixel transparent PNG
    return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  }

  async dumpWindowHierarchy(): Promise<string> {
    return '<hierarchy rotation="0"><node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example.app" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,1920]"><node index="0" text="Login" resource-id="com.example.app:id/login_button" class="android.widget.Button" package="com.example.app" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[100,500][980,650]" /></node></hierarchy>';
  }
}
