import assert from 'assert';
import { DevEngine } from '../../src/services/DevEngine';
import { MockFlutterRunner } from '../mocks/MockFlutterRunner';

describe('DevEngine', () => {
    it('should capture VM Service URI from stdout stream', async () => {
        const mockRunner = new MockFlutterRunner();
        const devEngine = new DevEngine(() => mockRunner);

        await devEngine.startDevSession("test_device");

        // Wait for the stream event (simulated in spawn with setTimeout 10ms)
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.strictEqual(devEngine.getVmServiceUri(), mockRunner.vmServiceUri);
    });

    it('should expose the runner', async () => {
        const mockRunner = new MockFlutterRunner();
        const devEngine = new DevEngine(() => mockRunner);
        await devEngine.startDevSession("d1");
        assert.strictEqual(devEngine.getRunner(), mockRunner);
    });
});
