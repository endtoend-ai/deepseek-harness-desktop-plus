<p align="center">
  <a href="https://www.beyondata.com/">
    <img src="apps/web/public/dsh-desktop/beyondata-logo.png" alt="赋范空间 Logo" width="92" height="92">
  </a>
</p>

<h1 align="center">DeepSeek Harness Desktop</h1>

<p align="center">
  <a href="https://github.com/fufankeji/deepseek-harness-app/stargazers"><img src="https://img.shields.io/github/stars/fufankeji/deepseek-harness-app?style=flat&logo=github&label=Stars" alt="GitHub Stars"></a>
  <img src="https://img.shields.io/badge/Desktop-App-2563EB" alt="Desktop App">
  <img src="https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white" alt="Electron Desktop">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/fufankeji/deepseek-harness-app?color=22C55E" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows-supported-3B82F6" alt="macOS and Windows">
</p>

<p align="center"><strong>中文</strong> · <a href="README.en.md">English</a></p>

<p align="center"><strong>赋范空间出品 · 为 DeepSeek Harness 生态打造的现代化桌面开发体验</strong></p>

<p align="center">把 DeepSeek Harness 的本地 Web 工作区、Host 运行管理和桌面窗口整合为开箱即用的开发环境，让开发者可以获取源码、直接修改并在本地继续构建。</p>

<p align="center"><a href="#快速开始"><strong>获取源码并启动开发</strong></a></p>

<p align="center">
  <img src="assets/deepseek-harness-desktop-cn.png" alt="DeepSeek Harness Desktop 项目界面" width="100%">
</p>

## 先看功能：当前能力与近期路线图

> 桌面开发工作区和中文 DeepSeek 控制已经可用；标为“开发中”或“规划中”的能力尚未上线，会在真实功能可运行后更新状态。

| 能力 | 状态 | 可以做什么 |
| --- | --- | --- |
| **桌面开发工作区** | ✅ 已支持 | 在本地打开项目、管理会话与工作区，调用 Harness 的模型、工具、Skills 和插件能力，并直接修改完整源码。 |
| **中文 DeepSeek 控制** | ✅ 已支持 | 使用中文权限选项和适配 DeepSeek 的思考模式，在输入区直接完成会话级选择。 |
| **插件中心** | 🚧 开发中 · **预计 1 天内上线** | 首个可用版本集中提供插件发现、搜索、分类、详情、安装入口和结果反馈；自由组装、卸载、更新与兼容性检查按后续版本开放。 |
| **MCP、Skills 与工具扩展** | 🗓️ 规划中 | 在桌面端发现、连接和管理 MCP Server、Skills 与工具，按项目自由组合 Agent 能力。 |
| **Agent 预设与多 Agent 协作** | 🗓️ 规划中 | 自定义 Agent 与子 Agent，把编码、测试、调研和审查任务交给不同角色协同完成。 |
| **任务规划、后台运行与会话恢复** | 🗓️ 规划中 | 管理计划和待办，让长任务在后台继续运行，并随时查看进度或接续历史会话。 |
| **项目规则、Hooks 与长期记忆** | 🗓️ 规划中 | 集中管理项目指令、自动化 Hooks 和可持续复用的上下文，让 Agent 按仓库规则稳定工作。 |
| **Git、Worktree 与代码审查** | 🗓️ 规划中 | 在隔离工作区并行开发，查看 Diff、提交和审查结果，减少多人或多任务互相干扰。 |
| **浏览器与桌面自动化** | 🗓️ 规划中 | 让 Agent 操作网页和本地应用，并通过真实交互结果验证任务是否完成。 |
| **手机远程与消息通道** | 🗓️ 规划中 | 从移动端查看和接续任务，并通过常用消息渠道接收通知或触发 Agent。 |

## 项目简介

DeepSeek Harness Desktop 使用 Electron 承载 DeepSeek Harness 的 Web 工作区，并由桌面主进程启动和管理本地 `dsh web` 服务。这个仓库提供完整源码开发环境，使用者可以从 GitHub 克隆或下载代码，在本地安装依赖、编辑源码、启动桌面应用并继续开发。

本 README 只提供源码获取与开发说明，不提供第三方下载站或未经确认的安装包信息。

## 核心功能

