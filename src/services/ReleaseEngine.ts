import { AdbClient } from '../core/interfaces';
import { BuildResult } from '../core/types';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ReleaseEngine {
  constructor(private adb: AdbClient) {}

  async buildApp(mode: 'debug' | 'profile', target: string = 'lib/main.dart'): Promise<BuildResult> {
    try {
      const command = `flutter build apk --${mode} -t ${target}`;
      await execAsync(command);

      const apkName = `app-${mode}.apk`;
      const apkPath = path.join('build', 'app', 'outputs', 'flutter-apk', apkName);

      if (fs.existsSync(apkPath)) {
        return { success: true, apkPath };
      } else {
        return { success: false, error: `Build completed but APK not found at ${apkPath}` };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async installApp(apkPath: string, clean: boolean = false, grantPermissions: boolean = true): Promise<string> {
    await this.adb.install(apkPath, { clean, grantPermissions });
    return `Installed ${apkPath} (clean=${clean})`;
  }

  async launchApp(packageName: string, waitForRender: boolean = true): Promise<string> {
    // Monkey is robust for launching main activity
    await this.adb.shell(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);

    if (waitForRender) {
       await new Promise(r => setTimeout(r, 2000));
    }

    return `Launched ${packageName}`;
  }

  async stopApp(packageName: string): Promise<string> {
    await this.adb.shell(`am force-stop ${packageName}`);
    return `Stopped ${packageName}`;
  }

  async resetAppData(packageName: string): Promise<string> {
    await this.adb.shell(`pm clear ${packageName}`);
    return `Reset data for ${packageName}`;
  }
}
