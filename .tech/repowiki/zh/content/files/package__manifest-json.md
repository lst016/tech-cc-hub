# package/manifest.json

> 模块：`package` · 语言：`json` · 行数：48

## 文件职责

二进制文件清单，包含8个平台的claude可执行文件校验信息和文件大小

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "version": "2.1.137",
  "commit": "88a017e5d1d4c7de4e6de6a496ac08c9c1b77d79",
  "buildDate": "2026-05-08T23:09:27Z",
  "platforms": {
    "darwin-arm64": {
      "binary": "claude",
      "checksum": "6d91ce741b8aa129fd43c2f844b39dcc1fec8cfd77e8e5a1ed0f0e7ba54cfea9",
      "size": 205062416
    },
    "darwin-x64": {
      "binary": "claude",
      "checksum": "bc71e2701a196c1eee65d0cda675f40118aaf11ce469831bb45092fc342527ff",
      "size": 207568336
    },
    "linux-arm64": {
      "binary": "claude",
      "checksum": "8198e7c845a4f3806504b7350424158970c24c56724de400675d6597507d6183",
      "size": 230471304
    },
    "linux-x64": {
      "binary": "claude",
      "checksum": "ae29f87fdee2d42b5e9ff05c84256bf50a0e7edaa2d58975f9b4b2bd2c29897c",
      "size": 230577872
    },
    "linux-arm64-musl": {
      "binary": "claude",
      "checksum": "a0fc2fc56e36e281bf2849c6edb7403fa2d97a4ca68d555cfa18c9232fdd7d8d",
      "size": 223326040
    },
    "linux-x64-musl": {
      "binary": "claude",
      "checksum": "35e6c7fd0e03717a74e3fe8b016ca7ee448131d3edf060f82164a573cb818449",
      "size": 224971824
    },
    "win32-x64": {
      "binary": "claude.exe",
      "checksum": "4bb6443d136278fbb8acf637cdf3481e5db5c547a7f9bc4658dcd8630279dfe4",
      "size": 226494112
    },
    "win32-arm64": {
      "binary": "claude.exe",
      "checksum": "83db287224382522157ecbb733f63f51cbc1fb5d048a3950ee2a05c779edbfb5",
      "size": 222451872
    }
  }
}

```
