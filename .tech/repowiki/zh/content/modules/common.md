# common

> 为桌面代理工作台提供通用工具函数、类型定义、IPC通信适配器和配置管理

common模块是整个应用的基础公共模块，封装了Electron IPC通信、文件操作、预览类型定义、本地存储配置以及通用工具函数。它为聊天会话、任务执行、浏览器预览和模型路由等核心功能提供底层支撑。

## 文件

### `src/common/index.ts`

模块主入口文件，统一导出公共模块的功能

- `ipcBridge` (export) - 导出IPC桥接器，用于Electron进程间通信
- `IBridgeResponse` (type) - IPC响应接口
- `IDirOrFile` (type) - 目录或文件结构接口
- `IFileMetadata` (type) - 文件元数据接口
- `IWorkspaceFlatFile` (type) - 工作区扁平文件结构接口

### `src/common/adapter/ipcBridge.ts`

IPC桥接器，封装Electron主进程与渲染进程之间的通信及文件系统操作

- `IBridgeResponse` (interface) - 通用响应结构，包含success、data、error、message、newPath字段
- `IDirOrFile` (interface) - 目录/文件树结构，包含name、fullPath、relativePath、isDir、isFile、children属性
- `IFileMetadata` (interface) - 文件元数据信息
- `IWorkspaceFlatFile` (interface) - 工作区文件扁平结构
- `noopEvent` (function) - 创建空事件提供者，用于无Electron环境下的事件分发
- `getElectron` (function) - 获取Electron API实例，检测window.electron是否可用
- `getDevPreview` (function) - 开发环境预览请求，发送GET请求到/__tech_preview端点
- `normalizePath` (function) - 路径规范化，将反斜杠替换为正斜杠
- `basename` (function) - 获取路径最后一段文件名
- `dirname` (function) - 获取路径的目录部分
- `relativeTo` (function) - 计算相对路径，基于根目录计算完整路径的相对路径
- `readTextFile` (function) - 读取文本文件，优先使用Electron API，降级到dev preview
- `readImageFile` (function) - 读取图片文件并返回base64编码
- `listDirectory` (function) - 列出目录内容，返回IDirOrFile数组
- `toDirOrFile` (function) - 将文件元数据转换为IDirOrFile结构

### `src/common/types/preview.ts`

定义预览功能的类型系统，包括内容类型和历史记录结构

- `PreviewContentType` (type) - 支持的预览内容类型联合类型：code、markdown、html、image、pdf、word、excel、ppt、diff、url
- `PreviewHistoryTarget` (type) - 预览历史目标，可通过id、path、filePath定位
- `PreviewSnapshotInfo` (type) - 预览快照信息，包含id、path、title、createdAt、content
- `RemoteImageFetchRequest` (type) - 远程图片获取请求

### `src/common/config/storage.ts`

本地存储配置管理器，封装localStorage的读写操作

- `TChatConversation` (type) - 聊天会话数据结构，包含id、title、workspace、path等字段
- `ConfigStorage.get` (function) - 异步获取配置，键名前缀config:
- `ConfigStorage.set` (function) - 异步存储配置，JSON序列化后存入localStorage

### `src/common/types/fileSnapshot.ts`

文件快照和变更追踪的类型定义

- `FileChangeInfo` (type) - 文件变更信息，包含filePath、status、diff、staged、isText
- `SnapshotInfo` (type) - 快照信息，包含id、createdAt、label
- `CompareResult` (type) - 比较结果，包含changes数组和snapshots数组

### `src/common/utils.ts`

通用工具函数，提供UUID生成器

- `uuid` (function) - 生成指定长度的随机字母数字字符串，默认16位

### `src/common/chat/chatLib.ts`

聊天相关的类型定义和路径工具函数

- `TMessage` (type) - 聊天消息结构，包含id、role、content、createdAt等字段
- `joinPath` (function) - 路径拼接函数，过滤空值并规范化多斜杠

### `src/common/config/constants.ts`

应用常量定义

- `AIONUI_FILES_MARKER` (constant) - HTML中的文件标记注释文本
- `AIONUI_TIMESTAMP_REGEX` (constant) - 时间戳正则表达式，用于匹配ISO格式时间

### `src/common/config/storageKeys.ts`

存储键名常量统一管理

- `STORAGE_KEYS` (constant) - 包含WORKSPACE_TREE_COLLAPSE（工作区树折叠状态）、PREVIEW_TABS（预览标签页状态）

## 关键概念

- **IPC桥接模式**: 通过adapter/ipcBridge.ts封装Electron API和开发环境预览API的双重实现，优先使用Electron主进程能力，在开发环境可降级到HTTP预览接口
- **路径规范化**: 所有路径操作统一使用normalizePath将Windows反斜杠转换为正斜杠，确保跨平台一致性
- **类型安全**: 通过TypeScript接口定义所有数据结构，包括IBridgeResponse、IDirOrFile、TMessage等，确保模块间的数据传递类型安全
- **配置存储**: ConfigStorage模块封装localStorage操作，使用config:前缀隔离应用配置，storageKeys.ts统一管理所有存储键名

## 内部关系

- `index.ts` → `adapter/ipcBridge.ts`: 主入口重新导出ipcBridge模块及其类型
- `adapter/ipcBridge.ts` → `types/preview.ts`: IPC通信中使用预览相关的类型定义
- `config/storage.ts` → `config/storageKeys.ts`: 存储模块依赖存储键名常量来构建localStorage的键
- `chat/chatLib.ts` → `adapter/ipcBridge.ts`: 聊天模块使用path工具函数进行路径处理
- `utils.ts` → `adapter/ipcBridge.ts`: 通用工具可能被各模块引用进行UUID生成等操作
