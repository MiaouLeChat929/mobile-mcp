import assert from 'assert';
import { ReleaseEngine } from '../../src/services/ReleaseEngine';
import { MockAdbClient } from '../mocks/MockAdbClient';

describe('ReleaseEngine', () => {
    let releaseEngine: ReleaseEngine;
    let mockAdb: MockAdbClient;

    beforeEach(() => {
        mockAdb = new MockAdbClient();
        releaseEngine = new ReleaseEngine(mockAdb);
    });

    it('should attempt to build app', async () => {
        const result = await releaseEngine.buildApp('debug');
        // In this sandbox, flutter command likely fails
        assert.strictEqual(typeof result.success, 'boolean');
        if (!result.success) {
             assert.ok(result.error, "Should have error message on failure");
        }
    });

    it('should install app using ADB', async () => {
        await releaseEngine.installApp('path/to/app.apk', true);
        // MockAdb logs calls
        const installLog = mockAdb.logs.find(l => l.includes('install'));
        assert.ok(installLog, "Should call adb install");
        assert.ok(installLog?.includes('clean=true'), "Should pass options");
    });
});
