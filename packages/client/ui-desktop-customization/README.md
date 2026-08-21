# Desktop customization

English | [中文](README.zh.md)

Desktop-only browser plugin for learner-facing visual enhancement, background selection, the visible update center, and the Beyondata attribution badge. The package is mounted only when the Desktop Host exports `DSH_DESKTOP=1`; persistence and update operations cross the fixed Electron preload bridge.

The package ships five named background themes plus the image-free original UI: Whale Maid is the first-run default, while Cloud Cat, Jiutian Deep-Space Compute Observatory, Jiutian Quantum Glass Laboratory, and Jiutian Dawn Compute Horizon remain selectable. Their stable identifiers are persisted without duplicating bundled images in `userData`. The custom-background path still accepts PNG, JPEG, or WebP up to 16 MB, renders a 1920×1080 WebP locally, persists it under Electron `userData`, and applies ThemeRuntime token overrides. No selected image is uploaded.

The visual-enhancement Settings row and the composer shortcut consume one Host-backed status source. The setup dialog offers Bailian, OpenRouter, Ollama, vLLM, SGLang, and a generic OpenAI-compatible route. Bailian remains fixed to `qwen3.8-max`; OpenRouter defaults to `openai/gpt-4.1-mini`; every self-hosted route requires an explicit vision-model id and exposes an editable API base with presets for Ollama (`127.0.0.1:11434/v1`), vLLM (`127.0.0.1:8000/v1`), and SGLang (`127.0.0.1:30000/v1`). Local API keys are optional, while a supplied key is stored under an application-owned credential reference. Ambient `DASHSCOPE_API_KEY` and `OPENROUTER_API_KEY` values remain read-only fallbacks and are never write targets. The Host appends `/chat/completions`, sends OpenAI-compatible image parts without redirects, and persists the selected endpoint only after image verification succeeds. Host-pushed settings and credential updates refresh the Settings row and composer shortcut together.

## Model Experience

None, as this browser-side package only controls the Host-owned visual capability and registers no model-facing context itself.

#### KV Cache effect

The package itself adds no tokens or KV-cache entries; after this UI enables visual enhancement, the Host-owned capability governs all Skill, Tool, and visual-observation effects.

## Known Limitations and Deferred Work

- The update center performs real checks only in a packaged application. Source development mode reports this boundary explicitly.
- Signed installers, platform release metadata, and release publishing are deferred to the three-platform packaging phase.
