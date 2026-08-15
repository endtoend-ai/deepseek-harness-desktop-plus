---
status: complete
review_date: 2026-08-15
scope: development-baseline-only
baseline_commit: db07baf
baseline_tag: handoff-0.1.0-rc.5
---

# DeepSeek Harness Desktop Continuous Development Baseline

English | [中文](current-state.zh.md)

## Scope

This reference records the repository layout, development runtime paths, root-directory relocation decision, and unchanged areas for continued development. It is not a complete modernization audit of the product, brand, UI, LLM dependencies, or plugin center.

## Baseline Facts

- The handoff version is `0.1.0-rc.5`, and macOS and Windows use the same TypeScript monorepo.
- The project requires Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`; the local baseline uses Node.js `v24.16.0` and pnpm `11.7.0`.
- All 7,602 files covered by `DEVELOPER-HANDOFF/SOURCE-SHA256SUMS` passed SHA-256 verification.
- The Git baseline commit is `db07baf`, tagged `handoff-0.1.0-rc.5`; dependencies, build outputs, runtime data, and credential files are not part of that commit.
- The handoff baseline contains a small number of trailing-whitespace diagnostics. The baseline tag preserves those bytes for source integrity, and subsequent changes are responsible only for diagnostics introduced relative to that baseline.

## Runtime Architecture

| Path | Current responsibility | Development impact |
|---|---|---|
| `apps/web/` | Browser application assembly and static build | Web product entrypoint without the complete Host lifecycle |
| `packages/client/` | Browser and desktop renderer plugins | `pnpm run dev:web` watches and incrementally builds Client plugins |
| `apps/desktop/` | Electron main process, preload, packaging, and updates | The desktop development command starts with a full root-workspace build |
| `apps/cli/` | `dsh` CLI, Profile, and Host entrypoints | The standalone Web Host and desktop-managed Host use this entrypoint family |
| `packages/` | Host, Client, Agent, LLM, Session, Settings, and other capability packages | Some capabilities expose both Host and Client faces and cannot be split by top-level directory |
| `vendor/` | Pinned Cordis-related source | Uses the vendored update procedure and stays outside ordinary feature refactoring |
| `native/`, `python/` | Native capabilities, Python SDK, and packaged runtime | Participate in cross-platform release and the runtime closure |
| Root `package.json`, `pnpm-workspace.yaml` | Cross-application and cross-capability orchestration | Must remain at the repository root |

The repository's logical divisions are Host faces, Client faces, product assemblies, and release runtimes, rather than one web frontend and one API backend. `apps/`, `packages/`, `vendor/`, `native/`, `python/`, `scripts/`, and `website/` keep their existing relative paths.

## Development Entrypoints

| Scenario | Command | Observable result | Intended use |
|---|---|---|---|
| Full build | `pnpm run build` | Host/Client libraries, the Web application, and the Desktop main process build successfully | Pre-commit checks or cross-package changes |
| Desktop development | `pnpm run dev:desktop` | Electron opens after a full root-workspace build | Desktop shell, IPC, updates, and complete product integration |
| Web Host | `pnpm dsh web` | Serves the web application at `127.0.0.1:3080` by default | Direct browser review and web interaction development |
| Client watch | `pnpm run dev:web` | Polls and incrementally builds Client plugins | Runs alongside the Web Host |

Directory naming does not materially slow runtime on macOS. The primary desktop-development delay comes from the full root-workspace build in `apps/desktop/package.json`; an incremental desktop entrypoint is a separate engineering change and does not belong in root-directory normalization.

## Confirmed Root Mapping

| Current location | Target location | Action | Behavior impact | Verification |
|---|---|---|---|---|
| `DeepSeek-Harness-Desktop-development-handoff-2026-08-15/DeepSeek-Harness-Desktop-macOS-source-0.1.0-rc.5/` | `DeepSeekHarnessDesktop/` | Move the project root within the same workspace | No product behavior change; the absolute project path changes | Git baseline, full build, Web Host, and desktop entrypoint |
| All tracked source under the project root | The same relative paths under the target root | Preserve | Imports, workspaces, and release scripts retain their semantics | `git status` and `pnpm run build` |
| `node_modules/` and generated build outputs | The same relative paths under the target root | Preserve and continue to ignore | Keeps the installed environment; remains outside Git | Installation-state check and build |
| Outer handoff ZIPs, checksums, and platform notes | Original handoff directory | Preserve | Remain recoverable delivery evidence | File-existence check |

## Continuous Development Boundaries

- Do not create empty `frontend/` or `backend/` directories or move capability packages to imitate a simple teaching-project layout.
- Do not change the product name, Logo, copyright copy, user-data directory, update channel, APIs, plugin loading, or packaging behavior.
- Do not upgrade dependencies, change the UI, implement the plugin center, or mix startup-performance work into the root relocation.
- A future desktop startup improvement must first define an explicit command for launching Electron from built libraries and its invalidation conditions, then verify the complete desktop entrypoint; `pnpm run dev:desktop` remains available until that replacement passes.
- A complete teaching-project modernization requires separate confirmation of the formal product name, brand asset path, user journeys, exact file migration table, and Feature specifications.
