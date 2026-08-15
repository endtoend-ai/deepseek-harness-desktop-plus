---
status: complete
review_date: 2026-08-15
scope: development-baseline-only
baseline_commit: db07baf
baseline_tag: handoff-0.1.0-rc.5
---

# DeepSeek Harness Desktop 持续开发现状

[English](current-state.md) | 中文

## 范围

本文是持续开发基线的参考文档，记录仓库结构、开发运行链、根目录迁移决定和本轮不改变的内容。它不代表产品、品牌、界面、LLM 依赖或插件中心的完整现代化审查。

## 基线事实

- 交接版本是 `0.1.0-rc.5`，macOS 与 Windows 共用同一个 TypeScript monorepo。
- Node.js 要求是 `^22.19.0 || >=24.0.0`，pnpm 要求是 `11.7.0`；本地基线分别是 Node.js `v24.16.0` 和 pnpm `11.7.0`。
- `DEVELOPER-HANDOFF/SOURCE-SHA256SUMS` 覆盖的 7,602 个文件全部通过 SHA-256 校验。
- Git 基线提交是 `db07baf`，标签是 `handoff-0.1.0-rc.5`；依赖、构建产物、运行数据和凭证文件不属于该提交。
- 交接基线自身包含少量行尾空白诊断。该内容保留在基线标签中以维持交接文件字节一致，后续变更只对相对基线新增的诊断负责。

## 运行架构

| 路径 | 当前职责 | 开发影响 |
|---|---|---|
| `apps/web/` | 浏览器应用装配与静态构建 | 网页端产品入口，不包含完整 Host 生命周期 |
| `packages/client/` | 浏览器和桌面渲染侧插件 | `pnpm run dev:web` 监听并增量构建 Client 插件 |
| `apps/desktop/` | Electron 主进程、preload、打包和更新 | 桌面开发命令会先触发根工作区完整构建 |
| `apps/cli/` | `dsh` CLI、Profile 和 Host 启动入口 | 网页 Host 与桌面内部 Host 共用该入口族 |
| `packages/` | Host、Client、Agent、LLM、Session、Settings 等能力包 | 部分能力同时提供 Host 和 Client face，不能按顶层目录直接切成前后端 |
| `vendor/` | 固定版本的 Cordis 相关源码 | 保持 vendored 更新流程，不参与一般功能重构 |
| `native/`、`python/` | 原生能力、Python SDK 与打包 runtime | 参与跨平台发布和运行时闭包 |
| 根 `package.json`、`pnpm-workspace.yaml` | 跨应用与跨能力包的统一编排 | 必须留在仓库根目录 |

仓库的逻辑边界是 Host face、Client face、产品装配和发布 runtime，不是单一网页前端加单一 API 后端。`apps/`、`packages/`、`vendor/`、`native/`、`python/`、`scripts/` 和 `website/` 保持现有相对路径。

## 开发入口

| 场景 | 命令 | 可观察结果 | 适用范围 |
|---|---|---|---|
| 完整构建 | `pnpm run build` | Host/Client 库、Web 应用和 Desktop 主进程完成构建 | 提交前或跨包变更 |
| 桌面开发 | `pnpm run dev:desktop` | 根工作区完整构建后打开 Electron 应用 | 桌面壳、IPC、更新和完整产品联调 |
| 网页 Host | `pnpm dsh web` | 默认在 `127.0.0.1:3080` 提供网页应用 | 浏览器直接查看和网页交互开发 |
| Client 监听 | `pnpm run dev:web` | 轮询并增量构建 Client 插件 | 与网页 Host 并行运行 |

目录名称不会显著拖慢 macOS 上的运行。桌面开发入口的主要等待来自 `apps/desktop/package.json` 中的完整根工作区构建；增量桌面启动属于独立工程改进，不与根目录整理混合实施。

## 已确认的根目录映射

| 当前位置 | 目标位置 | 动作 | 行为影响 | 验证 |
|---|---|---|---|---|
| `DeepSeek-Harness-Desktop-development-handoff-2026-08-15/DeepSeek-Harness-Desktop-macOS-source-0.1.0-rc.5/` | `DeepSeekHarnessDesktop/` | 在同一工作区移动项目根目录 | 无产品行为变化；项目绝对路径改变 | Git 基线、完整构建、网页 Host 和桌面入口 |
| 项目根内全部已跟踪源码 | 目标根内相同相对路径 | 保留 | 导入、工作区和发布脚本保持原语义 | `git status` 与 `pnpm run build` |
| `node_modules/` 与已生成构建产物 | 目标根内相同相对路径 | 保留但继续忽略 | 维持已安装环境；不进入 Git | 安装状态检查与构建 |
| 外层交接 ZIP、校验清单和平台说明 | 原交接目录 | 保留 | 继续作为可恢复的原始交付证据 | 文件存在性检查 |

## 持续开发边界

- 不创建空的 `frontend/` 或 `backend/`，也不移动现有能力包来模拟简单教学项目结构。
- 不修改产品名称、Logo、版权文案、用户数据目录、更新渠道、API、插件加载或打包行为。
- 不升级依赖，不调整 UI，不实现插件中心，不把启动性能优化混入目录迁移。
- 后续若调整桌面启动速度，先为“已构建库直接启动 Electron”建立显式命令和失效条件，再验证完整桌面入口；原有 `pnpm run dev:desktop` 在替代入口通过前保持可用。
- 后续若进入完整教学项目现代化，另行确认正式产品名、品牌路径、用户旅程、准确文件迁移表和 Feature 规格。
