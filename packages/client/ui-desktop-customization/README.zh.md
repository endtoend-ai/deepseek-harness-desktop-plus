# Desktop 个性化

[English](README.md) | 中文

面向学员桌面版的浏览器插件，提供应用内背景选择、可见的软件更新中心和“赋范空间出品”品牌入口。只有 Desktop Host 设置 `DSH_DESKTOP=1` 时才挂载；持久化和更新操作通过固定的 Electron preload bridge 完成。

背景功能接受不超过 16 MB 的 PNG、JPEG 或 WebP，在本机生成 1920×1080 WebP，保存到 Electron `userData`，并通过 ThemeRuntime 应用配色变量。用户选择的图片不会上传。

## 模型体验

无，因为本包只改变 Desktop 渲染界面和固定 Electron bridge，不会向模型请求增加指令、工具或内容。

#### KV Cache 影响

无；本包不组装也不发送模型提供方请求。

## 已知限制与暂缓事项

- 更新中心只在正式封装后的应用中执行真实检查；源码开发版会明确显示这一边界。
- 签名安装包、三端发布元数据和发布动作留到三端封装阶段完成。
