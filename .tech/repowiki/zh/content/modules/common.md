# common

> 共享工具、类型定义和 Electron 桥接适配器，为整个应用程序提供跨进程通信、文件操作、配置存储等基础能力

common 模块是整个项目的共享核心库，包含与 Electron 主进程通信的 IPC 桥接、文件操作封装、聊天消息类型定义、本地配置存储、文件快照类型及通用工具函数。该模块被其他模块（如 renderer、main 进程）依赖，提供浏览器环境和 Electron 环境的统一抽象接口。

## 文件

### `src/common/index.ts`

模块入口文件，统一导出公共 API

- `ipcBridge` (export) - 重导出 ipcBridge 适配器及其类型

### `src/common/adapter/ipcBridge.ts`

IPC 桥接核心文件，处理 Electron 与渲染进程通信、文件读写、路径操作，提供浏览器环境兼容接口

- `IBridgeResponse` (interface) - IPC 响应通用结构，含 success、data、error、message、newPath 字段
- `IDirOrFile` (interface) - 目录或文件条目结构，含路径信息和递归 children
- `IFileMetadata` (interface) - 文件元数据结构，含 name、path、size、type、lastModified
- `IWorkspaceFlatFile` (type) - 扁平化的 workspace 文件结构
- `noopEvent` (function) - 创建空事件发射器，用于非 Electron 环境兼容
- `getElectron` (function) - 获取 window.electron 对象，安全处理服务端渲染场景
- `getDevPreview` (function) - 开发预览模式下的 HTTP 请求封装，路由 /__tech_preview/
- `normalizePath` (function) - 路径规范化，将反斜杠转换为正斜杠
- `basename` (function) - 获取路径最后一段文件名
- `dirname` (function) - 获取路径目录部分
- `relativeTo` (function) - 计算相对路径，基于根路径获取相对路径
- `readTextFile` (function) - 读取文本文件内容，优先使用 Electron API，降级使用 dev preview
- `readImageFile` (function) - 读取图片文件并返回 base64 编码

### `src/common/chat/chatLib.ts`

聊天消息类型定义和路径拼接工具

- `TMessage` (type) - 聊天消息结构，含 id、role、content、createdAt 及扩展字段
- `joinPath` (function) - 路径拼接函数，合并多段路径并规范化斜杠

### `src/common/config/constants.ts`

配置文件相关常量定义

- `AIONUI_FILES_MARKER` (constant) - 文件标记字符串，用于标识特殊内容区间
- `AIONUI_TIMESTAMP_REGEX` (constant) - ISO 时间戳正则表达式，匹配 2024-01-01T00:00:00Z 格式

### `src/common/config/storage.ts`

本地存储配置持久化封装，基于 localStorage 的键值存储

- `TChatConversation` (type) - 聊天会话结构，含 id、title、workspace、path
- `ConfigStorage.get` (method) - 从 localStorage 读取配置，键名前缀 config:
- `ConfigStorage.set` (method) - 写入配置到 localStorage，JSON 序列化存储

### `src/common/config/storageKeys.ts`

存储键名常量集中定义

- `STORAGE_KEYS` (constant) - 存储键名映射对象，定义 workspace-tree-collapse 和 preview-tabs 键

### `src/common/types/fileSnapshot.ts`

文件快照和差异相关类型定义

- `FileChangeInfo` (type) - 文件变更信息，含 filePath、status、diff、staged、isText
- `SnapshotInfo` (type) - 快照元数据，含 id、createdAt、label
- `CompareResult` (type) - 比较结果，含 changes 数组和可选 snapshots

### `src/common/types/preview.ts`

预览功能相关类型定义，支持多种内容类型

- `PreviewContentType` (type) - 预览内容类型枚举：code、markdown、html、image、pdf、word、excel、ppt、diff、url
- `PreviewHistoryTarget` (type) - 预览历史目标，含 id、path、filePath、title、contentType
- `PreviewSnapshotInfo` (type) - 预览快照信息，含 id、path、title、createdAt、content
- `RemoteImageFetchRequest` (type) - 远程图片获取请求结构

### `src/common/utils.ts`

通用工具函数

- `uuid` (function) - 生成随机 UUID 字符串，默认 16 位字符集 a-z0-9

## 关键概念

- **IPC 桥接模式**：通过 ipcBridge 封装 Electron IPC 调用，同时支持浏览器开发预览模式，实现主进程与渲染进程的统一通信接口
- **环境兼容抽象**：getElectron() 和 noopEvent() 等函数处理 Node.js/Electron 与纯浏览器环境的差异，确保代码在两边都能运行
- **配置持久化**：ConfigStorage 封装 localStorage，统一加 config: 前缀避免键名冲突，支持 JSON 序列化和错误处理
- **路径规范化**：normalizePath、basename、dirname、relativeTo 等函数统一处理不同操作系统的路径分隔符差异

## 内部关系

- `index.ts` -> `adapter/ipcBridge.ts`：index.ts 重导出 ipcBridge 模块的导出和类型，供外部使用
- `config/storage.ts` -> `config/storageKeys.ts`：storage.ts 可以使用 storageKeys.ts 定义的键名常量保持一致性
