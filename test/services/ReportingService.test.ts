import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { ReportingService } from '../../src/services/ReportingService';

describe('ReportingService', () => {
    let reportingService: ReportingService;
    const flowName = "test_flow";

    beforeEach(() => {
        reportingService = new ReportingService();
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
});
