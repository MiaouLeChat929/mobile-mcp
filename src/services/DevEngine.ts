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
    let buffer = '';
    const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

    stream.on('data', (chunk) => {
      buffer += chunk.toString();

      // Safety check for runaway buffer
      if (buffer.length > MAX_BUFFER_SIZE) {
        console.error('DevEngine: Buffer exceeded 1MB, clearing to prevent memory leak.');
        buffer = ''; // Discard buffer. This might lose a frame, but protects the process.
        return;
      }

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);

        if (line.trim()) {
            try {
                const event = JSON.parse(line);
                this.handleFlutterEvent(event);
            } catch (e) {
                // Not JSON, maybe raw text
            }
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