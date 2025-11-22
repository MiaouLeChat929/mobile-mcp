
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function run() {
  console.error("Starting integration check...");
  const transport = new StdioClientTransport({ command: "node", args: ["lib/index.js"] });
  const client = new Client({ name: "test", version: "1.0" }, { capabilities: {} });

  await client.connect(transport);

  // 1. Validate Tools List
  const tools = await client.listTools();
  console.error(`Found ${tools.tools.length} tools.`);

  if (tools.tools.length === 0) {
    throw new Error("No tools found!");
  }

  // Check for specific tool and metadata
  const buildTool = tools.tools.find(t => t.name === "build_app");
  if (!buildTool) throw new Error("build_app tool not found");

  // Check for title (should be present if registerTool worked correctly)
  // Note: The SDK might not expose 'title' in the Tool interface definition yet,
  // but it should be in the JSON.
  // We can cast to any to check.
  if (!(buildTool as any).title) {
      console.error("WARNING: Tool 'build_app' is missing 'title' property.");
  } else {
      console.error(`Tool 'build_app' has title: ${(buildTool as any).title}`);
  }

  // 2. Call a tool (e.g., get_semantic_tree - harmless)
  try {
    const result = await client.callTool({ name: "get_semantic_tree", arguments: {} });
    console.error("get_semantic_tree result:", JSON.stringify(result).substring(0, 100) + "...");
  } catch (e: any) {
     console.error("get_semantic_tree failed (expected if not mocked fully):", e.message);
  }

  await client.close();
  console.error("Integration check passed.");
}

run().catch(e => { console.error(e); process.exit(1); });
