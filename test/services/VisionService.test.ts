import assert from 'assert';
import { VisionService } from '../../src/services/VisionService';
import { MockAdbClient } from '../mocks/MockAdbClient';
import { DevEngine } from '../../src/services/DevEngine';
import { MockFlutterRunner } from '../mocks/MockFlutterRunner';
import { MockVmServiceClient } from '../mocks/MockVmServiceClient';

describe('VisionService', () => {
    let visionService: VisionService;
    let mockAdb: MockAdbClient;
    let devEngine: DevEngine;
    let mockRunner: MockFlutterRunner;
    let mockVmClient: MockVmServiceClient;

    beforeEach(() => {
        mockAdb = new MockAdbClient();
        mockRunner = new MockFlutterRunner();
        // Pre-populate VM Service URI for the runner
        mockRunner.vmServiceUri = "ws://test";

        devEngine = new DevEngine(() => mockRunner);
        // Manually start session to populate runner in engine
        devEngine.startDevSession("test-device");
        // Mock the event that sets the port
        (devEngine as any).handleFlutterEvent({ event: 'app.debugPort', params: { wsUri: 'ws://test' } });

        mockVmClient = new MockVmServiceClient();
        visionService = new VisionService(mockAdb, devEngine, () => mockVmClient);
    });

    it('should filter raw widget tree into semantic nodes', async () => {
        const tree = await visionService.getSemanticTree();

        // Based on MockVmServiceClient's default data
        assert.ok(tree, "Tree should be returned");
        assert.strictEqual(tree.type, "Container"); // RenderView -> Container (simplifyType)

        // Check children
        assert.ok(tree.children && tree.children.length > 0);

        // "Scan Button" from RenderSemanticsAnnotations -> label="Scan Button"
        // The simplified logic should catch this.
        // Let's debug the tree structure if needed.
        // Mock returns: RenderView -> [RenderSemanticsAnnotations (label=Scan Button) -> ... -> RenderObject (desc...)]
        // filterIaTree should see RenderSemanticsAnnotations. extractText finds "Scan Button".
        // simplifyType(RenderSemanticsAnnotations) -> Unknown -> Container.
        // But isRelevant: text="Scan Button". So it should be kept.

        // Actually my simplifyType doesn't handle "RenderSemanticsAnnotations".
        // And extractText checks for properties.

        const scanButton = tree.children?.find(c => c.text === "Scan Button");
        assert.ok(scanButton, "Should find Scan Button");

        // "Welcome to Flutter" from RenderParagraph -> text="Welcome..."
        const textNode = tree.children?.find(c => c.text === "Welcome to Flutter");
        assert.ok(textNode, "Should find text node");
        assert.strictEqual(textNode?.type, "Text");
    });

    it('should find element by text', async () => {
        const found = await visionService.findElement("Scan Button", 100);
        assert.ok(found, "Should find element with text 'Scan Button'");
        assert.strictEqual(found?.text, "Scan Button");
    });

    it('should fallback to ADB dumpWindowHierarchy when no Dev Session is active', async () => {
        // Create a new DevEngine with no session
        const emptyDevEngine = new DevEngine(() => new MockFlutterRunner());
        // Do NOT start session

        // Override ADB dump for this test
        mockAdb.dumpWindowHierarchy = async () => `
            <hierarchy rotation="0">
                <node index="0" text="" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
                    <node index="0" text="Native Button" class="android.widget.Button" clickable="true" bounds="[100,100][300,200]" />
                </node>
            </hierarchy>
        `;

        const fallbackVision = new VisionService(mockAdb, emptyDevEngine, () => mockVmClient);

        const tree = await fallbackVision.getSemanticTree();

        assert.ok(tree, "Tree should be returned from ADB");
        assert.strictEqual(tree.type, "FrameLayout");
        assert.strictEqual(tree.children?.length, 1);
        assert.strictEqual(tree.children?.[0].type, "Button");
        assert.strictEqual(tree.children?.[0].text, "Native Button");
        assert.deepStrictEqual(tree.children?.[0].rect, { x: 100, y: 100, width: 200, height: 100 });
    });
});
