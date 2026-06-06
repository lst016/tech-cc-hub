import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildIdeaOpenArgs,
  compareVersionParts,
  filterIdeaInstallations,
  parseIdeaVersionFromPath,
  parseWindowsTasklistCsv,
  selectBestIdeaInstallation,
  selectIdeaInstallation,
  tailLogText,
  type IdeaInstallation,
} from "../../src/electron/libs/idea-launcher.js";
import {
  buildSpringBootCommandPlan,
} from "../../src/electron/libs/spring-boot-runner.js";

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

test("filters IDEA installations by requested version or launcher path", () => {
  const idea2023 = installation({
    launcherPath: "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2023.2.8\\bin\\idea64.exe",
    versionText: "2023.2.8",
    versionParts: [2023, 2, 8],
  });
  const idea2026 = installation({
    launcherPath: "C:\\Program Files\\JetBrains\\IntelliJ IDEA 2026.1\\bin\\idea64.exe",
    versionText: "2026.1",
    versionParts: [2026, 1],
  });

  assert.deepEqual(filterIdeaInstallations([idea2023, idea2026], { version: "2023.2.8" }), [idea2023]);
  assert.equal(selectIdeaInstallation([idea2023, idea2026], { launcherPath: idea2023.launcherPath })?.versionText, "2023.2.8");
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

test("tails copied IDEA Run console logs by line and character limits", () => {
  const result = tailLogText([
    "line 1",
    "line 2",
    "line 3",
    "line 4",
  ].join("\r\n"), { tailLines: 3, maxChars: 20 });

  assert.equal(result.text, "line 2\nline 3\nline 4");
  assert.equal(result.lineCount, 3);
  assert.equal(result.truncated, true);

  const charLimited = tailLogText(`${"a".repeat(1005)}tail`, { tailLines: 10, maxChars: 1000 });
  assert.equal(charLimited.text, `${"a".repeat(996)}tail`);
  assert.equal(charLimited.truncated, true);
});

test("plans Spring Boot Maven and Gradle runner commands", () => {
  const tempRoot = process.env.TEMP || process.cwd();
  const mavenProject = join(tempRoot, "tech-cc-hub-maven-plan");
  const gradleProject = join(tempRoot, "tech-cc-hub-gradle-plan");
  mkdirSync(mavenProject, { recursive: true });
  mkdirSync(gradleProject, { recursive: true });
  writeFileSync(join(mavenProject, "pom.xml"), "<project />");
  writeFileSync(join(gradleProject, "build.gradle"), "plugins { id 'java' }");

  const mavenPlan = buildSpringBootCommandPlan({ projectPath: mavenProject, buildTool: "auto" }, "win32");
  const gradlePlan = buildSpringBootCommandPlan({ projectPath: gradleProject, buildTool: "gradle" }, "win32");

  assert.equal(mavenPlan.tool, "maven");
  assert.deepEqual(mavenPlan.args, ["spring-boot:run"]);
  assert.equal(gradlePlan.tool, "gradle");
  assert.deepEqual(gradlePlan.args, ["bootRun"]);
});
