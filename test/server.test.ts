import assert from 'assert';
import { createMcpServer } from '../src/server';
import { MockAdbClient } from './mocks/MockAdbClient';
import { ReleaseEngine } from '../src/services/ReleaseEngine';
import { DevEngine } from '../src/services/DevEngine';
import { MockFlutterRunner } from './mocks/MockFlutterRunner';

describe('MCP Server Integration', () => {
    it('should initialize with dependencies', () => {
        const mockAdb = new MockAdbClient();
        const releaseEngine = new ReleaseEngine(mockAdb);
        const devEngine = new DevEngine(() => new MockFlutterRunner());

        const server = createMcpServer({
            adbClient: mockAdb,
            releaseEngine,
            devEngine
        });

        assert.ok(server, "Server should be created");
    });
});
