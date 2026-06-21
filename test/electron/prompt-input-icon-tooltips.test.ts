import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

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

  assert.match(source, /tooltip=\{!hasDraft && isRunning \? "停止会话" : isRunning \? "加入待发送队列" : "发送提示"\}/);
  assert.match(source, /COMPOSER_ICON_TOOLTIP_CLASS/);
  assert.match(source, /tooltipClassName=\{COMPOSER_ICON_TOOLTIP_CLASS\}/);
});
