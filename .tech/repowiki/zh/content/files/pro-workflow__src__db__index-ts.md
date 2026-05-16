# pro-workflow/src/db/index.ts

> 模块：`pro-workflow` · 语言：`typescript` · 行数：55

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `getDefaultDbPath@12`
- `ensureDbDir@16`
- `initializeDatabase@22`
- `DEFAULT_DB_DIR@9`
- `DEFAULT_DB_PATH@11`
- `db@25`
- `candidates@32`
- `schemaPath@36`
- `schema@40`
- `db@51`
- `ProWorkflowConfig@5`

## 依赖输入

- `better-sqlite3`
- `fs`
- `path`
- `os`

## 对外暴露

- `ProWorkflowConfig`
- `getDefaultDbPath`
- `ensureDbDir`
- `initializeDatabase`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProWorkflowConfig {
  dbPath: string;
}

const DEFAULT_DB_DIR = path.join(os.homedir(), '.pro-workflow');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'data.db');

export function getDefaultDbPath(): string {
  return DEFAULT_DB_PATH;
}

export function ensureDbDir(): void {
  if (!fs.existsSync(DEFAULT_DB_DIR)) {
    fs.mkdirSync(DEFAULT_DB_DIR, { recursive: true });
  }
}

export function initializeDatabase(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  ensureDbDir();

  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    const candidates = [
      path.join(__dirname, 'schema.sql'),
      path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql'),
    ];
    const schemaPath = candidates.find(p => fs.existsSync(p));
    if (!schemaPath) {
      throw new Error(`pro-workflow: schema.sql not found. Tried: ${candidates.join(', ')}. Run: npm run build`);
    }
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
  } catch (err) {
    db.close();
    throw err;
  }

  return db;
}

if (require.main === module) {
  const db = initializeDatabase();
  console.log(`Database initialized at: ${DEFAULT_DB_PATH}`);
  db.close();
}

```
