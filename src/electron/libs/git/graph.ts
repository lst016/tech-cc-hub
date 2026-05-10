import type { GitCommitNode } from "./types.js";

export function assignGraphLanes(commits: GitCommitNode[]): GitCommitNode[] {
  const laneByHash = new Map<string, number>();
  let nextLane = 1;

  return commits.map((commit) => {
    const lane = laneByHash.get(commit.hash) ?? 0;
    commit.parents.forEach((parent, index) => {
      if (!laneByHash.has(parent)) {
        laneByHash.set(parent, index === 0 ? lane : nextLane++);
      }
    });
    return { ...commit, graphLane: lane };
  });
}
