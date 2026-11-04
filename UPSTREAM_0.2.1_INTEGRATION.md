# Studio × DeepSeek Harness 0.2.1 升级报告

本文件记录 2026-11-04 这次把 Studio 从官方 `0.1.1-rc.1` 基线升级到 `dsh-v0.2.1-rc.5` 的合并范围、决策、验证证据与已知限制。

## 一、基线与分支

| 项目 | 值 |
|---|---|
| Studio 原基线 | 官方 `528c682e`（dsh 0.1.1-rc.1 合并点）+ 102 个 Studio 提交 |
| 升级目标 | `dsh-v0.2.1-rc.5`（tag `b830ec950f`，上游 12,476 个提交之后） |
| 集成分支 | `integration/upstream-0.2.1-rc.5` |
| 合并提交 | `fe757bafd0 merge: upgrade Studio to DeepSeek Harness 0.2.1-rc.5` |
| 收尾修复提交 | `59c751397e fix(desktop): make the Studio product layer build and boot on dsh 0.2.1` |

## 二、合并方法

原始 3-way merge 产生 **937 个冲突文件**，按四层处置：

1. **文档 / Agent Notes / 快照**（约 480 文件）：取上游（Studio 在这些路径无自有改动）。合并过程中一度误删 284 个上游文档，已从 tag 全量恢复。
2. **包清单**（225 个 `package.json`）：脚本化 JSON 三方合并 —— 上游骨架 + 只保留 Studio 独有的依赖/脚本。
3. **Studio 独有目录**：`apps/desktop`、`packages/client/ui-desktop-customization`、`packages/client/ui-plugin-center`、`packages/plugin-center/contracts`、`packages/examples/ff-llm-wiki-plugin` 及 plugin-center fixtures 全量保留；官方同名的 `apps/desktop`（另一套实现）不进入本仓。
4. **共享包**（约 400 文件）：骨架取上游，Studio 语义按新结构重放；上游已覆盖的能力（图片/原生 Files/日志/预览等）删掉 Studio 重复实现。

上游已删除、需要迁移的包：

| 旧 | 0.2.1 替代 |
|---|---|
| `@deepseek-ai/dsh-client-runtime` | `@deepseek-ai/cordis` 的 `Context` |
| `@deepseek-ai/dsh-invariants` | 整体移除（guide `remove-runtime-invariants`） |
| `@deepseek-ai/dsh-host-apiproxy` | `@deepseek-ai/dsh-api-gateway` + 新增 controller 包 |
| `@deepseek-ai/dsh-agent-presets` | `dsh-agent-preset` + `dsh-agent-preset-registry` |
| `@deepseek-ai/dsh-settings-file` | `dsh-settings` |
| `@deepseek-ai/dsh-code-runtime*` | `dsh-ptc-runtime` / `dsh-ptc-runtime-node` |
| `@deepseek-ai/node-addon-landlock-run*` | `@deepseek-ai/node-addon-system*` |

## 三、产品层移植

- **视觉增强**：旧 `host/apiproxy/src/vision-enhancement.ts`（874 行）迁入新包 `packages/api/vision-controller`（`@deepseek-ai/dsh-api-vision-controller`），以 0.2.1 的 Typert Remote 暴露 `vision.status/route/activate/test/enable`；settings 命名空间改为插件自身 Config + `settings.update`；observation 去重改为 host-only Session projection。
- **Preset 广场**：`preset-archive.ts` 迁入 `packages/api/preset-controller`，暴露 `preset.importArchive`；**安装半边无法忠实迁移**（见已知限制）。
- **桌面壳**：`PROFILE_TEMPLATES.web.bundles` 新结构、启用/停用改为 `bundles` 成员语义（不再有 `disabledBundles`）、桌面拖拽带与交通灯内缩改由 Electron 侧注入、`ctx.remote.vision.*` 调用、`dsh.bundle.patch` 数组形态兼容、bundle 兼容判断改 `engines.dsh`/`requirements`。
- **四个一级入口**（插件中心 / 插件发现 / Preset 广场 / 应用中心）：从 Studio 私有扩展点迁到 0.2.1 的 `main` keyed slot + `sidebar.panellist` + `ctx.layout.selectPanel`；`ctx.settingsNavigation` 恢复为 `ctx.reflect.provide` 并被设置页订阅。
- **FF–LLM Wiki**：侧栏入口从动作区迁到 footer 栈（Settings 上方），其余（外部窗口、开关持久化、中英文案、图标）不变。

## 四、验证证据

| 验证 | 结果 |
|---|---|
| `scripts/build.ts --scope typecheck` | **5/5 门 PASS**（host compiler、Host Typert、host aggregate、client compiler、client aggregate），0 error TS |
| `scripts/build.ts --scope artifacts` | **7/7 门 PASS**，341 个 client artifact 记录 |
| `dsh web` 冒烟（workspace 构建产物 + 临时 `DSH_HOME`） | 启动成功，输出带 token 的就绪 URL；`/?token=…` 跟随重定向后 200，页面含 60+ 客户端插件模块 |
| 桌面模式冒烟（`DSH_DESKTOP=1`） | `ui-plugin-center`、`ui-desktop-customization` 两个 Studio 客户端插件正常进入客户端图，0 条 “did not activate” 警告 |
| `pnpm --filter @deepseek-ai/dsh-desktop run build` | 通过（`lib/main.js` 326 kB、`lib/preload.cjs`） |
| `pnpm dev:desktop`（Electron） | Electron 主进程启动、读取 Studio 构建产物；窗口内功能需人工确认 |

## 五、已知限制（必须知道）

1. **Preset 安装不可用**：0.1.1 的目录式 `.dshpreset` 与 0.2.1 的 profile patch 组合行不是同一模型。当前保留完整预览、删除、使用；安装返回类型化 `preset/install-unavailable`，UI 显示「暂不支持安装」。要做真安装，需要先定义 0.2.1 形态的 preset 包格式。
2. **FF–LLM Wiki 入口位置变化**：位于侧栏底部（Settings 上方），不在上部动作区。
3. **桌面窗口内功能未做人工验证**：构建与进程启动通过，侧栏/插件中心/视觉增强的实际交互需要在有屏幕的机器上点一遍（macOS 交通灯内缩 27/32px 也要在真机确认不遮挡点击）。
4. **打包未验证**：`pnpm dist:desktop:mac`（electron-builder）本轮未跑；`apps/desktop/runtime` 的宿主依赖闭包已按 0.2.1 的 bundle 闭包重算（194 → 317 个包），但仍需一次真实打包 + 安装验证。
5. **文档门禁残留**：`verify-translation-pairing` 仍有少量链接语言/目标分歧（来自把上游文档并回不带官方 `apps/desktop` 树的分支）；两份新 controller 包还缺 README（Model Experience 段落）。
6. **`apps/desktop-host`、`apps/plugin-market-generator`** 是官方独有应用，被保留在 workspace 里但 Studio 不打包它们。

## 六、后续建议

1. 跑一次 `pnpm dist:desktop:mac`（先 `pnpm run build`），安装到干净环境验证 Host 启动、插件中心、视觉增强、卸载。
2. 定义 0.2.1 形态的 preset 包（`agent-preset` 组合行 + 可选 skills），再打开安装入口。
3. 清理文档门禁残留、补两个新包的 README / i18n 记录。
4. 下一次升级继续用 `upstream` remote + `git merge <tag>` 的方式，冲突面应回到几十个文件量级。
