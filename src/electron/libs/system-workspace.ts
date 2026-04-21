import { app } from "electron";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const SYSTEM_WORKSPACE_DIR_NAME = "system-workspace";
const README_FILE_NAME = "README.md";

export function ensureSystemWorkspace(): string {
  const workspacePath = join(app.getPath("userData"), SYSTEM_WORKSPACE_DIR_NAME);
  if (!existsSync(workspacePath)) {
    mkdirSync(workspacePath, { recursive: true });
  }

  const readmePath = join(workspacePath, README_FILE_NAME);
  if (!existsSync(readmePath)) {
    writeFileSync(
      readmePath,
      [
        "# 系统工作区",
        "",
        "这个目录是软件内置维护 Agent 的默认工作区。",
        "",
        "- 用于系统巡检、技能治理、运行时维护等内部任务",
        "- 不代表任何用户项目",
        "- 维护会话默认会落到这里执行",
      ].join("\n"),
      "utf8",
    );
  }

  return workspacePath;
}
