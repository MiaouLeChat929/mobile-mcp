import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import { RealAdbClient } from "./infra/RealAdbClient";
import { RealFlutterRunner } from "./infra/RealFlutterRunner";
import { RealVmServiceClient } from "./infra/RealVmServiceClient";
import { ReleaseEngine } from "./services/ReleaseEngine";
import { DevEngine } from "./services/DevEngine";
import { VisionService } from "./services/VisionService";
import { InteractionService } from "./services/InteractionService";
import { ReportingService } from "./services/ReportingService";
import { AdbClient, VmServiceClient } from "./core/interfaces";

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
    const visionService = deps.visionService || new VisionService(adbClient, devEngine, () => new RealVmServiceClient());
    const interactionService = deps.interactionService || new InteractionService(adbClient, visionService);
    const reportingService = deps.reportingService || new ReportingService();

    // --- Group A: Lifecycle ---

    server.tool(
        "build_app",
        "Compile the Flutter application (APK).",
        {
            mode: z.enum(["debug", "profile"]).default("debug"),
            target: z.string().default("lib/main.dart").describe("Path to main entry point")
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

    server.tool(
        "install_app",
        "Install the APK via ADB.",
        {
            apk_path: z.string(),
            clean: z.boolean().default(false).describe("Uninstall before installing"),
            grant_permissions: z.boolean().default(true)
        },
        async ({ apk_path, clean, grant_permissions }) => {
            const res = await releaseEngine.installApp(apk_path, clean, grant_permissions);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "launch_app",
        "Launch the application activity.",
        {
            package_name: z.string(),
            wait_for_render: z.boolean().default(true)
        },
        async ({ package_name, wait_for_render }) => {
            const res = await releaseEngine.launchApp(package_name, wait_for_render);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "stop_app",
        "Force stop the application.",
        { package_name: z.string() },
        async ({ package_name }) => {
            const res = await releaseEngine.stopApp(package_name);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "reset_app_data",
        "Clear app data and cache.",
        { package_name: z.string() },
        async ({ package_name }) => {
            const res = await releaseEngine.resetAppData(package_name);
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group B: Dev Session ---

    server.tool(
        "start_dev_session",
        "Start a 'flutter run --machine' session.",
        { device_id: z.string() },
        async ({ device_id }) => {
            const res = await devEngine.startDevSession(device_id);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "hot_reload",
        "Trigger Hot Reload.",
        { reason: z.string().optional() },
        async ({ reason }) => {
            const res = await devEngine.hotReload(reason || "agent request");
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "hot_restart",
        "Trigger Hot Restart.",
        {},
        async () => {
            const res = await devEngine.hotRestart();
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "stop_dev_session",
        "Stop the current flutter process.",
        {},
        async () => {
            const res = await devEngine.stopDevSession();
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group C: Vision & Inspection ---

    server.tool(
        "get_semantic_tree",
        "Get the simplified semantic tree of UI elements.",
        {},
        async () => {
            try {
                const tree = await visionService.getSemanticTree();
                return { content: [{ type: "text", text: JSON.stringify(tree, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error getting tree: ${e.message}` }], isError: true };
            }
        }
    );

    server.tool(
        "find_element",
        "Wait for an element to appear.",
        { criteria: z.string(), timeout_ms: z.number().default(5000) },
        async ({ criteria, timeout_ms }) => {
            const el = await visionService.findElement(criteria, timeout_ms);
            if (el) {
                return { content: [{ type: "text", text: `Found: ${JSON.stringify(el)}` }] };
            } else {
                return { content: [{ type: "text", text: "Element not found within timeout" }], isError: true };
            }
        }
    );

    server.tool(
        "take_screenshot",
        "Capture current screen state.",
        {},
        async () => {
            const path = await visionService.takeScreenshot();
            return { content: [{ type: "text", text: `Screenshot saved to: ${path}` }] };
        }
    );

    server.tool(
        "analyze_visual_state",
        "Analyze visual consistency (screenshot + tree).",
        {},
        async () => {
            const res = await visionService.analyzeVisualState();
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group D: Interaction ---

    server.tool(
        "tap_element",
        "Tap on an element or coordinate.",
        {
            finder: z.string().optional(),
            x: z.number().optional(),
            y: z.number().optional()
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

    server.tool(
        "input_text",
        "Type text (via ADB).",
        { text: z.string(), submit: z.boolean().default(false) },
        async ({ text, submit }) => {
            const res = await interactionService.inputText(text, submit);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "scroll_to",
        "Scroll in a direction.",
        { direction: z.enum(["up", "down", "left", "right"]), finder: z.string().optional() },
        async ({ direction, finder }) => {
            const res = await interactionService.scrollTo(direction, finder);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "handle_system_dialog",
        "Handle native popups.",
        { action: z.enum(["accept", "deny"]) },
        async ({ action }) => {
            const res = await interactionService.handleSystemDialog(action);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "inject_file",
        "Push a file to device.",
        { source: z.string(), target: z.string() },
        async ({ source, target }) => {
            const res = await interactionService.injectFile(source, target);
            return { content: [{ type: "text", text: res }] };
        }
    );

    // --- Group E: Reporting ---

    server.tool(
        "init_test_log",
        "Initialize a new test report.",
        { flow_name: z.string() },
        async ({ flow_name }) => {
            const res = reportingService.initTestLog(flow_name);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "log_step",
        "Start a new test step.",
        { number: z.number(), description: z.string() },
        async ({ number, description }) => {
            const res = reportingService.logStep(number, description);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "log_action",
        "Log an action within a step.",
        {
            command: z.string(),
            result: z.string(),
            level: z.enum(["INFO", "WARN", "ERROR", "DEBUG"]).default("INFO"),
            screenshot: z.string().optional()
        },
        async ({ command, result, level, screenshot }) => {
            const res = reportingService.logAction(command, result, level, screenshot);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "finalize_log",
        "Close the test report.",
        { status: z.enum(["PASSED", "FAILED"]), summary: z.string() },
        async ({ status, summary }) => {
            const res = reportingService.finalizeLog(status, summary);
            return { content: [{ type: "text", text: res }] };
        }
    );

    server.tool(
        "get_crash_logs",
        "Retrieve recent crash logs.",
        {},
        async () => {
            const res = reportingService.getCrashLogs();
            return { content: [{ type: "text", text: res }] };
        }
    );

    return server;
};
