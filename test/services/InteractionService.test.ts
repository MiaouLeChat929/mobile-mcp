import assert from 'assert';
import { InteractionService } from '../../src/services/InteractionService';
import { MockAdbClient } from '../mocks/MockAdbClient';
import { VisionService } from '../../src/services/VisionService';
import { DevEngine } from '../../src/services/DevEngine';
import { MockFlutterRunner } from '../mocks/MockFlutterRunner';

describe('InteractionService', () => {
    let mockAdb: MockAdbClient;
    let devEngine: DevEngine;
    let visionService: VisionService;
    let interactionService: InteractionService;

    beforeEach(() => {
        mockAdb = new MockAdbClient();
        devEngine = new DevEngine(() => new MockFlutterRunner());
        // Mock VmServiceClient factory as well, though not used for system dialogs
        visionService = new VisionService(mockAdb, devEngine, () => ({} as any));
        interactionService = new InteractionService(mockAdb, visionService);
    });

    it('should parse system dialog XML and tap "Allow"', async () => {
        // Override dumpWindowHierarchy to return a dialog structure
        mockAdb.dumpWindowHierarchy = async () => `
            <hierarchy>
                <node bounds="[0,0][1080,1920]">
                    <node text="Allow access?" bounds="[100,100][900,400]" />
                    <node text="Allow" bounds="[600,1000][900,1150]" clickable="true" />
                    <node text="Deny" bounds="[200,1000][500,1150]" clickable="true" />
                </node>
            </hierarchy>
        `;

        const res = await interactionService.handleSystemDialog('accept');

        // bounds="[600,1000][900,1150]"
        // center x = 600 + 150 = 750
        // center y = 1000 + 75 = 1075
        assert.ok(res.includes("Tapped 'Allow' at 750,1075"));
        assert.ok(mockAdb.logs.includes("tap: 750,1075"));
    });

    it('should parse system dialog XML and tap "Deny"', async () => {
         mockAdb.dumpWindowHierarchy = async () => `
            <hierarchy>
                <node bounds="[0,0][1080,1920]">
                    <node text="Deny" bounds="[200,1000][500,1150]" clickable="true" />
                </node>
            </hierarchy>
        `;

        const res = await interactionService.handleSystemDialog('deny');
        // bounds="[200,1000][500,1150]" => center 350, 1075
        assert.ok(res.includes("Tapped 'Deny' at 350,1075"));
    });

    it('should throw if button not found', async () => {
        mockAdb.dumpWindowHierarchy = async () => `<hierarchy><node text="Nothing here" bounds="[0,0][100,100]" /></hierarchy>`;

        await assert.rejects(async () => {
            await interactionService.handleSystemDialog('accept');
        }, /Could not find button/);
    });
});
