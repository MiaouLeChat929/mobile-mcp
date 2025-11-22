import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import { RealAdbClient } from "./infra/RealAdbClient";
import { RealFlutterRunner } from "./infra/RealFlutterRunner";
import { ReleaseEngine } from "./services/ReleaseEngine";
import { DevEngine } from "./services/DevEngine";
import { VisionService } from "./services/VisionService";
import { InteractionService } from "./services/InteractionService";
import { ReportingService } from "./services/ReportingService";
import { AdbClient, VmServiceClient } from "./core/interfaces";

// Mock VmServiceClient for now as we don't have a real implementation in infra yet
// In a real app, this would be imported from src/infra/RealVmServiceClient
class NoOpVmServiceClient implements VmServiceClient {
    async connect(uri: string) {}
    async disconnect() {}
    async getRenderObjectDiagnostics(depth: number) { return { type: "Error", error: "Not implemented in this environment" }; }
    async evaluate(expr: string) { return null; }
}

export const getAgentVersion = (): string => {
    try {
        const json = require("../package.json");
        return json.version;
    } catch (e) {
        return "0.0.1";
    }
};

export interface ServerDependencies {
    adbClient?: AdbClient;
    releaseEngine?: ReleaseEngine;
    devEngine?: DevEngine;
    visionService?: VisionService;
    interactionService?: InteractionService;
    reportingService?: ReportingService;
}

