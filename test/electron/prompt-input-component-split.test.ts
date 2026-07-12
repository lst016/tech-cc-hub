import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const promptInputPath = "src/ui/components/prompt-input/PromptInput.tsx";
const palettesPath = "src/ui/components/prompt-input/PromptComposerPalettes.tsx";
const footerPath = "src/ui/components/prompt-input/PromptComposerFooter.tsx";

test("PromptInput composes low-risk presentational children", () => {
  assert.ok(existsSync(palettesPath), "palette components should live outside PromptInput");
  assert.ok(existsSync(footerPath), "footer controls should live outside PromptInput");

  const promptInput = readFileSync(promptInputPath, "utf8");
  const palettes = readFileSync(palettesPath, "utf8");
  const footer = readFileSync(footerPath, "utf8");

  assert.match(promptInput, /<SlashCommandPalette/);
  assert.match(promptInput, /<FileMentionPalette/);
  assert.match(promptInput, /<PromptComposerFooter/);
  assert.doesNotMatch(promptInput, /filteredSlashCommands\.map/);
  assert.doesNotMatch(promptInput, /prompt-composer-footer mt-2/);
  assert.match(palettes, /filteredCommands\.map/);
  assert.match(palettes, /fileMentionOptions\.map/);
  assert.match(footer, /<ComposerModelMenu/);
});
