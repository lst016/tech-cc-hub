# pro-workflow/package-lock.json

> 模块：`pro-workflow` · 语言：`json` · 行数：517

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "name": "pro-workflow",
  "version": "3.3.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "pro-workflow",
      "version": "3.3.0",
      "license": "MIT",
      "dependencies": {
        "better-sqlite3": "^12.6.2"
      },
      "devDependencies": {
        "@types/better-sqlite3": "^7.6.12",
        "@types/node": "^25.2.2",
        "typescript": "^6.0.2"
      },
      "engines": {
        "node": ">=18.0.0"
      }
    },
    "node_modules/@types/better-sqlite3": {
      "version": "7.6.13",
      "resolved": "https://registry.npmjs.org/@types/better-sqlite3/-/better-sqlite3-7.6.13.tgz",
      "integrity": "sha512-NMv9ASNARoKksWtsq/SHakpYAYnhBrQgGD8zkLYk/jaK8jUGn08CfEdTRgYhMypUQAfzSP8W6gNLe0q19/t4VA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/node": "*"
      }
    },
    "node_modules/@types/node": {
      "version": "25.5.0",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-25.5.0.tgz",
      "integrity": "sha512-jp2P3tQMSxWugkCUKLRPVUpGaL5MVFwF8RDuSRztfwgN1wmqJeMSbKlnEtQqU8UrhTmzEmZdu2I6v2dpp7XIxw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~7.18.0"
      }
    },
    "node_modules/base64-js": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz",
      "integrity": "sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/better-sqlite3": {
      "version": "12.8.0",
      "resolved": "https://registry.npmjs.org/better-sqlite3/-/better-sqlite3-12.8.0.tgz",
      "integrity": "sha512-RxD2Vd96sQDjQr20kdP+F+dK/1OUNiVOl200vKBZY8u0vTwysfolF6Hq+3ZK2+h8My9YvZhHsF+RSGZW2VYrPQ==",
      "hasInstallScript": true,
      "license": "MIT",
      "dependencies": {
        "bindings": "^1.5.0",
        "prebuild-install": "^7.1.1"
      },
      "engines": {
        "node": "20.x || 22.x || 23.x || 24.x || 25.x"
      }
    },
    "node_modules/bindings": {
      "version": "1.5.0",
      "resolved": "https://registry.npmjs.org/bindings/-/bindings-1.5.0.tgz",
      "integrity": "sha512-p2q/t/mhvuOj/UeLlV6566GD/guowlr0hHxClI0W9m7MWYkL1F0hLo+0Aexs9HSPCtR1SXQ0TD3MMKrXZajbiQ==",
      "license": "MIT",
      "dependencies": {
        "file-uri-to-path": "1.0.0"
      }
    },
    "node_modules/bl": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/bl/-/bl-4.1.0.tgz",
      "integrity": "sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==",
      "license": "MIT",
      "dependencies": {
        "buffer": "^5.5.0",
        "inherits": "^2.0.4",
        "readable-stream": "^3.4.0"
      }
    },
    "node_modules/buffer": {
      "version": "5.7.1",
      "resolved": "https://registry.npmjs.org/buffer/-/buffer-5.7.1.tgz",
      "integrity": "sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "base64-js": "^1.3.1",
        "ieee754": "^1.1.13"
      }
    },
    "node_modules/chownr": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/chownr/-/chownr-1.1.4.tgz",
      "integrity": "sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==",
      "license": "ISC"
    },
    "node_modules/decompress-response": {
      "version": "6.0.0",
      "resolved": "https://registry
... (truncated)
```
