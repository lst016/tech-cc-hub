import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  buildBrowserTerminalReadExpression,
  createBrowserTerminalFingerprint,
  normalizeBrowserTerminalReadInput,
} from "../../src/electron/libs/browser-workbench/browser-terminal-reader.js";

function createDocument(canvases: unknown[] = []) {
  return {
    querySelectorAll(selector: string) {
      if (selector === "canvas") return canvases;
      return [];
    },
  };
}

test("terminal reader discovers a public xterm buffer exposed by a prototype getter", () => {
  const physicalLines = [
    { isWrapped: false, translateToString: () => "old output" },
    { isWrapped: false, translateToString: () => "wrapped-" },
    { isWrapped: true, translateToString: () => "command result" },
    { isWrapped: false, translateToString: () => "root@host:~#" },
  ];
  const activeBuffer = {
    type: "normal",
    length: physicalLines.length,
    baseY: 1,
    viewportY: 1,
    cursorX: 12,
    cursorY: 2,
    getLine(index: number) {
      return physicalLines[index];
    },
  };

  class SparseTerminal {
    cols = 80;
    rows = 24;
  }
  Object.defineProperty(SparseTerminal.prototype, "buffer", {
    configurable: true,
    get: () => ({ active: activeBuffer, normal: activeBuffer }),
  });

  const term = new SparseTerminal();
  assert.deepEqual(Object.keys(term), ["cols", "rows"]);

  const context = {
    document: createDocument(),
    window: { term },
  };
  const result = vm.runInNewContext(
    buildBrowserTerminalReadExpression({ scope: "tail", maxLines: 3 }),
    context,
  );

  assert.equal(result.readable, true);
  assert.equal(result.terminals.length, 1);
  assert.equal(result.terminals[0].source, "xterm-buffer");
  assert.equal(result.terminals[0].targetPath, "term");
  assert.equal(result.terminals[0].text, "wrapped-command result\nroot@host:~#");
  assert.equal(result.terminals[0].physicalLineCount, 3);
  assert.equal(result.terminals[0].truncatedStart, true);
  assert.equal(result.terminals[0].baseY, 1);
  assert.equal(result.terminals[0].viewportY, 1);
  assert.equal(result.terminals[0].cursorY, 2);
});

test("terminal reader reports canvas-only frames as non-semantic instead of pretending OCR", () => {
  const canvas = {
    width: 1600,
    height: 900,
    classList: [],
    tagName: "CANVAS",
    id: "terminal-layer",
    getBoundingClientRect: () => ({ width: 800, height: 450 }),
    getAttribute: () => null,
    closest: (selector: string) => selector === ".xterm" ? {} : null,
  };
  const context = {
    document: createDocument([canvas]),
    window: {},
  };
  const result = vm.runInNewContext(buildBrowserTerminalReadExpression(), context);

  assert.equal(result.readable, false);
  assert.equal(result.terminals.length, 0);
  assert.equal(result.canvases.length, 1);
  assert.equal(result.canvases[0].insideXterm, true);
  assert.match(result.warnings.join("\n"), /Canvas pixels expose no semantic text/);
});

test("terminal reader finds a JumpServer-style terminal on an ancestor Vue component", () => {
  const bufferLine = { isWrapped: false, translateToString: () => "root@jumpserver:~#" };
  const activeBuffer = {
    length: 1,
    baseY: 0,
    viewportY: 0,
    cursorX: 19,
    cursorY: 0,
    getLine: () => bufferLine,
  };
  const term = Object.create({
    get buffer() {
      return { active: activeBuffer, normal: activeBuffer };
    },
  });

  const parents = new WeakMap<object, object | null>();
  class FakeElement {
    id = "";
    tagName = "DIV";
    classList: string[] = [];
    get parentElement() { return parents.get(this) ?? null; }
    matches(selector: string) { return selector === ".xterm"; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { width: 640, height: 480 }; }
  }
  const root = new FakeElement();
  const middle = new FakeElement();
  const component = new FakeElement() as FakeElement & { __vue__: { term: unknown } };
  component.__vue__ = { term };
  parents.set(root, middle);
  parents.set(middle, component);
  parents.set(component, null);

  const context = {
    document: {
      querySelectorAll(selector: string) {
        if (selector === ".xterm") return [root];
        return [];
      },
    },
    window: {},
  };
  const result = vm.runInNewContext(buildBrowserTerminalReadExpression(), context);

  assert.equal(result.readable, true);
  assert.equal(result.terminals[0].text, "root@jumpserver:~#");
  assert.match(result.terminals[0].targetPath, /ancestor\[2\]\.__vue__\.term/);
});

test("terminal reader discovers xterm roots inside open shadow roots", () => {
  const line = { isWrapped: false, translateToString: () => "shadow-root-terminal" };
  const buffer = { length: 1, getLine: () => line };
  const terminal = { buffer: { active: buffer, normal: buffer } };
  const component = {
    __vue__: { term: terminal },
    parentElement: null,
    id: "",
    tagName: "SECTION",
    classList: [],
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  };
  const xtermRoot = {
    parentElement: component,
    id: "terminal",
    tagName: "DIV",
    classList: ["xterm"],
    matches: (selector: string) => selector === ".xterm",
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  };
  const shadowRoot = {
    querySelectorAll(selector: string) {
      if (selector === ".xterm" || selector === "*") return [xtermRoot];
      return [];
    },
  };
  const shadowHost = { shadowRoot };
  const context = {
    document: {
      querySelectorAll(selector: string) {
        if (selector === "*") return [shadowHost];
        return [];
      },
    },
    window: {},
  };

  const result = vm.runInNewContext(buildBrowserTerminalReadExpression(), context);

  assert.equal(result.readable, true);
  assert.equal(result.terminals[0].text, "shadow-root-terminal");
});

test("terminal fingerprints are stable and change with semantic output", () => {
  const first = createBrowserTerminalFingerprint([
    { source: "xterm-buffer", text: "root@host:~#", lineCount: 1, truncated: false, frameUrl: "https://jump/" },
  ]);
  const same = createBrowserTerminalFingerprint([
    { source: "xterm-buffer", text: "root@host:~#", lineCount: 1, truncated: false, frameUrl: "https://jump/" },
  ]);
  const changed = createBrowserTerminalFingerprint([
    { source: "xterm-buffer", text: "root@host:~# pwd", lineCount: 1, truncated: false, frameUrl: "https://jump/" },
  ]);

  assert.equal(first, same);
  assert.notEqual(first, changed);
  assert.match(first, /^xterm-[0-9a-f]{8}-\d+$/);
});

test("terminal read limits are normalized to bounded defaults", () => {
  assert.deepEqual(normalizeBrowserTerminalReadInput({
    scope: "all",
    maxLines: 99_999,
    maxChars: 1,
    buffer: "normal",
    targetPath: "  win.term  ",
  }), {
    scope: "all",
    maxLines: 2_000,
    maxChars: 1_000,
    buffer: "normal",
    targetPath: "win.term",
  });
});
