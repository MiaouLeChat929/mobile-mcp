import { FlutterRunner } from '../core/interfaces';
import { Readable } from 'stream';

export class DevEngine {
  private currentProcess: FlutterRunner | null = null;
  private deviceId: string | null = null;
  private vmServiceUri: string | null = null;

  constructor(private runnerFactory: () => FlutterRunner) {}

  async startDevSession(deviceId: string): Promise<string> {
    if (this.currentProcess) {
      await this.stopDevSession();
    }

    this.deviceId = deviceId;
    this.vmServiceUri = null;
    this.currentProcess = this.runnerFactory();

    // Start flutter run --machine
    await this.currentProcess.spawn(['run', '--machine', '-d', deviceId]);

    // We need to listen to stdout to capture the VM Service URI
    // This logic handles the stream processing
    this.setupStreamListeners(this.currentProcess.getStdout());

    return "Dev session started on " + deviceId;
  }

  private setupStreamListeners(stream: Readable) {
    stream.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          this.handleFlutterEvent(event);
        } catch (e) {
          // Not JSON, maybe raw text
        }
      }
    });
  }

  private handleFlutterEvent(event: any) {
    if (event.event === 'app.debugPort') {
       // Store WS URI for VisionService
       this.vmServiceUri = event.params.wsUri;
    }
    // Handle other events like app.started, etc.
  }

  async hotReload(reason: string): Promise<string> {
    if (!this.currentProcess) throw new Error("No active dev session");
    const error = await this.currentProcess.hotReload();
    if (error) return `Hot Reload failed: ${error}`;
    return "Hot Reload successful";
  }

  async hotRestart(): Promise<string> {
    if (!this.currentProcess) throw new Error("No active dev session");
    await this.currentProcess.hotRestart();
    return "Hot Restart successful";
  }

  async stopDevSession(): Promise<string> {
    if (this.currentProcess) {
      await this.currentProcess.stop();
      this.currentProcess = null;
      return "Dev session stopped";
    }
    return "No active session";
  }

  // Expose the runner so VisionService can get the VM Service URI
  public getRunner(): FlutterRunner | null {
    return this.currentProcess;
  }

  public getVmServiceUri(): string | null {
    return this.vmServiceUri;
  }
}
