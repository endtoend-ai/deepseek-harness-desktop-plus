# DeepSeek Harness Desktop 插件中心 V1 功能规格

状态：交给开发同事继续设计与实现

目标平台：macOS、Windows

目标版本起点：`0.1.0-rc.5`

## 一、目标

让学员不需要打开终端、不需要理解 pnpm、Profile、Bundle 或 Cordis 配置，即可在 DeepSeek Harness Desktop 中完成插件的发现、安装、启用、停用、更新和卸载。

对学员而言，插件中心应当表现为普通桌面软件的扩展商店；对运行时而言，仍然复用 DSH 已有的 Profile、Bundle、Cordis Loader 和客户端模块机制，不另建第二套插件格式。

## 二、当前项目已经具备的基础

### 2.1 Profile 与 Bundle

DSH 的一次启动由 Profile 组合。Profile 位于 `$DSH_HOME/profiles/<name>`，其 `package.json` 保存树外插件依赖与 `dsh.profile.bundles`，`cordis.patch.yml` 保存用户覆盖。

Bundle 是在 `package.json` 中声明 `dsh.bundle.patch` 的 npm 包。Bundle 的 patch 会加入 Profile 的组合层，既可以加入 Host 插件，也可以加入带 `dsh.client` 的浏览器插件。

相关入口：

- `apps/cli/src/args.ts`
- `apps/cli/src/plugin.ts`
- `apps/cli/src/profile-boot.ts`
- `packages/boot/app-boot/src/profile.ts`
- `packages/bundle/`

### 2.2 已有插件安装命令

现有 CLI 已支持：

```sh
dsh plugin --profile web add <package>
dsh plugin --profile web remove <package>
```

该入口把参数转交 pnpm，并在命令成功后重新核对 Profile 依赖：声明 `dsh.bundle` 的依赖会自动加入 `dsh.profile.bundles`，被删除的 Bundle 会从列表移除。

这意味着插件中心不需要重新发明 Bundle 安装规则，但不能直接在页面里执行任意命令。

### 2.3 当前热重载边界

长生命周期 Web Host 会监听 Profile 与 Home 两层 `cordis.patch.yml`，配置更新可以事务化重新组合；错误时保留上一棵可用插件树。

Profile `package.json` 与 `dsh.profile.bundles` 当前不会被监听。新增、删除或升级 Bundle 后，必须重新启动内部 Web Host，才能得到完整、确定的新组合。

纯插件配置修改可以继续使用现有热重载；安装、卸载和升级统一走受控 Host 重启。

### 2.4 当前 Desktop 生命周期

Electron 主进程负责启动一个 `dsh web --host 127.0.0.1 --port 0` 子进程，解析它输出的回环地址，再让 BrowserWindow 加载该地址。

当前 `HostSupervisor` 是一次性对象：开始后可以关闭，但关闭后不能再次启动。插件中心需要把它改造成可多代重启的 Supervisor，并让导航白名单跟随新的 Host origin。

相关入口：

- `apps/desktop/src/host-supervisor.ts`
- `apps/desktop/src/main.ts`
- `apps/desktop/src/window-lifecycle.ts`
- `apps/desktop/src/desktop-bridge-contract.ts`
- `apps/desktop/src/preload.ts`

### 2.5 当前插件页面

设置中已经有“插件配置”和只读“插件列表”。当前 Host inventory 只显示 Loader 条目、有效启停状态和 Fiber 阶段，不保存来源、版本、安装状态，也不能修改插件。

相关入口：

- `packages/host/plugin-inventory/`
- `packages/client/ui-settings-plugin-inventory/`
- `packages/client/ui-settings-plugins/`

插件中心可以复用“插件”设置入口，但安装控制面必须放在 Electron 主进程，不能由即将被重启的 Web Host 自己持有。

## 三、V1 产品范围

### 3.1 页面结构

建议把当前“插件”设置分区扩展为三个标签：

1. **插件中心**：展示赋范空间审核通过、当前系统可安装的插件。
2. **已安装**：展示外部插件的版本、状态、来源、更新和卸载入口。
3. **插件配置**：保留现有已运行 Host 插件的配置卡片。

当前只读 Loader 清单可以放在“已安装”的“运行详情”中，或者继续保留为高级视图。

### 3.2 插件卡片

每张插件卡片至少展示：

- 中文名称；
- 一句话用途；
- 作者与来源；
- 当前版本；
- 适用 DSH 版本；
- 支持平台与架构；
- 是否包含 Host 代码、客户端界面或 Agent 能力；
- 风险/权限说明；
- 安装大小；
- 安装、启用、停用、更新或卸载按钮；
- 最近一次失败原因与“恢复”入口。

### 3.3 用户可见状态

