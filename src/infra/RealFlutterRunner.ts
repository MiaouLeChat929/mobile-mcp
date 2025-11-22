import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { FlutterRunner } from '../core/interfaces';

export class RealFlutterRunner implements FlutterRunner {
  private process: ChildProcess | null = null;
  private flutterPath: string;

  constructor() {
    this.flutterPath = process.env.FLUTTER_PATH || 'flutter';
  }

  async spawn(args: string[]): Promise<void> {
    this.process = spawn(this.flutterPath, args);

    // Log specific errors
    this.process.on('error', (err) => {
        console.error('Failed to start flutter process:', err);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
        this.process.kill();
        this.process = null;
    }
  }

  async hotReload(): Promise<string> {
    if (!this.process || !this.process.stdin) return "Process not running";
    this.process.stdin.write('r');
    return ""; // Success (async confirmation via stream ideally)
  }

  async hotRestart(): Promise<void> {
    if (!this.process || !this.process.stdin) return;
    this.process.stdin.write('R');
  }

  async getVmServiceUri(): Promise<string | null> {
    // This needs to be extracted from stdout stream in DevEngine
    // The Runner itself just manages the process.
    // But wait, `DevEngine` uses `runner.getStdout()` to find it.
    // The Interface says `getVmServiceUri`.
    // Realistically, `RealFlutterRunner` might track it too if it parses its own output?
    // Or we leave it to DevEngine to parse and just return null here or implement a listener?
    // Let's return null and let DevEngine handle the parsing logic which is the designated place.
    return null;
  }

  getStdout(): Readable {
    if (!this.process || !this.process.stdout) return new Readable({ read() {} });
    return this.process.stdout;
  }

  getStderr(): Readable {
    if (!this.process || !this.process.stderr) return new Readable({ read() {} });
    return this.process.stderr;
  }
}
