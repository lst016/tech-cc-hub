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
    assert.match(preloadSource, /getGitCommitDetail/);
    assert.match(preloadSource, /gitPull/);
    assert.match(panelSource, /window\.electron\.gitCommit/);
    assert.match(panelSource, /window\.electron\.getGitCommitDetail/);
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

  it("keeps the Git rail layout tabbed and renders a filtered version graph", () => {
    const panelSource = readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8");
    const historySource = readFileSync("src/ui/components/git/GitHistoryPanel.tsx", "utf8");

    assert.doesNotMatch(panelSource, /xl:grid-cols/);
    assert.match(panelSource, /type GitWorkbenchTab/);
    assert.match(panelSource, /setActiveTab/);
    assert.match(panelSource, /GitCommitDetailPanel/);
    assert.match(historySource, /@gitgraph\/react/);
    assert.match(historySource, /分支筛选/);
    assert.match(historySource, /branchFilter/);
    assert.match(historySource, /gitgraph\.import/);
    assert.match(historySource, /renderMessage/);
  });

  it("does not nest interactive file actions inside another button", () => {
    const changesSource = readFileSync("src/ui/components/git/GitChangesList.tsx", "utf8");

    assert.doesNotMatch(changesSource, /role="button"/);
    assert.match(changesSource, /buildFileTree/);
    assert.match(changesSource, /未暂存/);
    assert.match(changesSource, /已暂存/);
    assert.match(changesSource, /aria-label=\{options\.actionLabel\}/);
  });
});
