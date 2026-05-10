import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("git workbench UI source wiring", () => {
  it("adds Git as a first-class activity workspace tab", () => {
    const tabsSource = readFileSync("src/ui/utils/activity-workspace-tabs.ts", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
    const browserSource = readFileSync("src/ui/components/BrowserWorkbenchPage.tsx", "utf8");

    assert.match(tabsSource, /id: "git"/);
    assert.match(railSource, /selectedTab === "git"/);
    assert.match(browserSource, /onOpenGit/);
  });

  it("keeps Git mutations behind preload IPC methods", () => {
    const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
    const panelSource = readFileSync("src/ui/hooks/useGitWorkbench.ts", "utf8");

    assert.match(preloadSource, /getGitSnapshot/);
    assert.match(preloadSource, /gitCommit/);
    assert.match(panelSource, /window\.electron\.gitCommit/);
    assert.doesNotMatch(panelSource, /child_process|simple-git|execFile|spawn/);
  });

  it("does not expose destructive history rewriting actions in the renderer", () => {
    const gitSource = [
      readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8"),
      readFileSync("src/ui/components/git/GitBranchStashPanel.tsx", "utf8"),
      readFileSync("src/ui/components/git/GitCommitBox.tsx", "utf8"),
    ].join("\n");

    assert.doesNotMatch(gitSource, /reset|rebase|cherry-pick|force push|amend/i);
    assert.match(gitSource, /GitConfirmDialog/);
  });
});
