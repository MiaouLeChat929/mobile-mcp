import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { ReportingService } from '../../src/services/ReportingService';
import { MockAdbClient } from '../mocks/MockAdbClient';

describe('ReportingService', () => {
    let reportingService: ReportingService;
    let mockAdb: MockAdbClient;
    const flowName = "test_flow";

    beforeEach(() => {
        mockAdb = new MockAdbClient();
        reportingService = new ReportingService(mockAdb);
    });

    afterEach(() => {
        // Clean up generated files
        const resultsDir = path.join('gatest', 'results');
        if (fs.existsSync(resultsDir)) {
            fs.rmSync(resultsDir, { recursive: true, force: true });
        }
    });

    it('should create a log file', () => {
        const msg = reportingService.initTestLog(flowName);
        assert.ok(msg.includes(flowName));

        const resultsDir = path.join('gatest', 'results');
        const files = fs.readdirSync(resultsDir);
        assert.strictEqual(files.length, 1);
        assert.ok(files[0].startsWith(flowName));
        assert.ok(files[0].endsWith('_log.md'));
    });

    it('should log steps and actions', () => {
        reportingService.initTestLog(flowName);
        reportingService.logStep(1, "Open App");
        reportingService.logAction("launch_app", "Success");

        const msg = reportingService.finalizeLog("PASSED", "All good");
        assert.ok(msg.includes("PASSED"));

        const resultsDir = path.join('gatest', 'results');
        const files = fs.readdirSync(resultsDir);
        const content = fs.readFileSync(path.join(resultsDir, files[0]), 'utf8');

        assert.ok(content.includes("# Test Report: test_flow"));
        assert.ok(content.includes("### Step 1: Open App"));
        assert.ok(content.includes("Action: launch_app -> Success"));
        assert.ok(content.includes("**Status:** PASSED"));
    });

    it('should retrieve and filter crash logs', async () => {
        mockAdb.shell = async (cmd) => {
            if (cmd.includes('logcat')) {
                return `
01-01 10:00:00.000 1000 1000 I InfoLog: Not interesting
01-01 10:00:01.000 1000 1000 E AndroidRuntime:E FATAL EXCEPTION: main
01-01 10:00:02.000 1000 1000 I flutter: Flutter error caught
01-01 10:00:03.000 1000 1000 I Other: Something else
                `.trim();
            }
            return "";
        };

        const logs = await reportingService.getCrashLogs();
        assert.ok(logs.includes("AndroidRuntime:E FATAL EXCEPTION"), "Should contain fatal exception");
        assert.ok(logs.includes("flutter: Flutter error caught"), "Should contain flutter error");
        assert.ok(!logs.includes("InfoLog"), "Should filter out info logs");
    });

    it('should return message when no crash logs found', async () => {
         mockAdb.shell = async () => "Just normal logs";
         const logs = await reportingService.getCrashLogs();
         assert.ok(logs.includes("No relevant crash logs"), "Should indicate no logs found");
    });
});
