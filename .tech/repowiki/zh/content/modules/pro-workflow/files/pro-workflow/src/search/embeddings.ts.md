# pro-workflow/src/search/embeddings.ts

> 模块：`pro-workflow` · 语言：`typescript` · 行数：140

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `pickProvider@10`
- `postJSON@16`
- `openai@41`
- `voyage@55`
- `getEmbeddingProvider@68`
- `f32ToBlob@72`
- `blobToF32@76`
- `upsertEmbedding@80`
- `cosine@93`
- `vectorSearch@110`
- `url@19`
- `data@20`
- `req@21`
- `chunks@31`
- `model@43`
- `dim@44`
- `res@48`
- `data@50`
- `model@57`
- `res@61`
- `data@63`
- `dot@96`
- `limit@112`
- `dim@113`
- `sql@114`
- `rows@117`
- `v@120`
- `scores@129`
- `key@132`
- `EmbeddingProvider@3`
- `VectorHit@105`

## 依赖输入

- `better-sqlite3`
- `https`

## 对外暴露

- `EmbeddingProvider`
- `getEmbeddingProvider`
- `upsertEmbedding`
- `VectorHit`
- `vectorSearch`
- `reciprocalRankFusion`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from 'better-sqlite3';
import * as https from 'https';

export interface EmbeddingProvider {
  name: string;
  model: string;
  dim: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

function pickProvider(): EmbeddingProvider | null {
  if (process.env.OPENAI_API_KEY) return openai();
  if (process.env.VOYAGE_API_KEY) return voyage();
  return null;
}

function postJSON(urlStr: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, res => {
      let chunks = '';
      res.on('data', c => { chunks += c; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: chunks }));
    });
    req.setTimeout(30000, () => req.destroy(new Error('embedding request timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function openai(): EmbeddingProvider {
  const model = process.env.PROWORKFLOW_EMBED_MODEL || 'text-embedding-3-small';
  const dim = model === 'text-embedding-3-large' ? 3072 : 1536;
  return {
    name: 'openai', model, dim,
    async embed(texts) {
      const res = await postJSON('https://api.openai.com/v1/embeddings', { input: texts, model }, { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` });
      if (res.status >= 400) throw new Error(`openai embeddings ${res.status}: ${res.body.slice(0, 200)}`);
      const data = JSON.parse(res.body);
      return data.data.map((d: { embedding: number[] }) => Float32Array.from(d.embedding));
    },
  };
}

function voyage(): EmbeddingProvider {
  const model = process.env.PROWORKFLOW_EMBED_MODEL || 'voyage-3';
  return {
    name: 'voyage', model, dim: 1024,
    async embed(texts) {
      const res = await postJSON('https://api.voyageai.com/v1/embeddings', { input: texts, model }, { Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` });
      if (res.status >= 400) throw new Error(`voyage embeddings ${res.status}: ${res.body.slice(0, 200)}`);
      const data = JSON.parse(res.body);
      return data.data.map((d: { embedding: number[] }) => Float32Array.from(d.embedding));
    },
  };
}

export function getEmbeddingProvider(): EmbeddingProvider | null {
  return pickProvider();
}

function f32ToBlob(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

function blobToF32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export function upsertEmbedding(db: Database.Database, pageId: number, provider: EmbeddingProvider, vector: Float32Array): void {
  if (vector.length !== provider.dim) throw new Error(`dim mismatch: ${vector.length} vs ${provider.dim}`);
  db.prepare(`
    INSERT INTO wiki_embeddings (page_id, model, dim, vector)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(page_id) DO UPDATE SET
      model = excluded.model,
      dim = excluded.dim,
      vector = excluded.vector,
      computed_at = datetime('now')
  `).run(pageId, `${provider.name}:${provider.model}`, provider.dim, f32ToBlob(vector));
}

function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface VectorHit {
  page_id: number;
  similarity: number;
}

export function vectorSearch(db: Database.Database, queryVec: Float32Array, opts: { wikiSlug?: string; limit?: number } = {}): VectorHit[] {
  const limit = opts.limit ?? 10;
  const dim = queryVec.length;
  const sql = opts.wikiSlug
    ? `SELECT e.page_id, e.vector FROM wiki_embeddings e JOIN wiki_pages p ON p.id = e.page_id WHERE p.wiki_slug = ? AND e.dim = ?`
    : `SELECT e.pa
... (truncated)
```