export const createMcpServer = (deps: ServerDependencies = {}): McpServer => {
    const server = new McpServer({
        name: "flutter-commander",
        version: getAgentVersion(),
    });

    // DI Setup
    const adbClient = deps.adbClient || new RealAdbClient();
    const releaseEngine = deps.releaseEngine || new ReleaseEngine(adbClient);
    const devEngine = deps.devEngine || new DevEngine(() => new RealFlutterRunner());
    const visionService = deps.visionService || new VisionService(adbClient, devEngine, () => new NoOpVmServiceClient());
    const interactionService = deps.interactionService || new InteractionService(adbClient, visionService);
    const reportingService = deps.reportingService || new ReportingService(adbClient);

    // --- Group A: Lifecycle ---

    server.registerTool(
        "build_app",
        {
            title: "Build Flutter App",
            description: "Compile the Flutter application (APK).",
            inputSchema: {
                mode: z.enum(["debug", "profile"]).default("debug"),
                target: z.string().default("lib/main.dart").describe("Path to main entry point")
            }
        },
        async ({ mode, target }) => {
            const result = await releaseEngine.buildApp(mode, target);
            if (result.success) {
                return { content: [{ type: "text", text: `Build Successful: ${result.apkPath}` }] };
            } else {
                return { content: [{ type: "text", text: `Build Failed: ${result.error}` }], isError: true };
            }
        }
    );

    server.registerTool(
        "install_app",
        {
            title: "Install APK",
            description: "Install the APK via ADB.",
            inputSchema: {
                apk_path: z.string(),
                clean: z.boolean().default(false).describe("Uninstall before installing"),
                grant_permissions: z.boolean().default(true)
            }
        },
        async ({ apk_path, clean, grant_permissions }) => {
            const res = await releaseEngine.installApp(apk_path, clean, grant_permissions);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "launch_app",
        {
            title: "Launch App",
            description: "Launch the application activity.",
            inputSchema: {
                package_name: z.string(),
                wait_for_render: z.boolean().default(true)
            }
        },
        async ({ package_name, wait_for_render }) => {
            const res = await releaseEngine.launchApp(package_name, wait_for_render);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "stop_app",
        {
            title: "Stop App",
            description: "Force stop the application.",
            inputSchema: {
                package_name: z.string()
            }
        },
        async ({ package_name }) => {
            const res = await releaseEngine.stopApp(package_name);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "reset_app_data",
        {
            title: "Reset App Data",
            description: "Clear app data and cache.",
            inputSchema: {
                package_name: z.string()
            }
        },
        async ({ package_name }) => {
            const res = await releaseEngine.resetAppData(package_name);
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group B: Dev Session ---

    server.registerTool(
        "start_dev_session",
        {
            title: "Start Dev Session",
            description: "Start a 'flutter run --machine' session.",
            inputSchema: {
                device_id: z.string()
            }
        },
        async ({ device_id }) => {
            const res = await devEngine.startDevSession(device_id);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "hot_reload",
        {
            title: "Hot Reload",
            description: "Trigger Hot Reload.",
            inputSchema: {
                reason: z.string().optional()
            }
        },
        async ({ reason }) => {
            const res = await devEngine.hotReload(reason || "agent request");
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "hot_restart",
        {
            title: "Hot Restart",
            description: "Trigger Hot Restart.",
            inputSchema: {}
        },
        async () => {
            const res = await devEngine.hotRestart();
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "stop_dev_session",
        {
            title: "Stop Dev Session",
            description: "Stop the current flutter process.",
            inputSchema: {}
        },
        async () => {
            const res = await devEngine.stopDevSession();
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group C: Vision & Inspection ---

    server.registerTool(
        "get_semantic_tree",
        {
            title: "Get Semantic Tree",
            description: "Get the simplified semantic tree of UI elements.",
            inputSchema: {}
        },
        async () => {
            try {
                const tree = await visionService.getSemanticTree();
                return { content: [{ type: "text", text: JSON.stringify(tree, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error getting tree: ${e.message}` }], isError: true };
            }
        }
    );

    server.registerTool(
        "find_element",
        {
            title: "Find Element",
            description: "Wait for an element to appear.",
            inputSchema: {
                criteria: z.string(),
                timeout_ms: z.number().default(5000)
            }
        },
        async ({ criteria, timeout_ms }) => {
            const el = await visionService.findElement(criteria, timeout_ms);
            if (el) {
                return { content: [{ type: "text", text: `Found: ${JSON.stringify(el)}` }] };
            } else {
                return { content: [{ type: "text", text: "Element not found within timeout" }], isError: true };
            }
        }
    );

    server.registerTool(
        "take_screenshot",
        {
            title: "Take Screenshot",
            description: "Capture current screen state.",
            inputSchema: {}
        },
        async () => {
            const path = await visionService.takeScreenshot();
            return { content: [{ type: "text", text: `Screenshot saved to: ${path}` }] };
        }
    );

    server.registerTool(
        "analyze_visual_state",
        {
            title: "Analyze Visual State",
            description: "Analyze visual consistency (screenshot + tree).",
            inputSchema: {}
        },
        async () => {
            const res = await visionService.analyzeVisualState();
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group D: Interaction ---

    server.registerTool(
        "tap_element",
        {
            title: "Tap Element",
            description: "Tap on an element or coordinate.",
            inputSchema: {
                finder: z.string().optional(),
                x: z.number().optional(),
                y: z.number().optional()
            }
        },
        async ({ finder, x, y }) => {
            let res;
            if (x !== undefined && y !== undefined) {
                res = await interactionService.tapElement({ x, y });
            } else if (finder) {
                res = await interactionService.tapElement(finder);
            } else {
                throw new Error("Must provide either finder or x,y coordinates");
            }
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "input_text",
        {
            title: "Input Text",
            description: "Type text (via ADB).",
            inputSchema: {
                text: z.string(),
                submit: z.boolean().default(false)
            }
        },
        async ({ text, submit }) => {
            const res = await interactionService.inputText(text, submit);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "scroll_to",
        {
            title: "Scroll To",
            description: "Scroll in a direction.",
            inputSchema: {
                direction: z.enum(["up", "down", "left", "right"]),
                finder: z.string().optional()
            }
        },
        async ({ direction, finder }) => {
            const res = await interactionService.scrollTo(direction, finder);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "handle_system_dialog",
        {
            title: "Handle System Dialog",
            description: "Handle native popups.",
            inputSchema: {
                action: z.enum(["accept", "deny"])
            }
        },
        async ({ action }) => {
            const res = await interactionService.handleSystemDialog(action);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "inject_file",
        {
            title: "Inject File",
            description: "Push a file to device.",
            inputSchema: {
                source: z.string(),
                target: z.string()
            }
        },
        async ({ source, target }) => {
            const res = await interactionService.injectFile(source, target);
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group E: Reporting ---

    server.registerTool(
        "init_test_log",
        {
            title: "Init Test Log",
            description: "Initialize a new test report.",
            inputSchema: {
                flow_name: z.string()
            }
        },
        async ({ flow_name }) => {
            const res = reportingService.initTestLog(flow_name);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "log_step",
        {
            title: "Log Step",
            description: "Start a new test step.",
            inputSchema: {
                number: z.number(),
                description: z.string()
            }
        },
        async ({ number, description }) => {
            const res = reportingService.logStep(number, description);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "log_action",
        {
            title: "Log Action",
            description: "Log an action within a step.",
            inputSchema: {
                command: z.string(),
                result: z.string(),
                level: z.enum(["INFO", "WARN", "ERROR", "DEBUG"]).default("INFO"),
                screenshot: z.string().optional()
            }
        },
        async ({ command, result, level, screenshot }) => {
            const res = reportingService.logAction(command, result, level, screenshot);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "finalize_log",
        {
            title: "Finalize Log",
            description: "Close the test report.",
            inputSchema: {
                status: z.enum(["PASSED", "FAILED"]),
                summary: z.string()
            }
        },
        async ({ status, summary }) => {
            const res = reportingService.finalizeLog(status, summary);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.registerTool(
        "get_crash_logs",
        {
            title: "Get Crash Logs",
            description: "Retrieve recent crash logs.",
            inputSchema: {}
        },
        async () => {
            const res = await reportingService.getCrashLogs();
            return { content: [{ type: "text", text: res }] };
        }
    );

    return server;
};
