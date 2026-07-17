import assert from "node:assert/strict";
import test from "node:test";

import {
  extractBrowserTerminalViaDebugger,
  type BrowserTerminalDebuggerClient,
} from "../../src/electron/libs/browser-workbench/browser-terminal-debugger.js";
import { normalizeBrowserTerminalReadInput } from "../../src/electron/libs/browser-workbench/browser-terminal-reader.js";

test("debugger terminal reader walks an event-listener closure to a private xterm instance", async () => {
  const calls: string[] = [];
  const client: BrowserTerminalDebuggerClient = {
    async sendCommand(method, params = {}) {
      calls.push(method);
      if (method === "DOM.getDocument") {
        return {
          root: {
            nodeId: 1,
            nodeName: "#document",
            children: [{
              nodeId: 2,
              nodeName: "TEXTAREA",
              attributes: ["class", "xterm-helper-textarea"],
            }],
          },
        };
      }
      if (method === "DOM.resolveNode") return { object: { objectId: "textarea" } };
      if (method === "DOMDebugger.getEventListeners") {
        return { listeners: [{ type: "keydown", handler: { objectId: "handler" } }] };
      }
      if (method === "Runtime.callFunctionOn") {
        const objectId = String(params.objectId);
        if (objectId === "terminal") {
          return {
            result: {
              value: {
                matched: true,
                route: "buffer",
                extraction: {
                  source: "xterm-debugger",
                  text: "private terminal output\nroot@host:~#",
                  lineCount: 2,
                  physicalLineCount: 2,
                  startLine: 10,
                  endLine: 11,
                  truncated: true,
                  truncatedStart: true,
                },
              },
            },
          };
        }
        return { result: { value: { matched: false } } };
      }
      if (method === "Runtime.getProperties") {
        const objectId = String(params.objectId);
        if (objectId === "handler") {
          return { result: [], internalProperties: [{ name: "[[Scopes]]", value: { objectId: "scopes" } }] };
        }
        if (objectId === "scopes") {
          return { result: [{ name: "0", value: { objectId: "closure" } }], internalProperties: [] };
        }
        if (objectId === "closure") {
          return { result: [{ name: "term", value: { objectId: "terminal" } }], internalProperties: [] };
        }
        return { result: [], internalProperties: [] };
      }
      return {};
    },
  };

  const result = await extractBrowserTerminalViaDebugger(
    client,
    normalizeBrowserTerminalReadInput({ scope: "tail", maxLines: 200 }),
  );

  assert.equal(result.terminal?.source, "xterm-debugger");
  assert.equal(result.terminal?.text, "private terminal output\nroot@host:~#");
  assert.match(result.terminal?.targetPath ?? "", /listener\(keydown\).*\[\[Scopes\]\].*term\.buffer/);
  assert.equal(result.listenersInspected, 1);
  assert.equal(calls.includes("DOMDebugger.getEventListeners"), true);
  assert.equal(calls.includes("Runtime.callFunctionOn"), true);
  assert.equal(calls.includes("Runtime.releaseObjectGroup"), true);
});
