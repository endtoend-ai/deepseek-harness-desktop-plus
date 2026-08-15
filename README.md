# DeepSeek Harness Desktop

English | [中文](README.zh.md)

An installable desktop application for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with a bundled runtime, native window and tray integration, local service management, appearance customization, and packaged-app updates.

**Developer preview:** The current source version is `0.1.0-rc.5`, and interfaces, packaging, and plugin behavior may change before a stable release.

<p align="center">
  <img src="assets/desktop-preview.png" alt="DeepSeek Harness Desktop interface" width="100%">
</p>

## Why this project

The upstream DeepSeek Harness starts a local Web UI from the command line. DeepSeek Harness Desktop packages that experience as an Electron application: an installed build starts and supervises its own local Harness Host, opens the UI in a native window, and remains available from the system tray without requiring the user to install Node.js or run terminal commands.

## Features

- **Ready-to-use desktop packaging** — installed builds include the Harness runtime and Web UI.
- **Local Host lifecycle** — the Electron main process starts `dsh web` on an OS-assigned loopback port, waits for readiness, and shuts it down cleanly when the app exits.
- **Native desktop behavior** — single-instance launch, system tray restore and quit, platform-specific window chrome, and external links opened in the system browser.
- **Full Harness workspace** — sessions, workspaces, agent presets, model settings, tools, skills, and the Cordis-based plugin runtime remain available through the upstream Web UI.
- **Desktop customization** — choose a local background, adjust its focus and glass strength, or restore the bundled default. The selected image is processed locally and stored under Electron's private user-data directory.
- **Optional image understanding** — users can enable Bailian Qwen3.8 vision with their own DashScope credential so text-only agents can inspect supported workspace images.
- **In-app updates** — packaged macOS and Windows builds can check, download, and install releases from the configured desktop update channel.
- **Current plugin controls** — Settings includes plugin configuration and a searchable, read-only view of the active Loader inventory.

## Plugin center status

The repository already keeps the Harness plugin architecture intact. The desktop marketplace and mutation controls are the next product milestone; they are not presented as complete in the current preview.

| Available now | In development |
| --- | --- |
| Cordis plugins, Profiles, and Bundles | Curated popular-plugin catalog |
| Plugin configuration in Settings | One-click install, enable, disable, update, and uninstall |
| Searchable read-only runtime inventory | Compatibility checks, controlled Host restart, and rollback |

The first marketplace version is intended to install reviewed, version-pinned artifacts rather than accept arbitrary npm names, Git URLs, or local paths.

<a id="run"></a>

## Download

Preview builds are available from [deepseekdesktop.com](https://deepseekdesktop.com).

| Platform | Current status |
| --- | --- |
| macOS Apple Silicon | Preview build; signed and notarized DMG/ZIP release path is implemented |
| Windows 10/11 x64 | Preview NSIS installer; production Authenticode signing is pending |
| macOS Intel | Planned |
| Linux | Source and unpacked-app path only; no installer release yet |

After installation, follow the in-app onboarding to configure a supported model provider. Model requests leave the device for the provider selected by the user; optional Qwen vision requests use Alibaba Cloud Bailian.

## Run from source

### Requirements

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

```sh
git clone https://github.com/fufankeji/deepseek-harness-app.git
cd deepseek-harness-app
pnpm install
pnpm run dev:desktop
```

`dev:desktop` builds the workspace, Web frontend, and Electron main process before launching the application.

### Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm run dev:desktop` | Build and launch the desktop app from source |
| `pnpm run package:desktop` | Create an unpacked app for the current platform |
| `pnpm run dist:mac:desktop` | Build the signed and notarized macOS DMG and update ZIP; release credentials are required |
| `pnpm run dist:win:desktop` | Build the Windows x64 NSIS installer and update metadata |
| `pnpm run typecheck` | Run the repository TypeScript checks |
| `pnpm run test` | Run the keyless Vitest unit suite |

## Architecture

```text
Electron main process
├── window, tray, update, and appearance owners
├── fixed sandboxed preload bridge
└── HostSupervisor
    └── dsh web on 127.0.0.1:<dynamic-port>
        ├── Cordis plugin runtime
        └── React Web UI loaded by the desktop window
```

The desktop window accepts navigation only from the current loopback Host origin. The renderer uses `contextIsolation: true`, `nodeIntegration: false`, and Electron sandboxing; the preload exposes fixed appearance and update methods instead of generic IPC access.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `apps/desktop/` | Electron main process, preload, lifecycle, packaging, and update publishing |
| `apps/web/` | Browser application entry and desktop-aware Web composition |
| `apps/cli/` | `dsh` CLI, Profiles, and plugin commands |
| `packages/` | Harness Host, client, agent, tool, session, plugin, and SDK packages |
| `native/` | Native sandbox helper source |
| `python/` | Python SDK and bundled runtime |
| `vendor/` | Pinned Cordis foundation source and license records |

## Community

Use the community channels for setup help, plugin development, and project updates.

<table>
  <thead>
    <tr>
      <th align="center">WeChat group</th>
      <th align="center">QQ group</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wechat-group.png" alt="DeepSeek Harness Desktop WeChat group QR code" width="180" height="180"></td>
      <td align="center"><img src="assets/community-qq-group.jpg" alt="DeepSeek Harness Desktop QQ group QR code" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

Discord: [Join the DeepSeek Harness Desktop community](https://discord.gg/TJeGqKRNM)

## Relationship to DeepSeek Harness

This repository is built from [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness). The Harness core, Cordis plugin system, and Web UI originate upstream; this project owns the Electron shell, local Host supervision, desktop customization, platform packaging, and desktop release channel.

This is an independent community project and is not an official DeepSeek product. DeepSeek and related names belong to their respective owners.

## License

The project is distributed under the [MIT License](LICENSE). Third-party components retain their own notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
