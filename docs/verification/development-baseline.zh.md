---
status: passed
verification_date: 2026-08-15
scope: development-baseline-only
baseline_commit: db07baf
baseline_tag: handoff-0.1.0-rc.5
---

# 持续开发基线验证

[English](development-baseline.md) | 中文

## 验证范围

本报告验证项目根目录标准化、Git 原始基线和迁移后的现有开发入口。它不声明 `frontend/`、`backend/`、品牌、产品规格、Feature 规格或最终教学交付已经完成。

## 实际变更

| 项目 | 结果 |
|---|---|
| 项目根目录 | 从交接包装目录内的版本化源码目录移动到工作区根的 `DeepSeekHarnessDesktop/` |
| 源码相对路径 | `apps/`、`packages/`、`vendor/`、`native/`、`python/`、`scripts/`、`website/` 和根编排文件保持不变 |
| Git 基线 | 原始交接内容提交为 `db07baf`，标签为 `handoff-0.1.0-rc.5` |
| 项目文档 | 新增 `docs/audits/current-state.md` 和本验证报告 |
| 产品行为 | 未修改源码、依赖版本、UI、配置、更新渠道、用户数据或打包逻辑 |
| 原始交付证据 | macOS/Windows 源码 ZIP、外层 `SHA256SUMS`、清单和平台说明保留在交接目录 |

## 验证结果

| 验证项 | 方法 | 结果 |
|---|---|---|
| 交接源码完整性 | `shasum -a 256 -c DEVELOPER-HANDOFF/SOURCE-SHA256SUMS` | 7,602 个文件通过，0 个失败 |
| Git 原始集合 | 对照暂存路径与源码校验清单 | 7,603 个文件：7,602 个被校验文件加校验清单本身；无 `.env` 文件 |
| 目录移动 | 检查旧根不存在、新根含 `.git` 且提交历史可读 | 通过 |
| 安装状态 | `pnpm run dev:desktop` 的 pnpm 安装检查 | 锁文件保持最新，依赖无需重新解析，postinstall 完成 |
| 完整构建 | `pnpm run dev:desktop` 内置的根 `build` | Host、Client、Web 和 Desktop 构建完成，随后进入 Electron 长运行状态 |
| 桌面运行 | Electron 进程、新根路径与内部 Host HTTP 探针 | Electron 从 `DeepSeekHarnessDesktop/` 启动；内部 Host `http://127.0.0.1:50578` 返回 HTTP 200 |
| 网页运行 | `pnpm dsh web` 与 HTTP 探针 | `http://127.0.0.1:3080` 返回 HTTP 200，页面标题是 `DeepSeek Harness` |
| Client 增量开发 | `pnpm run dev:web` | 40 个 `dsh.client` 插件包完成首次重建，500 ms 轮询监听保持运行 |
| Git 工作区 | 运行验证后执行 `git status --short` | 新验证报告创建前工作区干净；构建和运行产物均由现有忽略规则覆盖 |
| 新增文档 | `git diff --check`、`pnpm run verify-md-wrap`、`pnpm run verify-md-links` 和限定范围的双语配对校验 | 通过；英文与简体中文配对完整且一致 |
| 仓库 doc-sync | `pnpm run doc-sync` | 28 项门禁中 22 项通过；已有的生成目录和图表陈旧、JSDoc 缺口及 README 配对违规使全语料门禁保持失败 |
| 仓库 lint | `pnpm run lint` | Host 构建完成；lint 被已有的生成声明、桌面定制和视觉增强源码问题阻断，本轮没有产生已跟踪代码变更 |

## 非阻塞警告

- pnpm 在 macOS 上报告 Linux 原生可选包不支持当前平台，符合跨平台工作区配置。
- pnpm 报告仓库中已有的循环工作区依赖；本轮没有改变依赖图。
- Vite 报告部分产物超过 500 kB，tsdown 报告既有配置选项弃用提示；构建仍然完成。
- 原始交接标签包含少量既有行尾空白诊断；新增文档通过相对基线的 `git diff --check`。

## 结论

持续开发基线通过：项目具备短 PascalCase 根目录、可恢复的原始 Git 标签、明确的架构边界，以及迁移后可运行的桌面和网页开发入口。完整教学项目现代化仍需单独确认产品名、品牌、用户旅程和 Feature 范围。
