# Mobile Next - Android MCP Server for AI Agents

**Strict Protocol Safety | Headless | Android Focused**

This is a [Model Context Protocol (MCP) server](https://github.com/modelcontextprotocol) designed to empower AI Agents to interact with Android devices (Emulators & Real Devices) in a robust, headless environment.

It acts as a bridge between your Agent (Claude, Cursor, etc.) and the Android ecosystem, providing structured tools for:
*   **App Management**: Build, Install, Launch, Reset.
*   **Development**: Flutter `run --machine` integration, Hot Reload/Restart.
*   **Vision & Inspection**: Intelligent Semantic Tree extraction, Screenshots, and Visual Analysis.
*   **Interaction**: Taps, Text Input, Swipes, and System Dialog handling.
*   **Reporting**: Structured test logging and crash reporting.

<h4 align="center">
  <a href="https://github.com/mobile-next/mobile-mcp">
    <img src="https://img.shields.io/github/stars/mobile-next/mobile-mcp" alt="Mobile Next Stars" />
  </a>
  <a href="https://www.npmjs.com/package/@mobilenext/mobile-mcp">
    <img src="https://img.shields.io/npm/dm/@mobilenext/mobile-mcp?logo=npm&style=flat&color=red" alt="npm" />
  </a>
</h4>

<p align="center">
    <a href="https://github.com/mobile-next/">
        <img alt="mobile-mcp" src="https://raw.githubusercontent.com/mobile-next/mobile-next-assets/refs/heads/main/mobile-mcp-banner.png" width="600" />
    </a>
</p>

## 🚀 New Global Approach

This project has evolved to prioritize **Protocol Safety** and **Headless Operation**.
*   **Strict Type Safety**: All tools use strict Zod schemas.
*   **No Pollution**: Standard Output (`stdout`) is reserved exclusively for JSON-RPC protocol messages. All logging goes to `stderr`.
*   **Android Centric**: Optimized for ADB-based workflows. (iOS support is currently archived).

## ✨ Key Features

*   **Headless First**: Designed to run on CI/CD servers or background processes without manual intervention.
*   **Visual Sense**: Instead of blind coordinates, use `get_semantic_tree` to understand the UI structure or `find_element` to wait for specific widgets.
*   **Smart Interactions**: Handle system dialogs ("Allow", "Deny") automatically via XML hierarchy parsing.
*   **Flutter Integrated**: Direct support for Flutter development workflows (Hot Reload, DevTools URI extraction).

## 🔧 Installation

### Prerequisites
*   **Node.js** v18+
*   **Android Platform Tools** (ADB installed and in PATH)
*   **Flutter SDK** (Optional, for building/running Flutter apps)

### Quick Start (npx)
You can run the server directly using `npx`:

```bash
npx -y @mobilenext/mobile-mcp@latest
```

## ⚙️ Configuration

Add the server to your AI Assistant's configuration file.

### Cursor / VS Code
Add to your MCP settings:

```json
{
  "mcpServers": {
    "mobile-mcp": {
      "command": "npx",
      "args": ["-y", "@mobilenext/mobile-mcp@latest"]
    }
  }
}
```

### Claude Desktop
```bash
claude mcp add mobile-mcp -- npx -y @mobilenext/mobile-mcp@latest
```

## 🛠️ Tool Reference

The server exposes a comprehensive suite of tools. Ask your agent to "List tools" to see the live schema.

| Category | Tools | Description |
| :--- | :--- | :--- |
| **Lifecycle** | `build_app`, `install_app`, `launch_app` | Compile APKs, install via ADB, launch activities. |
| **Dev Session** | `start_dev_session`, `hot_reload`, `stop_dev_session` | Manage `flutter run` sessions and hot reloads. |
| **Vision** | `get_semantic_tree`, `take_screenshot`, `find_element` | See the screen via Accessibility Tree or Pixels. |
| **Interaction** | `tap_element`, `input_text`, `scroll_to`, `handle_system_dialog` | Interact with the device UI naturally. |
| **Reporting** | `init_test_log`, `log_step`, `finalize_log` | Generate markdown test reports for your agentic flows. |

## 🏗️ Architecture

The server operates in two modes:
1.  **Release Engine**: Uses `adb` directly for installed apps.
2.  **Dev Engine**: Wraps `flutter run --machine` to provide real-time development features (Hot Reload, DevTools).

## 🤝 Contributing

We welcome contributions! Please adhere to the **Protocol Safety** rules:
*   Never use `console.log` (use `console.error`).
*   Always validate changes with `@modelcontextprotocol/inspector`.

License: Apache 2.0