建议使用以下状态，不把 npm、pnpm、Cordis Fiber 等内部词直接展示给学员：

- `可安装`
- `正在下载`
- `正在校验`
- `正在安装`
- `正在重新加载插件环境`
- `已安装，未启用`
- `运行中`
- `有可用更新`
- `正在卸载`
- `安装失败`
- `运行失败，已恢复原版本`
- `与当前版本不兼容`

同一时间只允许一个插件变更事务，其他按钮暂时禁用。

### 3.4 内置插件

内置 Bundle 和 DSH 必需插件可以显示，但必须标注“系统组件”，禁止卸载。是否允许停用由现有组合安全性决定，默认也禁止停用。

### 3.5 外部插件

V1 只允许安装赋范空间插件目录列出的确定版本。不要提供：

- 任意 npm 包名输入；
- 任意 GitHub/Git URL；
- 本地文件或目录安装；
- 自定义 registry；
- 任意 lifecycle script 授权。

这些能力以后可以放入明确标注风险的“开发者模式”，但不属于学员默认体验。

## 四、推荐技术架构

```text
插件中心 React UI
        │
        │ 固定、白名单化 preload API
        ▼
Electron main / DesktopPluginManager
        ├── CatalogClient
        ├── DownloadVerifier
        ├── ProfileSnapshotStore
        ├── BundledPackageManager
        ├── PluginTransactionController
        └── RestartableHostSupervisor
                    │
                    ▼
             dsh web Profile
                    │
             Host + Client plugins
```

### 4.1 为什么控制面必须在 Electron main

安装或卸载时 Web Host 需要停止。若管理能力只存在于 Host Remote，Host 一旦停止，拥有事务状态和恢复职责的服务也会同时消失。

Electron 主进程在整个过程中保持存活，能够：

- 接收页面请求；
- 下载和验证插件；
- 停止旧 Host；
- 修改 Profile；
- 启动新 Host；
- 等待健康检查；
- 失败时恢复旧 Profile；
- 把最终状态送回页面。

普通 `dsh web` 没有这个受信任控制层，因此 V1 插件安装功能只属于 Desktop。

### 4.2 固定 IPC

继续沿用当前 `contextIsolation: true`、`sandbox: true` 和关闭通用 IPC 的安全模式。preload 只能暴露固定方法，示意接口如下：

```ts
interface DesktopPluginBridge {
  listCatalog(): Promise<PluginCatalogView>
  listInstalled(): Promise<InstalledPluginView>
  install(pluginId: string, version: string): Promise<PluginOperation>
  update(pluginId: string, version: string): Promise<PluginOperation>
  setEnabled(pluginId: string, enabled: boolean): Promise<PluginOperation>
  uninstall(pluginId: string, removeConfiguration: boolean): Promise<PluginOperation>
  getOperation(): Promise<PluginOperation | null>
  onOperation(listener: (operation: PluginOperation) => void): () => void
}
```

Renderer 只能传目录中的稳定 `pluginId` 和明确版本，不能传命令、URL、文件路径、包管理参数或 IPC channel。

### 4.3 插件目录

