# pro-workflow

> Desktop agent workbench combining chat sessions, task execution, browser preview, and model routing in an Electron app with wiki-based knowledge management and LLM multi-provider orchestration

A comprehensive agent workflow system providing session management, edit tracking, intent drift detection, quality gates, conventional commit validation, wiki-based knowledge management with vector/B25 hybrid search, multi-provider LLM council for consensus/voting, research automation with seed management, and markdown rendering with link graphs. Scripts run as standalone Node.js processes receiving JSON via stdin for integration with the Electron main process.

## 文件

### `pro-workflow/scripts/commit-validate.js`

Validates git commit messages against conventional commits format (<type>(<scope>): <summary>) with 72-char limit. Parses stdin expecting JSON with tool_input.command, extracts message via -m, --message, heredoc, or detects editor/file modes.

- `TYPES` (const) - Array of valid commit types: feat, fix, refactor, test, docs, chore, perf, ci, style, build, revert
- `PATTERN` (const) - Regex for conventional commits validation
- `MAX_SUMMARY` (const) - Maximum allowed summary length (72 chars)
- `extractMessage` (function) - Parses git command string to extract commit message from -m, --message, heredoc, or detects file/editor mode. Returns {msg, form}
- `validate` (function) - Validates message against pattern and length, returns {ok, reason}

### `pro-workflow/scripts/drift-detector.js`

Detects when user intent drifts from the original goal by tracking edits since last intent touch. Compares keyword overlap between original intent and current prompt using Jaccard similarity. Warns at 6+ edits with <20% relevance.

- `extractIntent` (function) - Extracts first sentence (up to 200 chars) from prompt as intent
- `extractKeywords` (function) - Tokenizes text, filters stopwords, returns significant keywords
- `isNewIntent` (function) - Detects new intent patterns: 'now let\'s', 'switch to', 'forget', 'new task', etc.
- `main` (function) - Reads stdin JSON, loads/saves state to temp file, checks drift threshold

### `pro-workflow/scripts/embed-wiki.js`

Embeds wiki pages for vector search using configured provider (OpenAI/Voyage). Supports batch processing, force re-embedding, and hybrid search combining vector similarity with BM25 via Reciprocal Rank Fusion.

- `cmdAll` (function) - Embeds all or specific wiki pages, batches 16 at a time, skips existing unless --force
- `cmdSearch` (function) - Hybrid search combining vector and BM25 results via RRF, supports --mode vector|bm25|hybrid

### `pro-workflow/scripts/prompt-submit.js`

