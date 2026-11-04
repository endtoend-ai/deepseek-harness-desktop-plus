# DeepSeek Harness Desktop

<p>
  <img src="https://img.shields.io/badge/license-MIT-22C55E" alt="MIT License">
  <img src="https://img.shields.io/badge/desktop-Electron-47848F" alt="Electron desktop">
  <img src="https://img.shields.io/badge/upstream-dsh%200.2.1--rc.5-2563EB" alt="Upstream dsh 0.2.1-rc.5">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-3B82F6" alt="macOS and Windows">
</p>

DeepSeek Harness Desktop is a desktop application and product extension layer built on top of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

DeepSeek Harness provides the agent runtime: agents and sessions, model adapters, the tool runtime, attachments, subagents, presets, bundles, and the browser runtime. This repository keeps that runtime and adds what a desktop product needs on top of it:

- an Electron shell that starts and supervises a local Host, ships the Host runtime, and owns installation, recovery, and release workflows;
- product surfaces over the Harness client: plugin center and plugin discovery, Preset Square, Application Center, vision enhancement, skins and theming, and the LLM Wiki application;
- the workspace composition, build, and packaging scripts shared by the browser and desktop entry points.

This repository tracks upstream `dsh 0.2.1-rc.5`. The desktop application carries its own version (`apps/desktop`, currently `0.1.0-rc.19`). Desktop builds are development previews; see [Known limitations](#known-limitations).

## Features

Each capability below exists in source, is part of the desktop composition, and is reachable from the user interface.

| Capability | What it enables |
| --- | --- |
| **Desktop workspaces and sessions** | Open local projects through the native directory picker, organize and search sessions per workspace, and rename, archive, fork, or resume a session. |
| **Long-session outline and full-text jump** | Build a complete outline of a conversation by user, assistant, and tool turns; jumping to an entry loads older messages that were not rendered yet and highlights the matching text. |
| **Plugin discovery and Agent shortlisting** | Browse featured, recently updated, and ecosystem-popular plugins, filter by scenario, or describe a need and let the Agent shortlist candidates from the public `dsh-plugin` catalog. |
| **Trusted plugin lifecycle** | Review exact version, permissions, compatibility, and risk before installation; enable, disable, update, or uninstall afterwards; an unfinished transaction rolls back, and a runtime whose plugin record disagrees enters a safe mode that still allows disabling and uninstalling. |
| **Preset Square** | Browse built-in and community Agent Presets with their Skills, tools, and environment requirements, keep the installed list usable, and start new sessions from an installed Preset. Installing a new Preset is not available in this build. |
| **Application Center and LLM Wiki** | Launch complete AI applications that own their interface, data, and runtime flow from a first-class entry, with an optional sidebar shortcut. The first bundled application is the LLM Wiki knowledge base. |
| **Providers and local inference** | Configure DeepSeek and other compatible providers, or connect Ollama, vLLM, SGLang, and custom OpenAI-compatible services from one entry. |
| **Native and compatible vision** | Let an image-capable DeepSeek model read images directly, or route images through a verified compatible vision provider; image attachments are stored durably and travel one path into model context. |
| **Plan, Goal, Todo, Jobs, and Workflow** | Enter plan mode, manage goals and todos, inspect background jobs owned by the current process, and review multi-stage Workflow runs in the conversation. |
| **Subagents and multi-agent sessions** | Start one-shot or continuable subagents, inspect the parent/child session lineage, status, and elapsed time, and continue or stop a child turn where supported. |
| **Project rules, context references, and artifacts** | Read repository instructions, reference context with `@file` and `@session`, and open or reveal the files an Agent actually produced. |
| **Permissions, sandbox, and approvals** | Choose read-only, workspace-write, or full access for the current or future sessions; dangerous permissions, tool approvals, and Agent questions are confirmed explicitly in the interface. |
| **Skins and themes** | Switch between bundled skins, local backgrounds, and the default theme, with interface colors adapting automatically. |
| **Cross-platform desktop delivery** | Build macOS arm64 and Windows x64 desktop packages locally with electron-builder. |

## Screenshots

![Desktop workspace and session management](docs/screenshots/desktop-workspace.png)

Desktop workspace and sessions.

![Plugin discovery and Agent recommendations](docs/screenshots/plugin-discovery.png)

Plugin discovery with Agent shortlisting.

![Plugin center](docs/screenshots/plugin-center.png)

Plugin center: verification, installation, enablement, and removal.

![Preset Square](docs/screenshots/preset-square.png)

Preset Square with built-in and community Agent Presets.

![Application Center](docs/screenshots/application-center.png)

Application Center and the bundled LLM Wiki application.

![Vision enhancement](docs/screenshots/vision-enhancement.png)

Vision enhancement settings and the input-area shortcut.

![Local model providers](docs/screenshots/local-models.png)

Local model providers: Ollama, vLLM, SGLang, and custom OpenAI-compatible services.

![Skins and themes](docs/screenshots/themes.png)

Skins, backgrounds, and theme adaptation.

## Getting started

### Requirements

- Node.js `^22.19.0 || >=24.0.0`.
- pnpm `11.28.5`; `corepack enable` selects the version pinned in `package.json`.
- macOS or Windows for the desktop application. The browser interface and the Harness runtime also run on Linux.

<a id="run"></a><a id="run-from-source"></a>

### Install and run from source

```sh
git clone <this-repository-url>
cd deepseek-harness-studio
pnpm install
```

Installing dependencies, building, and launching the desktop development environment need no API key. Configure credentials only when a model or vision request is made, and never commit them.

### Build

```sh
pnpm run build
```

This builds the Host and client artifacts and then the desktop application.

### Run the browser interface

`dsh web` serves the built browser interface and prints a URL that carries an access token:

```sh
pnpm dsh web
```

Useful flags: `--port <port>` where `0` lets the operating system pick a free port, `--host <address>`, `--no-open` to skip opening the default browser, and `--tls-cert` with `--tls-key` for HTTPS. Run `pnpm dsh web --help` for the full list.

For a development loop that rebuilds browser-side artifacts on every edit and then serves them, run:

```sh
pnpm run dev:web
```

### Run the desktop application

```sh
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

The launcher rebuilds the workspace outputs whose inputs changed, projects the built CLI and desktop Host packages into a disposable runtime, uses an isolated Harness home, and starts Electron. Later launches reuse the existing build until an input changes.

### Package the desktop application

```sh
pnpm run dist:desktop:mac   # macOS arm64 package
pnpm run dist:desktop:win   # Windows x64 installer
```

Packaging has not been verified end to end in the current upgrade round; see [Known limitations](#known-limitations).

### Environment variables

All variables are optional. The values below are examples; never commit real credentials.

| Variable | Purpose |
| --- | --- |
| `DEEPSEEK_API_KEY` | Credential reference that the shipped provider routes resolve for DeepSeek requests. It can also be stored through the application credential surface instead of the environment. |
| `OPENROUTER_API_KEY` | Credential used by the optional OpenRouter vision route when compatible vision is enabled. Other compatible vision providers use their own stored credentials. |
| `DSH_HOME` | Overrides the Harness home directory that holds profiles, plugins, settings, and session data. Defaults to `~/.dsh`. |

## Repository layout

```text
deepseek-harness-studio/
├── apps/
│   ├── desktop/       # Electron main process, preload, Host supervisor, packaging and release scripts
│   ├── web/           # Browser entry and the desktop web composition
│   └── cli/           # `dsh` CLI, runtime configuration, and profiles
├── packages/          # Agent, model, tool, session, plugin, attachment, and client packages
├── native/            # Native sandbox helpers
├── scripts/           # Build, generation, verification, and release scripts
├── website/           # Documentation site source
├── vendor/            # Pinned Cordis foundation source
└── assets/            # Images used by this README
```

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install workspace dependencies. |
| `pnpm run build` | Build Host and client artifacts, then the desktop application. |
| `pnpm run build:desktop` | Build only the desktop application. |
| `pnpm run dev:web` | Build artifacts once, watch browser-side sources, and serve with `dsh web`. |
| `pnpm dsh web` | Serve the browser interface from the current build. |
| `pnpm --filter @deepseek-ai/dsh-desktop run dev` | Launch the Electron desktop application from workspace outputs. |
| `pnpm run dist:desktop:mac` / `pnpm run dist:desktop:win` | Create a platform package with electron-builder. |
| `pnpm run typecheck` | Run the TypeScript typecheck gates. |
| `pnpm run test` | Run the Vitest unit suite. |
| `pnpm run check:all` | Run the repository quality gates. |

## Suggested reading order

1. `apps/desktop/src/main.ts` — desktop entry, window, tray, and local Host composition.
2. `apps/desktop/src/host-supervisor.ts` — `dsh web` startup, readiness detection, and shutdown.
3. `apps/desktop/src/preload.ts` — the fixed desktop interfaces exposed to the renderer.
4. `apps/web/` — the web workspace the desktop window loads.
5. `apps/cli/` and `packages/` — CLI composition and the Harness capability packages.
6. [docs/architecture.md](docs/architecture.md) — how the runtime, plugins, and capability seams fit together.

## Known limitations

1. **Preset installation is unavailable.** A preset directory from the `0.1.1` line and a `0.2.1` profile patch composition are not the same model. Browsing, previewing, deleting, and using an already installed Preset work; installing returns a typed `preset/install-unavailable` result and the interface states that installation is not supported. Installing presets needs a defined `0.2.1` preset package format first.
2. **Desktop packaging is unverified.** The build and the Electron development launch pass, but `pnpm run dist:desktop:mac` and `pnpm run dist:desktop:win` were not run in this round. The desktop runtime dependency closure was recomputed for the `0.2.1` bundle closure; a real package and a clean-environment install remain to be validated.
3. **Desktop window interactions are not manually verified.** Sidebar entries, the plugin center, and vision enhancement are built and loaded into the client graph, but they need verification on a machine with a screen, including the macOS window-control inset.
4. **Upstream-only applications are not packaged.** `apps/desktop-host` and `apps/plugin-market-generator` remain in the workspace for the upstream composition, and the desktop build does not package them.
5. **Documentation gates have residual findings.** Translation pairing reports a few language and target mismatches after upstream documentation was merged into a tree without the upstream desktop application, and two newer controller packages still lack the package README sections the gates expect.
6. **No online auto-update.** Desktop delivery uses repository release artifacts; in-application update delivery is not part of this build.

## Upstream and license

This project is based on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and continues its runtime, plugin system, and web interface inside a desktop product. The upgrade history and upstream ownership boundary are recorded in [UPSTREAM_0.2.1_INTEGRATION.md](UPSTREAM_0.2.1_INTEGRATION.md).

The project is distributed under the MIT License; [LICENSE](LICENSE) holds the full text and the original copyright notice. Third-party components and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), brand usage guidance is in [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md), and contribution rules are in [CONTRIBUTING.md](CONTRIBUTING.md).
