import { Readable } from 'stream';
import { FlutterRunner } from '../../src/core/interfaces';

export class MockFlutterRunner implements FlutterRunner {
  public isRunning = false;
  public stdout = new Readable({ read() {} });
  public stderr = new Readable({ read() {} });
  public vmServiceUri = "ws://127.0.0.1:1234/ws";
  public logs: string[] = [];

  async spawn(args: string[]): Promise<void> {
    this.isRunning = true;
    this.logs.push(`spawn: ${args.join(' ')}`);
    // Simulate flutter run --machine output
    this.stdout.push(JSON.stringify({
      event: "daemon.connected",
      params: { version: "1.2.3", pid: 12345 }
    }) + "\n");

    setTimeout(() => {
      this.stdout.push(JSON.stringify({
        event: "app.debugPort",
        params: { wsUri: this.vmServiceUri }
      }) + "\n");
      this.stdout.push(JSON.stringify({
        event: "app.started"
      }) + "\n");
    }, 10);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logs.push("stop");
    this.stdout.push(null); // Close stream
  }

  async hotReload(): Promise<string> {
    this.logs.push("hotReload");
    this.stdout.push(JSON.stringify({ event: "app.progress", params: { message: "Hot reload performed" } }) + "\n");
    return ""; // Success
  }

  async hotRestart(): Promise<void> {
    this.logs.push("hotRestart");
    this.stdout.push(JSON.stringify({ event: "app.progress", params: { message: "Hot restart performed" } }) + "\n");
  }

  async getVmServiceUri(): Promise<string | null> {
    return this.vmServiceUri;
  }

  getStdout(): Readable {
    return this.stdout;
  }

  getStderr(): Readable {
    return this.stderr;
  }
}
