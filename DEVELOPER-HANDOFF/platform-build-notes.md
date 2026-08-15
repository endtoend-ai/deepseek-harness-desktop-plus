# macOS 开发与打包说明

## 当前目标

- 当前测试架构：Apple Silicon `arm64`
- 当前应用版本：`0.1.0-rc.5`
- 当前正式发布格式：DMG + 自动更新所需 ZIP
- 当前测试包状态：ad-hoc 签名、未公证

## 环境

- macOS
- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`
- Xcode Command Line Tools

## 开发

```sh
pnpm install
pnpm run build
pnpm run dev:desktop
```

生成当前平台的未封装应用：

```sh
pnpm run package:desktop
```

## 正式签名与公证

正式命令：

```sh
APPLE_KEYCHAIN_PROFILE=dsh-notary pnpm run dist:mac:desktop
```

该命令要求：

- 有效的 Developer ID Application 身份和私钥；
- 一套完整的 Apple 公证凭证；
- 签名发现未被禁用；
- Electron Builder 生成 DMG 和 ZIP；
- hardened runtime 与 notarization 均开启。

凭证只能通过 Keychain、受保护的环境文件或 CI secret 注入，不能写入源码、命令记录或交付包。

## 插件中心相关注意事项

- 插件必须安装到用户可写的 DSH Home/Profile，不修改 `.app/Contents/Resources`。
- 目录 artifact 必须标记并校验 `darwin-arm64`。
- 插件包应包含已构建 JavaScript/Client bundle，不在学员机器运行 TypeScript 构建。
- 含原生模块的插件必须提供 arm64 产物。
- 重启内部 Host 时 App 进程和窗口保持存活；新 Host 可能获得新端口，必须更新 origin。
- Desktop 应用签名并不会自动证明运行时下载插件可信，插件仍需独立目录审核与 SHA-256 校验。

## 发布后验证

```sh
codesign --verify --deep --strict --verbose=2 "/path/to/DeepSeek Harness.app"
spctl --assess --type execute --verbose=4 "/path/to/DeepSeek Harness.app"
xcrun stapler validate "/path/to/DeepSeek Harness.app"
```

还需在一台没有开发环境的 Apple Silicon Mac 上完成：首次安装、中文默认、视觉弹窗、插件安装与回滚、更新检查、退出和重新启动。

