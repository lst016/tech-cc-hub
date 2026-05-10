import test from "node:test";
import assert from "node:assert/strict";

import { assignGraphLanes } from "../../src/electron/libs/git/graph.js";

test("assignGraphLanes gives stable lanes for linear history", () => {
  const commits = assignGraphLanes([
    { hash: "c3", shortHash: "c3", parents: ["c2"], authorName: "A", message: "third", committedAt: "2026-05-10", refs: [], graphLane: 0 },
    { hash: "c2", shortHash: "c2", parents: ["c1"], authorName: "A", message: "second", committedAt: "2026-05-10", refs: [], graphLane: 0 },
    { hash: "c1", shortHash: "c1", parents: [], authorName: "A", message: "first", committedAt: "2026-05-10", refs: [], graphLane: 0 },
  ]);

  assert.deepEqual(commits.map((commit) => commit.graphLane), [0, 0, 0]);
});