- **Electron 桌面端**：提供应用窗口、系统托盘、单实例运行、外部链接处理和安全的 preload 通信接口。
- **本地 Harness Host**：桌面主进程启动 `dsh web`，等待本地服务就绪，并在应用退出时关闭 Host 进程。
- **Web 工作区**：保留 DeepSeek Harness 的会话、工作区、模型、工具、Skills 和插件运行能力。
- **桌面外观设置**：支持本地背景图片及相关显示效果设置，界面效果以本页项目截图为准。
- **完整开发源码**：仓库同时包含桌面应用、Web 界面、CLI、功能包、原生辅助模块、Python SDK、示例和构建脚本。

## 中文权限与 DeepSeek 模型控制

- **权限选择**：输入区使用 `只读`、`工作区写入` 和 `完全访问` 三档中文权限，作用于当前会话；通用设置只决定后续新会话的默认权限，启用完全访问前必须确认风险。
- **模型与思考模式**：模型和 API Key 仍在设置页统一管理；输入区可查看当前 DeepSeek 模型，并选择 `关闭思考`、`深度思考` 或 `最大思考`，不显示 DeepSeek 不支持的速度档位。

## 快速开始

### 获取源码

使用 Git 克隆仓库：

```sh
git clone https://github.com/fufankeji/deepseek-harness-app.git
cd deepseek-harness-app
```

也可以在 GitHub 仓库页面选择 **Code → Download ZIP**，下载并解压源码后进入项目目录。

### 环境要求

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

### 外部服务准备

下载源码、安装依赖和启动桌面开发环境不需要预先填写 API 密钥。需要在应用中实际调用模型时，再在设置中配置所选模型服务与凭证；凭证不要提交到 Git。

<a id="run"></a><a id="run-from-source"></a>

### 安装与启动

安装工作区依赖：

```sh
pnpm install
```

构建所需模块并启动桌面开发环境：

```sh
pnpm run dev:desktop
```

开发启动器会在相关源码或构建输入变化时重新构建；需要强制完整重建时运行：

```sh
pnpm run dev:desktop:rebuild
```

## 目录结构

```text
deepseek-harness-app/
├── apps/
│   ├── desktop/       # Electron 主进程、preload、Host 生命周期与桌面构建脚本
│   ├── web/           # DeepSeek Harness Web 界面入口与桌面端组合
│   └── cli/           # dsh CLI、运行配置与 Agent Preset
├── packages/          # Agent、模型、工具、会话、插件和客户端能力包
├── native/            # 原生沙箱辅助模块
├── python/            # Python SDK 与相关运行时
├── examples/          # 可运行示例与配置
├── scripts/           # 构建、检查、生成和发布脚本
├── website/           # 项目文档站源码
├── vendor/            # 固定版本的 Cordis 基础源码
└── assets/            # README 使用的项目图片
```

## 常用开发命令

| 命令 | 用途 |
| --- | --- |
| `pnpm run dev:desktop` | 构建必要模块并启动 Electron 桌面应用 |
| `pnpm run dev:desktop:rebuild` | 强制完整重建后启动桌面应用 |
| `pnpm run build` | 构建 Host、客户端、Web 与桌面端 |
| `pnpm run package:desktop` | 为当前平台生成未封装桌面应用 |
| `pnpm run typecheck` | 运行 TypeScript 类型检查 |
| `pnpm run test` | 运行 Vitest 单元测试 |

## 建议阅读顺序

1. `apps/desktop/src/main.ts`：桌面应用入口、窗口、托盘和本地 Host 组合。
2. `apps/desktop/src/host-supervisor.ts`：`dsh web` 的启动、就绪检测与退出管理。
3. `apps/desktop/src/preload.ts`：Renderer 可访问的固定桌面接口。
4. `apps/web/`：桌面窗口加载的 Web 工作区。
5. `apps/cli/` 与 `packages/`：CLI 组合以及各项 Harness 能力实现。

## 插件中心（开发中，预计 1 天内上线）

插件中心的首个可用版本将把插件发现、搜索、分类、详情、安装入口和结果反馈集中到桌面端，预计 1 天内上线。自由组装、卸载、更新与兼容性检查会按后续可运行版本逐项开放；功能实际可用后，本页会同步补充真实界面和使用说明。

## 与 DeepSeek Harness 的关系

本项目基于 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 Harness 核心、Cordis 插件体系和 Web 界面继续进行桌面端开发。本仓库维护 Electron 桌面入口、本地 Host 管理、桌面交互与配套开发脚本。

## 许可证

本项目使用 [MIT License](LICENSE)。第三方组件的许可证信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
