import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Windows updates repair preserved shortcuts before force-running the app", () => {
  const installer = readFileSync("build/installer.nsh", "utf8");

  assert.match(
    installer,
    /\$\{If\} \$\{FileExists\} "\$newStartMenuLink"[\s\S]*Delete "\$newStartMenuLink"[\s\S]*CreateShortCut "\$newStartMenuLink" "\$appExe"/,
  );
  assert.match(
    installer,
    /\$\{If\} \$\{FileExists\} "\$newDesktopLink"[\s\S]*Delete "\$newDesktopLink"[\s\S]*CreateShortCut "\$newDesktopLink" "\$appExe"/,
  );
  assert.match(
    installer,
    /WinShell::SetLnkAUMI "\$newStartMenuLink" "\$\{APP_ID\}"/,
  );
  assert.match(
    installer,
    /WinShell::SetLnkAUMI "\$newDesktopLink" "\$\{APP_ID\}"/,
  );
});
