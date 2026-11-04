# DeepSeek Harness 0.2.1 integration record

This file records the merge that moved Studio from the upstream `0.1.1-rc.1` baseline to `dsh-v0.2.1-rc.5` on 2026-11-04, including scope, decisions, verification evidence, and known limitations.

## Baseline and branch

| Item | Value |
| --- | --- |
| Previous Studio baseline | Upstream `528c682e` (the dsh 0.1.1-rc.1 merge point) plus 102 Studio commits |
| Upgrade target | `dsh-v0.2.1-rc.5` (tag `b830ec950f`, 12,476 upstream commits later) |
| Integration branch | `integration/upstream-0.2.1-rc.5` |
| Merge commit | `fe757bafd0 merge: upgrade Studio to DeepSeek Harness 0.2.1-rc.5` |
| Follow-up fix commit | `59c751397e fix(desktop): make the Studio product layer build and boot on dsh 0.2.1` |

## Merge method

The raw three-way merge produced **937 conflicted files**, resolved in four layers:

1. **Documentation, Agent Notes, and snapshots** (about 480 files): taken from upstream, because Studio carried no local changes on those paths. The merge briefly dropped 284 upstream documentation files; all of them were restored from the tag.
2. **Package manifests** (225 `package.json` files): merged as JSON with a script that keeps the upstream skeleton and only the dependencies and scripts Studio adds.
3. **Studio-only directories**: `apps/desktop`, `packages/client/ui-desktop-customization`, `packages/client/ui-plugin-center`, `packages/plugin-center/contracts`, `packages/examples/ff-llm-wiki-plugin`, and the plugin-center fixtures are kept in full. The upstream `apps/desktop` is a different implementation and does not enter this repository.
4. **Shared packages** (about 400 files): the upstream skeleton is kept and Studio behavior is replayed onto the new structure. Where upstream already covers a capability (images, native Files, logging, preview), the duplicated Studio implementation was deleted.

Upstream packages that were removed and required migration:

| Removed | Replacement in 0.2.1 |
| --- | --- |
| `@deepseek-ai/dsh-client-runtime` | `Context` from `@deepseek-ai/cordis` |
| `@deepseek-ai/dsh-invariants` | Removed entirely (guide `remove-runtime-invariants`) |
| `@deepseek-ai/dsh-host-apiproxy` | `@deepseek-ai/dsh-api-gateway` plus new controller packages |
| `@deepseek-ai/dsh-agent-presets` | `dsh-agent-preset` and `dsh-agent-preset-registry` |
| `@deepseek-ai/dsh-settings-file` | `dsh-settings` |
| `@deepseek-ai/dsh-code-runtime*` | `dsh-ptc-runtime` and `dsh-ptc-runtime-node` |
| `@deepseek-ai/node-addon-landlock-run*` | `@deepseek-ai/node-addon-system*` |

## Product layer ported

- **Vision enhancement**: the previous `host/apiproxy/src/vision-enhancement.ts` (874 lines) moved to `packages/api/vision-controller` (`@deepseek-ai/dsh-api-vision-controller`), exposed through the 0.2.1 Typert Remote as `vision.status`, `vision.route`, `vision.activate`, `vision.test`, and `vision.enable`; the settings namespace became the plugin's own Config plus `settings.update`; observation deduplication became a host-only Session projection.
- **Preset Square**: `preset-archive.ts` moved to `packages/api/preset-controller` and exposes `preset.importArchive`. The installation half could not be migrated faithfully; see known limitations.
- **Desktop shell**: new `PROFILE_TEMPLATES.web.bundles` structure, enablement expressed as `bundles` membership instead of `disabledBundles`, the desktop drag strip and traffic-light inset injected from the Electron side, `ctx.remote.vision.*` calls, `dsh.bundle.patch` array-form compatibility, and bundle compatibility decided by `engines.dsh` and `requirements`.
- **Four first-class entries** (plugin center, plugin discovery, Preset Square, Application Center): moved from private Studio extension points to the 0.2.1 `main` keyed slot, `sidebar.panellist`, and `ctx.layout.selectPanel`; `ctx.settingsNavigation` was restored through `ctx.reflect.provide` and is subscribed by the settings page.
- **FF–LLM Wiki**: the sidebar entry moved from the action area to the footer stack above Settings; the external window, persisted switch, bilingual copy, and icon are unchanged.

## Verification evidence

| Check | Result |
| --- | --- |
| `scripts/build.ts --scope typecheck` | **5/5 gates passed** (host compiler, Host Typert, host aggregate, client compiler, client aggregate), 0 TypeScript errors |
| `scripts/build.ts --scope artifacts` | **7/7 gates passed**, 341 client artifact records |
| `dsh web` smoke test (workspace build output, temporary `DSH_HOME`) | Started, printed a ready URL with a token; `/?token=…` returned 200 after following the redirect; the page carried 60+ client plugin modules |
| Desktop mode smoke test (`DSH_DESKTOP=1`) | `ui-plugin-center` and `ui-desktop-customization` entered the client graph, with 0 "did not activate" warnings |
| `pnpm --filter @deepseek-ai/dsh-desktop run build` | Passed (`lib/main.js` 326 kB, `lib/preload.cjs`) |
| `pnpm --filter @deepseek-ai/dsh-desktop run dev` | Electron main process started and read the Studio build output; in-window behavior needs manual confirmation |

## Known limitations

1. **Preset installation is unavailable.** The 0.1.1 directory-form `.dshpreset` and the 0.2.1 profile patch composition are not the same model. Preview, delete, and use remain complete; installation returns a typed `preset/install-unavailable` result and the interface shows that installation is not supported. A real installation entry needs a 0.2.1 preset package format first.
2. **FF–LLM Wiki entry moved**: it now sits at the bottom of the sidebar above Settings rather than in the upper action area.
3. **Desktop window behavior is not manually verified**: build and process startup pass, but the sidebar, plugin center, and vision enhancement need a walkthrough on a machine with a screen, including the macOS traffic-light inset (27/32 px) to confirm it does not cover click targets.
4. **Packaging is unverified**: `pnpm dist:desktop:mac` (electron-builder) did not run in this round. The host dependency closure of `apps/desktop/runtime` was recomputed for the 0.2.1 bundle closure (194 → 317 packages), but a real package and install still need validation.
5. **Documentation gates have residual findings**: `verify-translation-pairing` still reports a few link-language and target mismatches, caused by merging upstream documentation into a tree without the upstream `apps/desktop`; two new controller packages still lack README Model Experience sections.
6. **`apps/desktop-host` and `apps/plugin-market-generator`**: these are upstream-only applications. They remain in the workspace, and the desktop build does not package them.

## Follow-ups

1. Run `pnpm dist:desktop:mac` after `pnpm run build`, install into a clean environment, and verify Host startup, plugin center, vision enhancement, and uninstall.
2. Define a 0.2.1-shaped preset package (an `agent-preset` composition plus optional skills) and then enable the installation entry.
3. Clear the residual documentation gate findings and add the README and i18n records for the two new controller packages.
4. Keep using the `upstream` remote and `git merge <tag>` for the next upgrade; the conflict surface should return to a few dozen files.
