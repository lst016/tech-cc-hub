import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("git workbench UI source wiring", () => {
  it("adds Git as a first-class activity workspace tab", () => {
    const tabsSource = readFileSync("src/ui/utils/activity-workspace-tabs.ts", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
    const appSource = readFileSync("src/ui/App.tsx", "utf8");

    assert.match(tabsSource, /id: "git"/);
    assert.match(railSource, /selectedTab === "git"/);
    assert.match(appSource, /onCreateGitTab=\{openGitWorkspace\}/);
  });

  it("keeps Git mutations behind preload IPC methods", () => {
    const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
    const panelSource = readFileSync("src/ui/hooks/useGitWorkbench.ts", "utf8");

    assert.match(preloadSource, /getGitSnapshot/);
    assert.match(preloadSource, /gitCommit/);
    assert.match(preloadSource, /getGitCommitDetail/);
    assert.match(preloadSource, /generateGitCommitMessageFast/);
    assert.match(preloadSource, /gitPull/);
    assert.match(panelSource, /window\.electron\.gitCommit/);
    assert.match(panelSource, /window\.electron\.getGitCommitDetail/);
    assert.match(panelSource, /window\.electron\.generateGitCommitMessageFast/);
    assert.doesNotMatch(panelSource, /child_process|simple-git|execFile|spawn/);
  });

  it("fills commit messages immediately and refines them in the background", () => {
    const boxSource = readFileSync("src/ui/components/git/GitCommitBox.tsx", "utf8");
    const hookSource = readFileSync("src/ui/hooks/useGitWorkbench.ts", "utf8");
    const panelSource = readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8");

    assert.match(boxSource, /onGenerateMessageRefined/);
    assert.match(boxSource, /setRefiningMessage\(true\)/);
    assert.match(hookSource, /result\.data\.source === "ai"/);
    assert.match(panelSource, /generateCommitMessageRefined/);
  });

  it("turns the bottom push button into commit-and-push when staged files exist", () => {
    const boxSource = readFileSync("src/ui/components/git/GitCommitBox.tsx", "utf8");
    const hookSource = readFileSync("src/ui/hooks/useGitWorkbench.ts", "utf8");

    assert.match(boxSource, /const pushLabel = stagedCount > 0/);
    assert.match(boxSource, /const handlePush = async/);
    assert.match(boxSource, /await onCommit\(message, body\)/);
    assert.match(boxSource, /await onPush\(\)/);
    assert.doesNotMatch(boxSource, /onClick=\{onPush\}/);
    assert.match(readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8"), /onPush=\{workbench\.push\}/);
    assert.match(hookSource, /return true/);
    assert.match(hookSource, /return false/);
  });

  it("syncs enabled CodeGraph workspaces after successful Git commits", () => {
    const panelSource = readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8");
    const autoUpdateSource = readFileSync("src/ui/components/git/git-knowledge-autoupdate.ts", "utf8");

    assert.match(panelSource, /commitAndRefreshKnowledge/);
    assert.match(panelSource, /triggerKnowledgeRefreshAfterCommit\(cwd\)/);
    assert.match(panelSource, /onCommit=\{commitAndRefreshKnowledge\}/);
    assert.doesNotMatch(autoUpdateSource, /knowledge:list/);
    assert.match(autoUpdateSource, /codegraph:sync/);
    assert.match(autoUpdateSource, /tech-cc-hub:knowledge-panel-auto-update/);
    assert.match(autoUpdateSource, /readAutoUpdateEnabled\(workspaceKey\)/);
    assert.doesNotMatch(autoUpdateSource, /knowledge:run-generation/);
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
    assert.match(historySource, /buildBranchOptions/);
    assert.match(historySource, /branchFilter/);
    assert.match(historySource, /buildLaneRanges/);
    assert.match(historySource, /CommitRow/);
  });

  it("does not nest interactive file actions inside another button", () => {
    const changesSource = readFileSync("src/ui/components/git/GitChangesList.tsx", "utf8");

    assert.doesNotMatch(changesSource, /role="button"/);
    assert.match(changesSource, /未暂存/);
    assert.match(changesSource, /已暂存/);
    assert.match(changesSource, /aria-label=\{options\.actionLabel\}/);
    assert.match(changesSource, /renderFileRow/);
  });
});
