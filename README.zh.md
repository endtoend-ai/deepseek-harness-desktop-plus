# DeepSeek Harness Desktop

[English](README.md) | 中文

一款面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的可安装桌面应用，内置运行时、原生窗口与托盘、本地服务管理、外观定制和安装包在线更新能力。

**开发者预览：** 当前源码版本为 `0.1.0-rc.5`；稳定版发布前，接口、打包方式和插件行为仍可能调整。

<p align="center">
  <img src="assets/desktop-preview.png" alt="DeepSeek Harness Desktop 界面" width="100%">
</p>

## 为什么做这个项目

上游 DeepSeek Harness 通过命令行启动本地 Web UI。DeepSeek Harness Desktop 将这套体验封装为 Electron 应用：安装包会自行启动并监管本地 Harness Host，在原生窗口中打开界面，并通过系统托盘保持运行，用户无需安装 Node.js，也无需执行终端命令。

## 主要功能

- **开箱即用的桌面封装** — 安装包内置 Harness 运行时和 Web UI。
- **本地 Host 生命周期管理** — Electron 主进程在系统分配的回环端口启动 `dsh web`，等待服务就绪，并在应用退出时安全关闭它。
- **原生桌面行为** — 支持单实例启动、系统托盘恢复与退出、各平台窗口样式，以及使用系统浏览器打开外部链接。
- **完整 Harness 工作区** — 通过上游 Web UI 保留会话、工作区、Agent Preset、模型设置、工具、Skills 和基于 Cordis 的插件运行时。
- **桌面外观定制** — 可选择本地背景、调整焦点与玻璃效果强度，或恢复内置默认背景；图片在本地处理，并保存在 Electron 私有用户数据目录。
- **可选图片理解** — 用户可使用自己的 DashScope 凭证开启百炼 Qwen3.8 视觉能力，让文本型 Agent 读取工作区内支持的图片。
- **应用内更新** — macOS 和 Windows 安装包可通过当前桌面更新渠道检查、下载并安装新版本。
- **现有插件控制** — 设置页已经提供插件配置，以及可搜索、只读的 Loader 运行清单。

## 插件中心进度

仓库已经完整保留 Harness 插件架构。桌面插件市场及插件变更控制是下一阶段产品目标，当前预览版不会把它们写成已完成功能。

| 当前已有 | 开发中 |
| --- | --- |
| Cordis 插件、Profile 与 Bundle | 经审核的热门插件目录 |
| 设置页插件配置 | 一键安装、启用、停用、更新与卸载 |
| 可搜索的只读运行清单 | 兼容性检查、受控 Host 重启与失败回滚 |

首版插件市场计划只安装经过审核并锁定版本的产物，不开放任意 npm 包名、Git URL 或本地路径输入。

<a id="run"></a>

## 下载

前往 [deepseekdesktop.com](https://deepseekdesktop.com) 获取预览版。

| 平台 | 当前状态 |
| --- | --- |
| macOS Apple Silicon | 已有预览包；已实现签名、公证及 DMG/ZIP 发布链路 |
| Windows 10/11 x64 | 已有 NSIS 预览安装包；生产级 Authenticode 签名待完成 |
| macOS Intel | 计划支持 |
| Linux | 仅支持源码与未封装应用，暂无安装包发布 |

安装后按应用内引导配置受支持的模型服务。模型请求会发送到用户选择的服务商；可选的 Qwen 视觉请求使用阿里云百炼。

## 从源码运行

### 环境要求

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

```sh
git clone https://github.com/fufankeji/deepseek-harness-app.git
cd deepseek-harness-app
pnpm install
pnpm run dev:desktop
```

`dev:desktop` 会先构建工作区、Web 前端和 Electron 主进程，再启动应用。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm run dev:desktop` | 从源码构建并启动桌面应用 |
| `pnpm run package:desktop` | 为当前平台生成未封装应用 |
| `pnpm run dist:mac:desktop` | 构建已签名、公证的 macOS DMG 与更新 ZIP；需要发布凭证 |
| `pnpm run dist:win:desktop` | 构建 Windows x64 NSIS 安装包与更新元数据 |
| `pnpm run typecheck` | 运行仓库 TypeScript 检查 |
| `pnpm run test` | 运行无需密钥的 Vitest 单元测试 |

## 架构

```text
Electron main process
├── window, tray, update, and appearance owners
├── fixed sandboxed preload bridge
└── HostSupervisor
    └── dsh web on 127.0.0.1:<dynamic-port>
        ├── Cordis plugin runtime
        └── React Web UI loaded by the desktop window
```

桌面窗口只接受当前本地 Host 来源的页面导航。Renderer 启用 `contextIsolation: true`、`nodeIntegration: false` 和 Electron sandbox；preload 只暴露固定的外观与更新方法，不提供通用 IPC 通道。

## 仓库结构

| 路径 | 职责 |
| --- | --- |
| `apps/desktop/` | Electron 主进程、preload、生命周期、打包与更新发布 |
| `apps/web/` | 浏览器应用入口与桌面 Web 组合 |
| `apps/cli/` | `dsh` CLI、Profile 与插件命令 |
| `packages/` | Harness Host、客户端、Agent、工具、会话、插件与 SDK 包 |
| `native/` | 原生沙箱辅助程序源码 |
| `python/` | Python SDK 与内置运行时 |
| `vendor/` | 固定版本的 Cordis 基础源码及许可证记录 |

## 社区交流

可通过以下社区渠道交流安装使用、插件开发和项目进展。

<table>
  <thead>
    <tr>
      <th align="center">微信群</th>
      <th align="center">QQ群</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wechat-group.png" alt="DeepSeek Harness Desktop 微信群二维码" width="180" height="180"></td>
      <td align="center"><img src="assets/community-qq-group.jpg" alt="DeepSeek Harness Desktop QQ群二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

Discord：[加入 DeepSeek Harness Desktop 社区](https://discord.gg/TJeGqKRNM)

## 与 DeepSeek Harness 的关系

本仓库基于 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 构建。Harness 核心、Cordis 插件系统和 Web UI 来自上游；本项目负责 Electron 桌面外壳、本地 Host 监管、桌面定制、平台打包与桌面更新渠道。

本项目是独立社区项目，并非 DeepSeek 官方产品。DeepSeek 及相关名称归各自权利人所有。

## 许可证

本项目基于 [MIT License](LICENSE) 发布。第三方组件的许可证声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