建议把目录作为赋范空间 OSS 上的版本化 JSON 文件，下载时通过 HTTPS 获取。目录记录示例：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-15T00:00:00Z",
  "plugins": [
    {
      "id": "beyondata.example",
      "name": "示例插件",
      "summary": "演示插件中心完整安装闭环。",
      "publisher": "赋范空间",
      "version": "1.0.0",
      "dsh": ">=0.1.0-rc.5 <0.2.0",
      "platforms": ["darwin-arm64", "win32-x64"],
      "packageName": "@beyondata/dsh-example",
      "artifactUrl": "https://example.invalid/plugins/example-1.0.0.tgz",
      "sha256": "64位十六进制摘要",
      "size": 123456,
      "capabilities": ["host", "client"],
      "requiresRestart": true
    }
  ]
}
```

正式实现应为目录配置独立固定源地址，并校验 schema、HTTPS、允许的 OSS host、版本、平台、大小和 SHA-256。不要接受目录记录提供任意执行参数。

### 4.4 包管理器

当前 `dsh plugin` 依赖 PATH 中的 pnpm，而现有 Desktop 发布运行时没有自带 pnpm。插件中心必须提供不依赖学员系统环境的受控包管理能力。

推荐优先复用当前 DSH CLI 的 Profile 核对逻辑，并随 Desktop 发布包携带固定版本的 pnpm 可执行入口。调用时使用 Electron 的 Node 模式或受控子进程，工作目录固定为 Web Profile。

V1 推荐下载已经构建完成的 `.tgz`，再从本地临时文件安装；不要让学员设备执行 Git clone、TypeScript 构建或未经允许的安装脚本。插件若含原生模块，必须提前提供对应平台/架构产物并在目录中声明。

## 五、安装、更新和卸载事务

### 5.1 安装

1. 检查当前没有其他插件事务。
2. 检查当前没有正在生成或执行工具的 Agent；若存在，提示学员任务完成后再操作。
3. 下载插件到应用管理的临时目录。
4. 校验下载地址、大小、SHA-256、package name、version、`dsh.bundle`、DSH 兼容范围和目标平台。
5. 保存当前 Profile `package.json`、lockfile、workspace 配置、patch 和相关依赖状态的恢复快照。
6. 优雅停止当前 Host，并等待 Session/Settings 持久化完成。
7. 使用固定包管理器把本地 `.tgz` 安装到 `web` Profile。
8. 调用现有 Bundle 核对逻辑，确认插件进入 `dsh.profile.bundles`。
9. 启动新 Host，等待新的回环 origin 和 Loader 完全激活。
10. 重新加载 BrowserWindow 到新 origin。
11. 查询插件 inventory，确认预期条目已经 active；有 Client 半侧时确认启动 manifest 中存在对应模块。
12. 删除事务临时文件与旧快照，状态进入“运行中”。

下载和校验可以在旧 Host 运行时进行；真正修改 Profile 前再停止 Host，以缩短不可用时间。

### 5.2 更新

更新与安装共用同一事务，但必须保留旧版本 artifact 或完整 Profile 快照。新版本 Host 健康检查失败时，恢复旧版本并重启旧 Host。

不要原地覆盖已安装包内容；包管理器和 lockfile 应共同决定最终依赖树。

### 5.3 停用与启用

已经安装的 Bundle 仍然存在于 Profile 依赖中。V1 可以通过受管理的 Profile 用户层控制对应条目是否启用。

若仅修改 `cordis.patch.yml`，可以尝试现有事务化配置热重载；但以下情况统一重启 Host：

- Bundle 新增或删除；
- 插件版本变化；
- Client 模块图发生变化；
- 热重载返回失败；
- 插件声明必须重启。

### 5.4 卸载

Windows 可能锁定正在运行插件的文件，因此不要在 Host 活跃时删除依赖。

1. 保存恢复快照。
2. 停止 Host。
3. 从 Profile 中移除插件依赖并核对 Bundle 列表。
4. 根据用户选择保留或清除插件配置与数据。
5. 启动新 Host并确认插件不再出现在有效组合中。
6. 失败时恢复旧 Profile 和依赖状态，再启动旧 Host。

默认保留插件配置，避免误删用户数据；“同时清除配置”必须明确二次确认并只删除插件声明拥有的路径。

## 六、可重启 HostSupervisor

现有 Supervisor 需要从“一次启动、一次关闭”改为“多代 Host”模型：

- `start()`：没有运行代时创建一代 Host；并发调用共享同一启动任务。
- `restart(reason)`：串行完成旧代关闭、新代启动和新 origin 发布。
- `shutdown()`：应用退出时关闭当前代，并永久拒绝后续启动。
- 每一代拥有独立 child、readiness parser、输出缓冲、退出 Promise 和 generation id。
- 旧代的退出事件不得被误判为新代意外退出。
- 插件事务拥有的重启不触发“Host 意外退出→退出整个 App”。
- 新 Host 使用 OS 分配的新端口，主窗口导航白名单必须读取当前 origin，而不是捕获窗口创建时的旧 origin。
- 新 Host 就绪后再执行 `window.loadURL(newOrigin)`；失败时保留错误页或操作遮罩，并进入回滚。

应用正常退出和在线更新安装仍必须等待当前 Host 关闭，不得与插件重启竞态。

## 七、安全要求

插件是可执行代码，不是主题图片。界面上的“权限说明”只能帮助用户理解，不能冒充真正沙箱。

V1 必须满足：

- 目录只来自固定 HTTPS host；
- artifact 只来自允许的 HTTPS host；
- artifact 使用固定版本与 SHA-256；
- 下载大小和解压大小均有限制；
- 拒绝路径穿越、绝对路径、符号链接越界和重复文件覆盖；
- package name、version、目录记录与包内 manifest 一致；
- 禁止任意命令参数和 shell 拼接；
- 默认禁止第三方安装脚本；确需原生构建时改用预构建平台包；
- 任何插件变更串行执行；
- Profile 写入使用临时文件、fsync/原子替换或现有原子写能力；
- 操作日志不得写入 API Key、环境变量、用户提示词或工作区文件内容；
- 失败必须显示可行动的中文错误，并保留技术日志供开发者诊断；
- 内置 Bundle 永远不能被目录伪装成外部插件覆盖；
- 目录版本和插件版本必须与当前 Desktop/DSH 版本做兼容判断。

## 八、与在线更新的关系

Desktop 应用更新与插件更新是两条独立通道：

- 应用更新继续使用 `electron-updater` 与现有赋范空间 OSS `rc` manifest；
- 插件中心使用独立 catalog；
- 更新应用前记录当前外部插件及版本；
- 新版本首次启动时重新做兼容性检查；
- 不兼容插件应安全停用并给出说明，不能让整个 Host 无法启动；
- 应用自动更新不得静默替换、删除或升级外部插件；
- 插件目录不得触发 Electron 应用更新。

## 九、跨平台注意事项

### macOS

- 当前换机测试包是 Apple Silicon；插件目录必须明确 `darwin-arm64`。
- 正式发行需要 Developer ID Application 签名、公证和 stapling。
- 下载插件是应用运行时写入用户目录，不应尝试修改只读 `.app/Contents/Resources`。
- 外部插件安装在 `~/.dsh/profiles/web/` 的可写 Profile 中。

### Windows

- 当前目标为 Windows 10/11 x64，插件目录必须明确 `win32-x64`。
- Host 活跃时不要删除已加载模块，避免文件锁导致卸载失败。
- 子进程调用不得依赖 shell 字符串；固定 executable 与 argv。
- 正式发行需要 Authenticode；未签名内部包可能触发 SmartScreen。
- 插件含原生模块时必须校验 PE x64 架构。

## 十、失败恢复

每个插件操作都必须进入一个可恢复状态机：

```text
idle
  → downloading
  → verifying
  → snapshotting
  → stopping-host
  → mutating-profile
  → starting-host
  → health-checking
  → completed

