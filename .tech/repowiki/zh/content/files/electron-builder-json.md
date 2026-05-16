# electron-builder.json

> 模块：`root` · 语言：`json` · 行数：52

## 文件职责

Electron 打包配置，定义 appId、files、mac/win/linux 打包目标、NSIS 安装器选项

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
    "appId": "com.devagentforge.techcchub",
    "productName": "tech-cc-hub",
    "files": [
        "dist-electron",
        "dist-react",
        "build/icon.png",
        "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
        "node_modules/@anthropic-ai/claude-agent-sdk-*/*"
    ],
    "extraResources": [
        "dist-electron/preload.cjs"
    ],
    "publish": [
        {
            "provider": "github",
            "owner": "lst016",
            "repo": "tech-cc-hub",
            "releaseType": "release",
            "publishAutoUpdate": true
        }
    ],
    "asarUnpack": [
        "node_modules/@anthropic-ai/claude-agent-sdk/**/*",
        "node_modules/@anthropic-ai/claude-agent-sdk-*/*"
    ],
    "afterPack": "scripts/after-pack-win-icon.cjs",
    "icon": "./build/icon",
    "mac": {
        "identity": null,
        "target": [
            "dmg",
            "zip"
        ]
    },
    "linux": {
        "target": "AppImage",
        "category": "Utility"
    },
    "win": {
        "target": [
            "nsis"
        ]
    },
    "nsis": {
        "oneClick": false,
        "allowToChangeInstallationDirectory": true,
        "createDesktopShortcut": true,
        "createStartMenuShortcut": true
    }
}

```
