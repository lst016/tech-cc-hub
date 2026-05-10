import type { GitCommitNode } from "./types.js";
import { assignGraphLanes } from "./graph.js";

const FIELD = "\x1f";
const RECORD = "\x1e";

export const GIT_LOG_FORMAT = `%H${FIELD}%h${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%aI${FIELD}%D${FIELD}%s${RECORD}`;

export function parseGitLog(raw: string): GitCommitNode[] {
  const commits = raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [
        hash = "",
        shortHash = "",
        parentsRaw = "",
        authorName = "",
        authorEmail = "",
        committedAt = "",
        refsRaw = "",
        message = "",
      ] = record.split(FIELD);

      return {
        hash,
        shortHash,
        parents: parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : [],
        authorName,
        authorEmail,
        committedAt,
        refs: refsRaw ? refsRaw.split(",").map((ref) => ref.trim()).filter(Boolean) : [],
        branches: [],
        message,
        graphLane: 0,
      } satisfies GitCommitNode;
    });

  return assignGraphLanes(commits);
}
