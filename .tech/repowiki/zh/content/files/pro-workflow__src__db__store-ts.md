# pro-workflow/src/db/store.ts

> 模块：`pro-workflow` · 语言：`typescript` · 行数：446

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `createStore@109`
- `sanitizeFtsQuery@430`
- `db@111`
- `addLearningStmt@112`
- `getLearningStmt@117`
- `getAllLearningsStmt@121`
- `getLearningsByProjectStmt@125`
- `updateLearningStmt@129`
- `deleteLearningStmt@138`
- `incrementTimesAppliedStmt@142`
- `startSessionStmt@146`
- `endSessionStmt@151`
- `getSessionStmt@155`
- `updateSessionCountsStmt@159`
- `getRecentSessionsStmt@167`
- `upsertWikiStmt@171`
- `getWikiStmt@184`
- `listWikisStmt@185`
- `listWikisByScopeStmt@186`
- `deleteWikiStmt@187`
- `upsertWikiPageStmt@188`
- `getWikiPageStmt@201`
- `getWikiPageByIdStmt@202`
- `listWikiPagesStmt@203`
- `searchWikiAllStmt@204`
- `searchWikiScopedStmt@215`
- `enqueueSeedStmt@225`
- `nextPendingSeedStmt@231`
- `claimPendingSeedStmt@235`
- `setSeedStatusStmt@246`
- `linkLearningWikiStmt@247`
- `learningsByWikiStmt@251`
- `addLearningTx@257`
- `result@259`
- `row@266`
- `result@291`
- `result@302`
- `scope@336`
- `existing@337`
- `row@370`

## 依赖输入

- `better-sqlite3`
- `./index`

## 对外暴露

- `Learning`
- `Session`
- `WikiFlavor`
- `WikiScope`
- `Wiki`
- `WikiPage`
- `WikiSearchHit`
- `WikiSeed`
- `Store`
- `createStore`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from 'better-sqlite3';
import { initializeDatabase, getDefaultDbPath } from './index';

export interface Learning {
  id: number;
  created_at: string;
  project: string | null;
  category: string;
  rule: string;
  mistake: string | null;
  correction: string | null;
  times_applied: number;
}

export interface Session {
  id: string;
  project: string | null;
  started_at: string;
  ended_at: string | null;
  edit_count: number;
  corrections_count: number;
  prompts_count: number;
}

export type WikiFlavor =
  | 'research' | 'paper' | 'domain' | 'product' | 'person'
  | 'organization' | 'project' | 'codebase' | 'incident';

export type WikiScope = 'global' | 'project';

export interface Wiki {
  slug: string;
  title: string;
  flavor: WikiFlavor;
  root_path: string;
  scope: WikiScope;
  auto_research: number;
  private: number;
  created_at: string;
  updated_at: string;
}

export interface WikiPage {
  id: number;
  wiki_slug: string;
  rel_path: string;
  title: string;
  summary: string | null;
  content: string | null;
  page_type: string | null;
  content_hash: string | null;
  updated_at: string;
}

export interface WikiSearchHit {
  page_id: number;
  wiki_slug: string;
  rel_path: string;
  title: string;
  summary: string | null;
  snippet: string;
  rank: number;
}

export interface WikiSeed {
  id: number;
  wiki_slug: string;
  query: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  parent_id: number | null;
  depth: number;
  created_at: string;
}

export interface Store {
  db: Database.Database;
  close: () => void;

  addLearning: (learning: Omit<Learning, 'id' | 'created_at' | 'times_applied'>, wikiSlug?: string) => Learning;
  getLearning: (id: number) => Learning | undefined;
  getAllLearnings: (project?: string) => Learning[];
  getLearningsByWiki: (wikiSlug: string) => Learning[];
  updateLearning: (id: number, updates: Partial<Learning>) => boolean;
  deleteLearning: (id: number) => boolean;
  incrementTimesApplied: (id: number) => void;

  startSession: (id: string, project?: string) => Session;
  endSession: (id: string) => void;
  getSession: (id: string) => Session | undefined;
  updateSessionCounts: (id: string, edits?: number, corrections?: number, prompts?: number) => void;
  getRecentSessions: (limit?: number) => Session[];

  // Wiki KB
  upsertWiki: (wiki: Pick<Wiki, 'slug' | 'title' | 'flavor' | 'root_path'> & Partial<Wiki>) => Wiki;
  getWiki: (slug: string) => Wiki | undefined;
  listWikis: (scope?: WikiScope) => Wiki[];
  deleteWiki: (slug: string) => boolean;

  upsertWikiPage: (page: Omit<WikiPage, 'id' | 'updated_at'>) => WikiPage;
  getWikiPage: (wikiSlug: string, relPath: string) => WikiPage | undefined;
  listWikiPages: (wikiSlug: string) => WikiPage[];
  searchWiki: (query: string, opts?: { wikiSlug?: string; limit?: number; loose?: boolean }) => WikiSearchHit[];

  enqueueSeed: (seed: Omit<WikiSeed, 'id' | 'created_at' | 'status'> & { status?: WikiSeed['status'] }) => WikiSeed;
  nextPendingSeed: (wikiSlug: string) => WikiSeed | undefined;
  claimPendingSeed: (wikiSlug: string) => WikiSeed | undefined;
  setSeedStatus: (id: number, status: WikiSeed['status']) => void;
}

export function createStore(dbPath: string = getDefaultDbPath()): Store {
  const db = initializeDatabase(dbPath);

  const addLearningStmt = db.prepare(`
    INSERT INTO learnings (project, category, rule, mistake, correction)
    VALUES (@project, @category, @rule, @mistake, @correction)
  `);

  const getLearningStmt = db.prepare(`
    SELECT * FROM learnings WHERE id = ?
  `);

  const getAllLearningsStmt = db.prepare(`
    SELECT * FROM learnings ORDER BY created_at DESC
  `);

  const getLearningsByProjectStmt = db.prepare(`
    SELECT * FROM learnings WHERE project = ? OR project IS NULL ORDER BY created_at DESC
  `);

  const updateLearningStmt = db.prepare(`
    UPDATE learnings SET
      category = COALESCE(@category, category),
      rule = COALESCE(@rule, rule),
      mistake = COALESCE(@mistake, mistake),
      correction = COALESCE(@correction, correction)
    WHERE id = @id
  `);

  const deleteLearningStmt = db.prepare(`
    DELETE FROM learnings WHERE id = ?
  `
... (truncated)
```