任一步失败
  → restoring-profile
  → starting-previous-host
  → rolled-back | recovery-failed
```

应用在事务中崩溃时，下次启动必须检测未完成的事务记录。若没有成功提交标记，优先恢复上一次已确认可启动的 Profile，再进入普通启动。

## 十一、建议开发阶段

### 阶段 A：重启能力

- 重构 `HostSupervisor` 为多代生命周期；
- 主窗口支持切换 origin；
- 验证普通关闭、显式退出、在线更新安装和插件重启不互相破坏。

### 阶段 B：事务与目录

- 定义 catalog schema；
- 实现固定源下载、大小和 SHA-256 校验；
- 封装受控包管理器；
- 实现 Profile snapshot、提交和回滚。

### 阶段 C：Desktop bridge 与 UI

- 扩展固定 bridge；
- 新增插件中心、已安装页面和操作进度；
- 保留现有插件配置页面；
- 为内置插件增加系统组件标识。

### 阶段 D：真实插件闭环

- 准备一个赋范空间测试 Bundle；
- 同时包含 Host 条目和简单 Client 页面或设置卡片；
- 在 macOS 和 Windows 完成安装、显示、停用、升级、卸载和失败回滚。

## 十二、验收标准

### 功能验收

- 全新电脑只安装 DeepSeek Harness Desktop，不安装 Node 或 pnpm，也能安装目录中的插件。
- 安装过程中 Desktop 窗口不退出。
- Host 重启后自动回到应用，既有持久化 Session 仍可打开。
- 含 Client 半侧的插件可以在页面中出现。
- 停用、启用、更新和卸载行为符合界面状态。
- 配置修改可热生效时不做无谓重启；必须重启时有明确提示。
- 安装失败、新 Host 启动失败或健康检查失败时自动恢复原版本。

### 安全验收

- Renderer 无法传入命令、URL、文件路径或任意 IPC channel。
- 篡改 artifact、SHA-256、包名、版本、平台或 Bundle manifest 会在修改 Profile 前被拒绝。
- 目录之外的包不能通过普通 UI 安装。
- 不把凭证、用户目录、Session、工作区或安装缓存写入日志/交付包。
- 内置 Bundle 不能卸载或被外部同名包覆盖。

### 平台验收

- macOS Apple Silicon 真机：安装、重启、恢复、应用退出、自动更新入口均正常。
- Windows 10/11 x64 真机：安装、文件锁处理、重启、恢复、快捷方式启动和卸载均正常。
- 两端都完成一次故意损坏插件的回滚测试。

## 十三、V1 明确不做

- 公共开放插件市场；
- 用户提交与审核后台；
- 任意 npm/Git/本地插件安装；
- 插件进程级沙箱或真正权限隔离；
- Linux 插件安装包；
- 插件付费、账号、授权码和云同步；
- 在普通浏览器版 `dsh web` 中开放本机安装权限。

## 十四、开发完成后的必要交付

- 插件中心实现源码与测试；
- catalog JSON schema 与一份真实测试目录；
- 测试 Bundle 源码和 macOS/Windows artifact；
- 安装事务与恢复说明；
- macOS、Windows 真机验证记录；
- 更新后的 Desktop README；
- 下一版本签名安装包和一次真实跨版本更新验证。

