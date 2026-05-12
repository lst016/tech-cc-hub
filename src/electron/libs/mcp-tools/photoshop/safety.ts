import { basename, relative, resolve } from "path";

import type { PhotoshopControlledChangeInput } from "./types.js";

export type PhotoshopControlledChangePlan = {
  mode: "dry-run" | "confirmed";
  requiresConfirmation: boolean;
  filePath: string;
  backupPath?: string;
  operations: PhotoshopControlledChangeInput["operations"];
  changeLog: Array<Record<string, unknown>>;
  warnings: string[];
};

function isPathInside(targetPath: string, rootPath: string): boolean {
  const relativePath = relative(resolve(rootPath), resolve(targetPath));
  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.startsWith("/"));
}

function assertAllowedPath(targetPath: string, roots: readonly string[], label: string): string {
  const resolvedTarget = resolve(targetPath);
  if (!roots.some((root) => isPathInside(resolvedTarget, root))) {
    throw new Error(`${label} must be inside the workspace, PSD directory, or an explicitly allowed root.`);
  }
  return resolvedTarget;
}

export function preparePhotoshopControlledChange(input: PhotoshopControlledChangeInput): PhotoshopControlledChangePlan {
  const workspaceRoot = resolve(input.workspaceRoot);
  const filePath = assertAllowedPath(input.filePath, [
    workspaceRoot,
    ...(input.allowedRoots ?? []),
  ], "PSD file");

  if (input.operations.length === 0) {
    throw new Error("At least one controlled Photoshop operation is required.");
  }

  if (input.dryRun !== false) {
    return {
      mode: "dry-run",
      requiresConfirmation: true,
      filePath,
      operations: input.operations,
      changeLog: [],
      warnings: ["Dry-run only. Re-run with dryRun=false and confirmed=true to prepare execution metadata."],
    };
  }

  if (input.confirmed !== true) {
    throw new Error("Controlled Photoshop changes require confirmed=true after reviewing the dry-run plan.");
  }

  const now = input.now ?? new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const backupPath = resolve(workspaceRoot, ".tech-cc-hub", "photoshop", "backups", `${timestamp}-${basename(filePath)}`);
  const changeLog = input.operations.map((operation) => ({
    tool: "photoshop_apply_controlled_change",
    operation: operation.type,
    targetLayerId: "layerId" in operation ? operation.layerId : undefined,
    backupPath,
    confirmed: true,
    performedAt: now.toISOString(),
  }));

  return {
    mode: "confirmed",
    requiresConfirmation: false,
    filePath,
    backupPath,
    operations: input.operations,
    changeLog,
    warnings: [],
  };
}
