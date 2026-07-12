import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_IMAGE_GENERATION_CONFIG,
  getImageGenerationDisplayPrompt,
  getImageGenerationDisplayPromptFromSerialized,
  IMAGE_GENERATION_PLUGIN_TOKEN,
  mergePromptWithImageGenerationConfig,
  restoreImageGenerationPluginFromPrompt,
} from "../../src/ui/components/prompt-input/image-generation-plugin.js";
import {
  buildQueuedDisplayPrompt,
  buildQueuedPrompt,
  type QueuedMessageDraft,
} from "../../src/ui/components/prompt-input/prompt-queue.js";

test("serializes the image-generation plugin without exposing its editor token", () => {
  const prompt = mergePromptWithImageGenerationConfig(
    `画一只猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`,
    DEFAULT_IMAGE_GENERATION_CONFIG,
  );

  assert.doesNotMatch(prompt, /\[\[image_generation\]\]/);
  assert.match(prompt, /<image_generation>/);
  assert.match(prompt, /"aspectRatio": "16:9"/);
  assert.match(prompt, /"resolution": "2K"/);
  assert.match(prompt, /"width": 2848/);
  assert.match(prompt, /"height": 1600/);
  assert.match(prompt, /"count": 1/);
});

test("leaves prompts without the image-generation plugin unchanged", () => {
  assert.equal(
    mergePromptWithImageGenerationConfig("普通文本", DEFAULT_IMAGE_GENERATION_CONFIG),
    "普通文本",
  );
});

test("removes the editor-only image token from the displayed user prompt", () => {
  assert.equal(
    getImageGenerationDisplayPrompt(`画一只跳舞的小猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`),
    "画一只跳舞的小猫",
  );
});

test("recovers clean display text from historical serialized image prompts", () => {
  const serialized = mergePromptWithImageGenerationConfig(
    `画一只跳舞的小猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`,
    DEFAULT_IMAGE_GENERATION_CONFIG,
  );

  assert.equal(getImageGenerationDisplayPromptFromSerialized(serialized), "画一只跳舞的小猫");
  assert.equal(getImageGenerationDisplayPromptFromSerialized("普通历史消息"), "普通历史消息");
  assert.equal(
    getImageGenerationDisplayPromptFromSerialized("画一只跳舞的小猫 <image_ge..."),
    "画一只跳舞的小猫",
  );
});

test("renders the image-generation token as an explicit blue skill chip", () => {
  const editorSource = readFileSync("src/ui/utils/prompt-editor-content.ts", "utf8");
  assert.match(editorSource, /bg-blue-50/);
  assert.match(editorSource, /text-blue-700/);
  assert.match(editorSource, /ring-blue-200/);
});

test("queued image prompts retain an editable token and scoped configuration", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const serialized = mergePromptWithImageGenerationConfig(
    `画一只猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`,
    { ...DEFAULT_IMAGE_GENERATION_CONFIG, aspectRatio: "1:1", width: 4096, height: 4096, count: 3 },
  );
  const restored = restoreImageGenerationPluginFromPrompt(serialized);

  assert.deepEqual(restored, {
    prompt: `画一只猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`,
    config: { ...DEFAULT_IMAGE_GENERATION_CONFIG, aspectRatio: "1:1", width: 4096, height: 4096, count: 3 },
  });
  assert.match(promptInputSource, /restoreImageGenerationPluginFromPrompt\(queuedMessage\.agentPrompt \?\? queuedMessage\.prompt\)/);
});

test("keeps image-generation instructions out of the displayed user message", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const promptActionsSource = readFileSync("src/ui/components/prompt-input/usePromptActions.ts", "utf8");

  assert.match(
    promptInputSource,
    /sendPromptDraft\(displayPrompt, attachmentsSnapshot, \{\s*agentPrompt: promptForDispatch,/,
  );
  assert.match(promptActionsSource, /agentPrompt\?: string/);
  assert.match(promptActionsSource, /const promptForAgentInput = agentPrompt \?\? promptValue/);
});

test("queued prompts preserve separate display and agent payloads", () => {
  const agentPrompt = mergePromptWithImageGenerationConfig(
    `画一只跳舞的小猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`,
    DEFAULT_IMAGE_GENERATION_CONFIG,
  );
  const queue: QueuedMessageDraft[] = [{
    id: "queued-image",
    prompt: `画一只跳舞的小猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`,
    agentPrompt,
    attachments: [],
    createdAt: 1,
  }];

  assert.equal(buildQueuedDisplayPrompt(queue), `画一只跳舞的小猫 ${IMAGE_GENERATION_PLUGIN_TOKEN}`);
  assert.equal(buildQueuedPrompt(queue), agentPrompt);
  assert.doesNotMatch(buildQueuedDisplayPrompt(queue), /<image_generation>/);
  assert.match(buildQueuedPrompt(queue), /<image_generation>/);
});

test("append queue events display the user prompt but execute the agent prompt", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const uiTypes = readFileSync("src/ui/types.ts", "utf8");
  const electronTypes = readFileSync("src/electron/types.ts", "utf8");
  const ipcHandlers = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(promptInputSource, /prompt: queuedMessage\.prompt,\s*agentPrompt: queuedMessage\.agentPrompt,/);
  assert.match(uiTypes, /session\.append[^\n]+agentPrompt\?: string/);
  assert.match(electronTypes, /session\.append[^\n]+agentPrompt\?: string/);
  assert.match(ipcHandlers, /const displayPrompt = event\.payload\.prompt/);
  assert.match(ipcHandlers, /await handle\.appendPrompt\(agentPrompt, agentAttachments\)/);
});

test("historical user cards hide serialized image-generation instructions", () => {
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(eventCardSource, /getImageGenerationDisplayPromptFromSerialized/);
  assert.match(eventCardSource, /const displayCompatiblePrompt = getImageGenerationDisplayPromptFromSerialized\(message\.prompt\)/);
  assert.match(eventCardSource, /extractBrowserAnnotationsPrompt\(displayCompatiblePrompt\)/);
});

test("historical session titles hide serialized image-generation instructions", () => {
  const sidebarSource = readFileSync("src/ui/components/sidebar/SidebarWorkspaceList.tsx", "utf8");

  assert.match(sidebarSource, /getImageGenerationDisplayPromptFromSerialized\(session\.title\)/);
});
