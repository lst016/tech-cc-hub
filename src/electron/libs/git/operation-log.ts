import { randomUUID } from "crypto";
import type { GitOperationLogEntry } from "./types.js";

export class GitOperationLog {
  private entries: GitOperationLogEntry[] = [];

  list(repoRoot: string): GitOperationLogEntry[] {
    return this.entries.filter((entry) => entry.repoRoot === repoRoot).slice(-50).reverse();
  }

  record(entry: Omit<GitOperationLogEntry, "id" | "createdAt">): GitOperationLogEntry {
    const next = { ...entry, id: randomUUID(), createdAt: Date.now() };
    this.entries.push(next);
    if (this.entries.length > 500) {
      this.entries = this.entries.slice(-500);
    }
    return next;
  }
}
