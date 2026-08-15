# Desktop customization

English | [中文](README.zh.md)

Desktop-only browser plugin for learner-facing background selection, the visible update center, and the Beyondata attribution badge. The package is mounted only when the Desktop Host exports `DSH_DESKTOP=1`; persistence and update operations cross the fixed Electron preload bridge.

The background path accepts PNG, JPEG, or WebP up to 16 MB, renders a 1920×1080 WebP locally, persists it under Electron `userData`, and applies ThemeRuntime token overrides. No selected image is uploaded.

## Model Experience

None, as this package changes only the Desktop renderer and its fixed Electron bridge; it does not add instructions, tools, or content to model requests.

#### KV Cache effect

None; the package does not assemble or send provider requests.

## Known Limitations and Deferred Work

- The update center performs real checks only in a packaged application. Source development mode reports this boundary explicitly.
- Signed installers, platform release metadata, and release publishing are deferred to the three-platform packaging phase.
