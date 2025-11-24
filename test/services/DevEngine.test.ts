import { DevEngine } from '../../src/services/DevEngine';
import { FlutterRunner } from '../../src/core/interfaces';
import { Readable, PassThrough } from 'stream';
import assert from 'assert';

// Local mock to allow fine-grained stream control for these specific tests
class MockFlutterRunner implements FlutterRunner {
  public stdout = new PassThrough();
  public stderr = new PassThrough();

  async spawn(args: string[]): Promise<void> {}
  async stop(): Promise<void> {}
  async hotReload(): Promise<string> { return ""; }
  async hotRestart(): Promise<void> {}
  async getVmServiceUri(): Promise<string | null> { return null; }
  getStdout(): Readable { return this.stdout; }
  getStderr(): Readable { return this.stderr; }
}

describe('DevEngine Stream Parsing', () => {
  let devEngine: DevEngine;
  let mockRunner: MockFlutterRunner;

  beforeEach(() => {
    mockRunner = new MockFlutterRunner();
    devEngine = new DevEngine(() => mockRunner);
  });

  it('should parse VM Service URI from split chunks', async () => {
    await devEngine.startDevSession('test-device');

    // Simulate a JSON packet split across two TCP chunks
    const part1 = '{"event":"app.debugPort","params":{"wsUri":"ws://127.0.0.1:1234/ws"}}'.substring(0, 20);
    const part2 = '{"event":"app.debugPort","params":{"wsUri":"ws://127.0.0.1:1234/ws"}}'.substring(20) + '\n';

    mockRunner.stdout.write(part1);
    mockRunner.stdout.write(part2);

    // Give the event loop a moment to process
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(devEngine.getVmServiceUri(), "ws://127.0.0.1:1234/ws");
  });

  it('should handle multiple lines in one chunk', async () => {
    await devEngine.startDevSession('test-device');

    const line1 = JSON.stringify({ event: 'app.start' }) + '\n';
    const line2 = JSON.stringify({ event: 'app.debugPort', params: { wsUri: 'ws://valid' } }) + '\n';

    mockRunner.stdout.write(line1 + line2);

    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(devEngine.getVmServiceUri(), "ws://valid");
  });

  it('should handle buffer cleaning to prevent memory leaks', async () => {
    await devEngine.startDevSession('test-device');

    // Write a huge chunk without newline to trigger the safety valve
    const hugeChunk = 'a'.repeat(1024 * 1024 + 10); // > 1MB
    mockRunner.stdout.write(hugeChunk);

    const validLine = JSON.stringify({ event: 'app.debugPort', params: { wsUri: 'ws://recovered' } }) + '\n';
    mockRunner.stdout.write(validLine);

    await new Promise(resolve => setTimeout(resolve, 50));

    // If buffer was cleared, we should successfully process the new valid line
    assert.strictEqual(devEngine.getVmServiceUri(), "ws://recovered");
  });
});