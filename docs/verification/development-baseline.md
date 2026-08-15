---
status: passed
verification_date: 2026-08-15
scope: development-baseline-only
baseline_commit: db07baf
baseline_tag: handoff-0.1.0-rc.5
---

# Continuous Development Baseline Verification

English | [中文](development-baseline.zh.md)

## Verification Scope

This report verifies the standardized project root, original Git baseline, and existing development entrypoints after relocation. It does not claim completion of `frontend/`, `backend/`, branding, product specifications, Feature specifications, or final teaching delivery.

## Changes

| Item | Result |
|---|---|
| Project root | Moved the versioned source directory out of the handoff wrapper to `DeepSeekHarnessDesktop/` at the workspace root |
| Relative source paths | Preserved `apps/`, `packages/`, `vendor/`, `native/`, `python/`, `scripts/`, `website/`, and root orchestration files |
| Git baseline | Committed the original handoff as `db07baf` and tagged it `handoff-0.1.0-rc.5` |
| Project documentation | Added `docs/audits/current-state.md` and this verification report |
| Product behavior | Did not change source code, dependency versions, UI, configuration, update channels, user data, or packaging logic |
| Original delivery evidence | Preserved the macOS/Windows source ZIPs, outer `SHA256SUMS`, manifest, and platform notes in the handoff directory |

## Results

| Check | Method | Result |
|---|---|---|
| Handoff source integrity | `shasum -a 256 -c DEVELOPER-HANDOFF/SOURCE-SHA256SUMS` | 7,602 files passed and 0 failed |
| Original Git set | Compared staged paths with the source checksum manifest | 7,603 files: 7,602 verified files plus the checksum manifest itself; no `.env` files |
| Root relocation | Checked that the old root is absent, the new root contains `.git`, and commit history is readable | Passed |
| Installation state | pnpm installation check performed by `pnpm run dev:desktop` | Lockfile stayed current, dependencies required no new resolution, and postinstall completed |
| Full build | Root `build` invoked by `pnpm run dev:desktop` | Host, Client, Web, and Desktop builds completed before Electron entered its long-running state |
| Desktop runtime | Electron process, new-root path, and internal Host HTTP probe | Electron started from `DeepSeekHarnessDesktop/`; internal Host `http://127.0.0.1:50578` returned HTTP 200 |
| Web runtime | `pnpm dsh web` and HTTP probe | `http://127.0.0.1:3080` returned HTTP 200 with page title `DeepSeek Harness` |
| Client incremental development | `pnpm run dev:web` | 40 `dsh.client` plugin packages completed the first rebuild and remain under 500 ms polling |
| Git worktree | Ran `git status --short` after runtime verification | Worktree was clean before this report was created; existing ignore rules cover build and runtime outputs |
| New documentation | `git diff --check`, `pnpm run verify-md-wrap`, `pnpm run verify-md-links`, and scoped translation pairing | Passed; the English and Simplified Chinese pairs are complete and consistent |
| Repository doc-sync | `pnpm run doc-sync` | 22 of 28 gates passed; existing stale generated catalogs and graphs, JSDoc gaps, and README pairing violations keep the corpus-wide gate red |
| Repository lint | `pnpm run lint` | The Host build completed; lint failed on existing generated declarations and desktop-customization and vision-enhancement sources, with no tracked code change from this pass |

## Non-blocking Warnings

- On macOS, pnpm reports that optional Linux native packages do not support the current platform, as expected from the cross-platform workspace configuration.
- pnpm reports existing cyclic workspace dependencies; this pass did not change the dependency graph.
- Vite reports some outputs larger than 500 kB, and tsdown reports existing deprecated configuration options; the build still completes.
- The original handoff tag contains existing trailing-whitespace diagnostics; the new documentation passes `git diff --check` relative to the baseline.

## Conclusion

The continuous development baseline passes: the project has a short PascalCase root, a recoverable original Git tag, documented architecture boundaries, and working desktop and web development entrypoints after relocation. Complete teaching-project modernization still requires separate confirmation of the product name, brand, user journeys, and Feature scope.
