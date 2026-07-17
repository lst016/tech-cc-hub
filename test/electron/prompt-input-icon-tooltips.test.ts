import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const footerPath = "src/ui/components/prompt-input/PromptComposerFooter.tsx";
const source = [
  readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8"),
  existsSync(footerPath) ? readFileSync(footerPath, "utf8") : "",
].join("\n");

test("prompt composer keeps the add affordance for rich text actions", () => {
  assert.match(source, /import \{[^}]*\bPlus\b[^}]*\} from "lucide-react";/);
  assert.match(source, /onToggleSlashBrowser=\{\(\) => setShowSlashBrowser\(\(value\) => !value\)\}/);
  assert.match(
    source,
    /onClick=\{onToggleSlashBrowser\}[\s\S]*?<Plus className="h-\[19px\] w-\[19px\]" aria-hidden="true" \/>[\s\S]*?<\/TooltipButton>/,
  );
});

test("prompt composer icon controls expose visible hover tooltips", () => {
  assert.match(source, /import \{ TooltipButton \} from "\.\.\/TooltipButton";/);

  for (const label of [
    "Slash 命令",
    "优化 Prompt",
    "添加附件",
    "本次使用 Workflow",
    "追求目标",
  ]) {
    assert.match(source, new RegExp(`tooltip="${label}"`));
  }

  assert.match(source, /const primaryActionLabel = !hasDraft && isRunning/);
  assert.match(source, /tooltip=\{primaryActionLabel\}/);
  assert.match(source, /COMPOSER_ICON_TOOLTIP_CLASS/);
  assert.match(source, /tooltipClassName=\{COMPOSER_ICON_TOOLTIP_CLASS\}/);
});