Handles prompt submission events: detects correction patterns (no, that's wrong, undo), learn triggers (remember this, add to rules), updates session counts in DB or temp files, searches wiki for relevant pages on 3+ word queries.

- `correctionPatterns` (const) - Regex patterns detecting user corrections: no/wrong, should/shouldn't, wrong file, undo, revert, stop
- `learnPatterns` (const) - Patterns triggering learn capture: remember, add to rules, don't do that again, [LEARN]
- `isCorrection` (variable) - Boolean from testing correctionPatterns against prompt
- `isLearnTrigger` (variable) - Boolean from testing learnPatterns against prompt

### `pro-workflow/scripts/quality-gate.js`

Tracks edit count per session and triggers quality gate reminders at adaptive thresholds based on correction rate history from recent sessions.

- `getAdaptiveThreshold` (function) - Calculates first/second/repeat thresholds based on correction rate: >25% correction → tight gates (3/6/6), <5% → loose (10/20/20)
- `threshold` (variable) - Object with first, second, repeat values controlling when to log checkpoint and quality gate reminders

### `pro-workflow/scripts/research-tick.js`

Periodic tick script for wiki research automation. Reads wiki.config.md, finds opted-in wikis with pending seeds, spawns research-loop.js to process one page per tick.

- `readWikiConfig` (function) - Parses YAML frontmatter from wiki.config.md into structured object
- `tick` (function) - Main logic: checks STOP file, finds wiki with auto_research.enabled and pending seeds, spawns research-loop

### `pro-workflow/skills/llm-council/scripts/council.js`

Multi-provider LLM council for voting/consensus on responses. Supports Anthropic, OpenAI, OpenRouter, Fireworks, and custom providers. Returns structured entries with latency, tokens, and content.

- `PROVIDERS` (const) - Map of provider configs with envKey, baseUrl, defaultModels, defaultChairman, and call function
- `callOpenAICompat` (function) - Calls OpenAI-compatible API (OpenAI, OpenRouter, Fireworks) via /chat/completions
- `callAnthropic` (function) - Calls Anthropic API via /v1/messages with anthropic-version header
- `cmdRun` (function) - Runs council with multiple providers, collects responses, persists to wiki, returns unified result
- `cmdProviders` (function) - Shows configured and available providers

### `pro-workflow/skills/survey-generator/scripts/build-survey.js`

Builds research surveys using LLM calls. Handles bibliography management, version tracking, and survey generation with citation support.

- `pickProvider` (function) - Selects provider from args or environment (checks PROVIDER_DEFAULTS)
- `callProvider` (function) - Makes LLM API call with provider-specific request format
- `bibCitationId` (function) - Generates stable citation IDs from bibliography keys
- `appendBibliographyToSources` (function) - Updates sources.md with new bibliography entries, avoiding duplicates
- `nextVersion` (function) - Calculates next version number for survey iterations

### `pro-workflow/skills/wiki-builder/scripts/wiki-cli.js`

CLI for wiki management: init (create new wiki), list, info, page (add/update pages), reindex. Manages SQLite store and wiki directories.

- `cmdInit` (function) - Creates new wiki by running init_wiki.sh, registers in store with slug/title/flavor/scope
- `cmdList` (function) - Lists wikis with formatting, supports --json and --scope filter
- `cmdPage` (function) - Adds/updates wiki page: validates path, extracts title/summary/type, writes file and store entry
- `sha256` (function) - Generates 16-char hash for page IDs

### `pro-workflow/skills/wiki-query/scripts/query.js`

Search wiki pages using BM25 text search. Commands: search (query text), related (find similar pages), show (display page content).

- `cmdSearch` (function) - Searches wiki with query, optionally filtered by --wiki slug, returns ranked results with snippets
- `cmdRelated` (function) - Finds pages related to given page using its title+summary as seed query
- `cmdShow` (function) - Displays full page content or metadata as JSON

### `pro-workflow/skills/wiki-research-loop/scripts/research-loop.js`

Core research loop for automated wiki building. Manages seeds, fetches sources, compiles pages with novelty scoring, derives follow-up questions. Handles concurrency, source-fetchers, and seed queue.

- `loadFetchers` (function) - Loads source fetcher modules from skills/scripts/source-fetchers or ~/.pro-workflow/fetchers
- `jaccardNovelty` (function) - Calculates Jaccard similarity between tokenized texts to score content novelty
- `compilePage` (function) - Compiles markdown page from seed and fetched docs, extracts claims, formats with sources and citations
- `deriveFollowUps` (function) - Generates follow-up questions from compiled page content
- `runOne` (function) - Processes single seed: loads fetchers, fetches docs, compiles page, calculates novelty, upserts to store
- `cmdSeed/cmdRun/cmdStatus` (function) - CLI commands for seed management and loop execution control

### `pro-workflow/skills/wiki-viewer/scripts/render.js`

Renders wiki pages as standalone HTML. Parses markdown (headings, lists, tables, code, blockquotes), builds link graph visualization (SVG), applies filters, generates sidebar navigation.

- `renderMarkdown` (function) - Converts markdown to HTML with inline code, bold, italic, citations [^id], links, lists, tables, blockquotes
- `buildLinkGraph` (function) - Analyzes wiki pages for link relationships to build graph data
- `svgGraph` (function) - Renders link graph as SVG with clickable nodes
- `buildHtml` (function) - Assembles full HTML page with header, sidebar, content, backlinks, citation list
- `applyFilter` (function) - Filters page content by type (tasks, claims, todos) or search query
- `renderPage` (function) - Main entry point: loads page from store, renders markdown, builds graph, outputs HTML

## 关键概念

- **Conventional Commits**: Commit message format <type>(<scope>): <summary> enforced by commit-validate.js with validation for type whitelist and 72-char limit
- **Intent Drift Detection**: Tracks edits since original intent, compares keyword overlap using Jaccard similarity; warns at 6+ edits with <20% relevance to original goal
- **Adaptive Quality Gates**: Edit thresholds (first/second/repeat) adjust based on historical correction rate from recent sessions; tighter gates for high-correction-rate users
- **Hybrid Search (RRF)**: Combines vector similarity search with BM25 text search via Reciprocal Rank Fusion for wiki page retrieval
- **LLM Council**: Multi-provider voting system where multiple LLMs respond to same prompt, enabling consensus/selection of best response
- **Seed Queue**: Research automation uses pending seeds in SQLite, processed by research-loop with configurable max-pages per tick
- **Jaccard Novelty Scoring**: Measures content novelty by comparing tokenized word sets between new content and all previous pages
- **Session Tracking**: Counts prompts, corrections, edits per sessionId in SQLite store or temp files for analytics and adaptive behavior

## 内部关系

- `embed-wiki.js` → `dist/db/store.js`: Requires createStore from built store for wiki page and embedding management
- `embed-wiki.js` → `dist/search/embeddings.js`: Imports getEmbedHelpers for upsertEmbedding, vectorSearch, reciprocalRankFusion
- `research-tick.js` → `dist/db/store.js`: Requires createStore to query wikis and seed status
- `research-tick.js` → `skills/wiki-research-loop/scripts/research-loop.js`: Spawns research-loop.js as subprocess to process wiki seeds
- `prompt-submit.js` → `dist/db/store.js`: Optional: uses createStore for session tracking and wiki search fallback
- `quality-gate.js` → `dist/db/store.js`: Optional: uses createStore for adaptive threshold calculation from session history
- `build-survey.js` → `skills/llm-council/scripts/council.js`: References COUNCIL path for LLM multi-provider calls
- `wiki-cli.js` → `dist/db/store.js`: Requires createStore for wiki CRUD operations
- `query.js` → `dist/db/store.js`: Requires createStore for wiki page retrieval and search
- `research-loop.js` → `dist/db/store.js`: Requires createStore for seed/page management and fetcher loading
- `render.js` → `dist/db/store.js`: Requires createStore for page content and metadata retrieval
