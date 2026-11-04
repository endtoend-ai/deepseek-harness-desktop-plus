# LLM Wiki DSH Plugin

`dsh-plugin-llm-wiki` launches the complete LLM Wiki product from DeepSeek Harness. It neither replaces the DSH main page nor
rewrites the knowledge-base UI: it registers one launcher in the sidebar and runs the pre-built application shipped in the
package.

## Product boundaries

- `application/` holds the complete product source synced from the upstream application repository.
- `runtime/web/` is the static front end built from that source; the page layout, G6 graph, streaming Q&A, evaluation, and
  settings match the standalone product.
- `runtime/api/` is the Node.js service built from the same back end source.
- DSH supplies only the launcher and `DEEPSEEK_API_KEY`; the product page is never injected into `main.page`.
- Documents, Wiki pages, graph data, and the SQLite database live under the plugin-owned directory in the DSH Home, and the
  plugin center can clean them up on uninstall.

Selecting **LLM Wiki** in the DSH sidebar opens the standalone application in the system browser. The DSH page, navigation,
theme, and workspace stay untouched.

Startup inspects the process PID recorded in `content/.wiki.lock`: a lock left behind by an abnormal exit is reclaimed
immediately, while a running compile keeps its mutual exclusion.

## Install

Search for `dsh-plugin-llm-wiki` in the DeepSeek Harness plugin center and install it, or use the `.tgz` this project
produces when offline. After installation and a Host restart, the launcher appears in the sidebar.

The model key stays in the DSH credential store. The application reads `DEEPSEEK_API_KEY` at startup, and its settings page
can really verify `deepseek-v4-flash` and `deepseek-v4-pro`.

## Develop and package

```bash
pnpm run typecheck:host
pnpm run typecheck:client
pnpm run bundle
pnpm run pack:plugin
```

`bundle` generates the standalone artifacts from `application/`. When the product pages change, re-sync `application/` from
the final source before building a new version instead of maintaining a second UI.

## Known Limitations and Deferred Work

- The application opens its standalone interface in the system browser; embedding the full knowledge-base UI inside the
  Electron window is not implemented.
- The plugin neither ships nor hard-codes a DeepSeek API key; the user configures it through the DSH credential store.
- `runtime/` is regenerated output. The Desktop release flow rebuilds it from `application/`, so ordinary source commits do
  not treat generated files as the source of truth.
