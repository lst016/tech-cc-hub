import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIdeaOpenArgs,
  compareVersionParts,
  parseIdeaVersionFromPath,
  parseWindowsTasklistCsv,
  selectBestIdeaInstallation,
  type IdeaInstallation,
} from "../../src/electron/libs/idea-launcher.js";

function installation(overrides: Partial<IdeaInstallation>): IdeaInstallation {
  return {
    id: overrides.launcherPath?.toLowerCase() ?? "idea",
    displayName: "IntelliJ IDEA",
    launcherPath: "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2024.3\\bin\\idea64.exe",
    launcherKind: "executable",
    source: "standard-install",
    edition: "ultimate",
    versionText: "2024.3",
    versionParts: [2024, 3],
    mtimeMs: 100,
    ...overrides,
  };
}

test("parses IDEA year-based versions from Windows install paths", () => {
  const version = parseIdeaVersionFromPath("C:\\Program Files\\JetBrains\\IntelliJ IDEA 2026.1\\bin\\idea64.exe");

  assert.deepEqual(version, { text: "2026.1", parts: [2026, 1] });
  assert.equal(compareVersionParts([2026, 1], [2023, 2, 8]) > 0, true);
});

test("prefers Toolbox scripts because they survive IDEA hot updates", () => {
  const best = selectBestIdeaInstallation([
    installation({
      launcherPath: "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2026.1\\bin\\idea64.exe",
      versionText: "2026.1",
      versionParts: [2026, 1],
      mtimeMs: 300,
    }),
    installation({
      displayName: "JetBrains Toolbox idea.cmd",
      launcherPath: "C:\\Users\\dev\\AppData\\Local\\JetBrains\\Toolbox\\scripts\\idea.cmd",
      launcherKind: "toolbox-script",
      source: "toolbox-script",
      edition: "unknown",
      versionText: undefined,
      versionParts: [],
      mtimeMs: 200,
    }),
  ]);

  assert.equal(best?.source, "toolbox-script");
  assert.equal(best?.launcherKind, "toolbox-script");
});

test("selects newest standard IDEA install when no Toolbox script exists", () => {
  const best = selectBestIdeaInstallation([
    installation({
      launcherPath: "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2023.2.8\\bin\\idea64.exe",
      versionText: "2023.2.8",
      versionParts: [2023, 2, 8],
      mtimeMs: 300,
    }),
    installation({
      launcherPath: "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2026.1\\bin\\idea64.exe",
      versionText: "2026.1",
      versionParts: [2026, 1],
      mtimeMs: 200,
    }),
  ]);

  assert.equal(best?.versionText, "2026.1");
});

test("selects newest executable across Toolbox app and standard installs", () => {
  const best = selectBestIdeaInstallation([
    installation({
      launcherPath: "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2023.2.8\\bin\\idea64.exe",
      source: "standard-install",
      versionText: "2023.2.8",
      versionParts: [2023, 2, 8],
      mtimeMs: 300,
    }),
    installation({
      launcherPath: "C:\\Users\\dev\\AppData\\Local\\JetBrains\\Toolbox\\apps\\IDEA-U\\ch-0\\2026.1\\bin\\idea64.exe",
      source: "toolbox-app",
      versionText: "2026.1",
      versionParts: [2026, 1],
      mtimeMs: 200,
    }),
  ]);

  assert.equal(best?.source, "toolbox-app");
  assert.equal(best?.versionText, "2026.1");
});

test("builds IDEA launcher args for project plus file line", () => {
  const args = buildIdeaOpenArgs({
    projectPath: "D:\\workspace\\demo",
    filePath: "D:\\workspace\\demo\\src\\main\\java\\App.java",
    line: 42,
  });

  assert.deepEqual(args.slice(-3), ["--line", "42", "D:\\workspace\\demo\\src\\main\\java\\App.java"]);
  assert.equal(args[0], "D:\\workspace\\demo");
});

test("parses running IDEA from Windows tasklist csv", () => {
  const processes = parseWindowsTasklistCsv([
    '"Image Name","PID","Session Name","Session#","Mem Usage"',
    '"idea64.exe","1204","Console","1","856,000 K"',
    '"java.exe","1300","Console","1","100,000 K"',
  ].join("\r\n"));

  assert.deepEqual(processes, [{ imageName: "idea64.exe", pid: 1204 }]);
});
