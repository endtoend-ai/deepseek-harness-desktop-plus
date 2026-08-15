# Desktop Plugin Center UI

English | [中文](README.zh.md)

Desktop-only first-level Plugin entry: `sidebar.primary.action` supplies navigation and `main.page` supplies the independent main page. It searches a verified catalog, switches between ordinary Plugins and Bundle-wrapped Skill packs, opens exact-version detail in the same page, and reports cache freshness. Exact Install preflight presents current Desktop/DSH/Node/platform/Profile facts, ordered denial reasons, restart expectation, capabilities, and broad-authority risk. The installed manager joins system, catalog, and local sources with enabled, runtime, update, and pending-operation facts; it keeps the existing configuration and runtime-inventory routes reachable. Catalog-owned rows expose confirmed enable, disable, exact update, and uninstall journeys. Uninstall retains configuration and plugin-owned data by default, then offers a separate bounded deletion confirmation only after commit. Incompatible reviewed Bundles remain visible and explain why activation is unavailable.

Use `pnpm run dev:desktop:web` for browser development (`dev:plugin-center` remains a compatibility alias). This entry sets `DSH_DESKTOP=1` so it composes the same Desktop client UI roster and skin while isolating `DSH_HOME` under project artifacts. Plugin Center exposes its development marker and hover explanation on the page root. The default scenario replays install and installed-item actions into one session-backed operation and cumulative installed projection, including post-uninstall owned-data confirmation; `pluginCenterScenario=compatibility-denied` also presents one app-update-incompatible disabled Bundle. `pluginCenterScenario=stale` denies stale catalog authority, and `pluginCenterRecovery=failed` provides a no-write recovery failure, diagnostic export, and retry journey. This lane validates UI and state journeys only: its installed result, mutations, data deletion, and diagnostic export are simulated, and it has no real MCP process, Electron preload, filesystem, package-manager, or Host-restart authority.

The renderer receives fixed catalog methods, operation-state methods, and recovery retry and diagnostic-export intents that accept only `operationId`. It sends the installation intent only after the user confirms the exact version and acknowledges broad application authority. The intent contains only plugin id, exact version, and an idempotency key; it never accepts a package name, registry, URL, path, evidence, environment, policy, command, or raw Skill source. Production exposes the operation shape but keeps `mutationsEnabled` false until the remaining F005 recovery matrix and packaged acceptance pass.

## Model Experience

None, as the Plugin Center renders catalog metadata and browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **F001 uses a bundled reviewed fixture** — F006 owns the production catalog service, publication, ranking, and withdrawal flow.
- **Real lifecycle mutation remains release-gated** — installed management and recovery source paths are present, but the remaining F005 recovery matrix and macOS/Windows packaged acceptance must pass before production enables mutation.
- **The browser development bridge has no system authority** — real Profile, MCP, Electron IPC, filesystem, package-manager, and Host-restart behavior requires Desktop acceptance.
