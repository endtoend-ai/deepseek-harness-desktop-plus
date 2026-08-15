# DeepSeek Harness Desktop 开发交接包

交接日期：2026-08-15

当前应用版本：`0.1.0-rc.5`

## 交接目标

本目录用于把当前赋范空间定制版 DeepSeek Harness Desktop 交给后续开发同事继续维护，并实现“插件中心”功能。

当前 Desktop 已完成：

- macOS 与 Windows 桌面壳及内部 Web Host 生命周期；
- 全新用户默认中文；
- 默认背景、自定义背景与赋范空间品牌入口；
- 百炼 `qwen3.8-max` 视觉能力增强；
- macOS 与 Windows 在线更新检查、下载和安装流程；
- macOS Apple Silicon 测试包与 Windows x64 NSIS 测试包；
- 赋范空间 OSS `rc` 更新渠道。

## 文件说明

- `plugin-center-spec.md`：插件中心 V1 的产品、技术、安全、失败恢复与验收规格。
- `macos-build-notes.md`：macOS 开发、测试、签名、公证和打包说明。
- `windows-build-notes.md`：Windows x64 开发、测试、NSIS、原生模块和签名说明。
- `source-excludes.txt`：源码包明确排除的本机与生成内容。
- `SHA256SUMS`：交付 ZIP 的 SHA-256。
- `manifest.json`：交付包的机器可读清单。

## 源码包

macOS 与 Windows 使用同一个 TypeScript monorepo，不存在两套分叉的产品源码。为了方便不同平台开发同事直接接手，本交付仍分别生成两个 ZIP；两者核心源码一致，只在根目录 `DEVELOPER-HANDOFF/` 中携带对应平台说明。

源码包包含：

- `apps/desktop/` Electron 主进程、preload、打包及更新发布脚本；
- `apps/web/` Web 前端；
- `apps/cli/` DSH CLI 与 Profile/Plugin 启动入口；
- `packages/` 全部 Host、Client、Bundle、Vision、Settings、Session 等源码；
- `vendor/` 当前 Cordis 相关 vendored 源码；
- `native/` 原生能力源码；
- `python/` Python SDK；
- `scripts/`、`docs/`、`.agents/`、测试、根配置和 `pnpm-lock.yaml`。

源码包不包含依赖目录、构建产物、安装包、运行记录、用户数据或凭证。开发者解压后必须重新运行 `pnpm install`。

## 快速开始

环境要求：

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

```sh
pnpm install
pnpm run build
pnpm run dev:desktop
```

本地生成当前平台的未封装应用：

```sh
pnpm run package:desktop
```

## 当前产品边界

- 当前版本号为预发布版 `0.1.0-rc.5`。
- macOS 正式发布需要 Developer ID Application 签名和 Apple 公证；现有换机测试包为 Apple Silicon、ad-hoc 签名且未公证。
- Windows 正式发布需要 Authenticode；现有测试包为 x64、未签名。
- Linux 安装包尚未进入本次交接范围。
- 在线更新源只指向赋范空间 OSS，不检查或安装上游 DeepSeek Harness 的发行包。
- 插件具备与 Host 近似的代码执行权限，插件中心 V1 不应开放任意 npm、Git URL 或本地路径输入。

## 建议接手顺序

1. 在目标平台解压并运行 `pnpm install`、`pnpm run build`、`pnpm run dev:desktop`。
2. 阅读根 `AGENTS.md` 与 `docs/architecture.md`。
3. 阅读 `plugin-center-spec.md`，先完成可重启 HostSupervisor 和安装事务层。
4. 再接入 Desktop 固定 IPC 和插件中心 UI。
5. 用一个经过审核、同时含 Host 与 Client 代码的测试 Bundle 完成安装、重启、显示、停用、卸载与回滚闭环。

