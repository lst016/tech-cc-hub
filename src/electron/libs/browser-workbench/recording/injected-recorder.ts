export function buildBrowserWorkbenchRecorderInjectionScript(): string {
  return `function(options) {
    const cleanup = window.__techCcHubRecorderCleanup;
    if (typeof cleanup === "function") cleanup();
    if (!options || !options.enabled) return false;
    let bridge = window.__techCcHubRecorder;
    if (!bridge || typeof bridge.emit !== "function") {
      const prefix = typeof options.recorderPrefix === "string" ? options.recorderPrefix : "";
      if (!prefix || typeof console === "undefined" || typeof console.log !== "function") return false;
      bridge = {
        emit: function(payload) {
          console.log(prefix + JSON.stringify(payload));
        }
      };
    }

    const inputTimers = new Map();
    let scrollTimer = null;
    const assertionMode = Boolean(options.assertionMode);
    const locatorPickActionId = typeof options.locatorPickActionId === "string" ? options.locatorPickActionId : "";
    let hoveredElement = null;
    let previousOutline = "";
    let previousCursor = "";

    function trimText(value, maxLength) {
      const text = String(value || "").replace(/\\s+/g, " ").trim();
      if (!text) return undefined;
      return text.length > maxLength ? text.slice(0, maxLength - 1) + "..." : text;
    }

    function escapeCss(value) {
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
      return String(value).replace(/[^a-zA-Z0-9_-]/g, function(ch) {
        return "\\\\" + ch.charCodeAt(0).toString(16) + " ";
      });
    }

    function elementText(element) {
      if (!element) return undefined;
      return trimText(element.innerText || element.textContent || "", 120);
    }

    function implicitRole(element) {
      const tag = (element.tagName || "").toLowerCase();
      const type = (element.getAttribute("type") || "").toLowerCase();
      if (element.getAttribute("role")) return element.getAttribute("role");
      if (tag === "a" && element.hasAttribute("href")) return "link";
      if (tag === "button") return "button";
      if (tag === "select") return "combobox";
      if (tag === "textarea") return "textbox";
      if (tag === "input") {
        if (type === "button" || type === "submit" || type === "reset") return "button";
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        return "textbox";
      }
      return undefined;
    }

    function accessibleName(element) {
      if (!element) return undefined;
      const aria = element.getAttribute("aria-label") || element.getAttribute("aria-labelledby");
      if (aria) return trimText(aria, 120);
      const title = element.getAttribute("title");
      if (title) return trimText(title, 120);
      const alt = element.getAttribute("alt");
      if (alt) return trimText(alt, 120);
      const value = element.getAttribute("value");
      const tag = (element.tagName || "").toLowerCase();
      const type = (element.getAttribute("type") || "").toLowerCase();
      if (tag === "input" && (type === "button" || type === "submit" || type === "reset") && value) {
        return trimText(value, 120);
      }
      return elementText(element);
    }

    function selectorFor(element) {
      if (!element || element.nodeType !== 1) return undefined;
      const testAttrs = ["data-testid", "data-test", "data-cy", "data-qa"];
      for (const attr of testAttrs) {
        const value = element.getAttribute(attr);
        if (value) return "[" + attr + "=\\"" + value.replace(/"/g, "\\\\\\"") + "\\"]";
      }
      if (element.id) return "#" + escapeCss(element.id);
      const name = element.getAttribute("name");
      const tag = (element.tagName || "").toLowerCase();
      if (name && /^(input|textarea|select|button)$/.test(tag)) {
        return tag + "[name=\\"" + name.replace(/"/g, "\\\\\\"") + "\\"]";
      }
      const parts = [];
      let current = element;
      while (current && current.nodeType === 1 && current !== document.body && current !== document.documentElement && parts.length < 5) {
        const currentTag = (current.tagName || "").toLowerCase();
        let part = currentTag;
        if (current.classList && current.classList.length) {
          const stableClass = Array.from(current.classList).find(function(item) {
            return item && !/^(active|selected|hover|focus|open|closed|disabled)$/.test(item) && !/^[a-z]+-[a-z0-9]{5,}$/i.test(item);
          });
          if (stableClass) part += "." + escapeCss(stableClass);
        }
        const parent = current.parentElement;
        if (parent) {
          const sameTag = Array.from(parent.children).filter(function(child) {
            return (child.tagName || "").toLowerCase() === currentTag;
          });
          if (sameTag.length > 1) part += ":nth-of-type(" + (sameTag.indexOf(current) + 1) + ")";
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.length ? parts.join(" > ") : undefined;
    }

    function describe(element) {
      if (!element || element.nodeType !== 1) return {};
      return {
        selector: selectorFor(element),
        role: implicitRole(element),
        name: accessibleName(element),
        text: elementText(element),
        tagName: (element.tagName || "").toLowerCase(),
        inputType: (element.getAttribute("type") || "").toLowerCase() || undefined
      };
    }

    function emit(kind, data) {
      bridge.emit(Object.assign({
        kind,
        timestamp: Date.now(),
        url: location.href,
        title: document.title
      }, data || {}));
    }

    function clearHover() {
      if (hoveredElement) {
        hoveredElement.style.outline = previousOutline;
        hoveredElement = null;
      }
    }

    function setHover(element) {
      if (!locatorPickActionId || !element || element === hoveredElement || element === document.documentElement || element === document.body) return;
      clearHover();
      hoveredElement = element;
      previousOutline = element.style.outline || "";
      element.style.outline = "2px solid #2563eb";
    }

    function isFormControl(element) {
      const tag = (element && element.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || Boolean(element && element.isContentEditable);
    }

    function editableValue(element) {
      if (!element) return "";
      if (element.isContentEditable) return element.textContent || "";
      return typeof element.value === "string" ? element.value : "";
    }

    function recordEditable(element) {
      const target = describe(element);
      const tag = (element.tagName || "").toLowerCase();
      const type = (element.getAttribute("type") || "").toLowerCase();
      const key = target.selector || target.name || target.text || Math.random().toString(16);
      if (inputTimers.has(key)) clearTimeout(inputTimers.get(key));
      inputTimers.set(key, setTimeout(function() {
        inputTimers.delete(key);
        if (tag === "select") {
          emit("select", { target, value: element.value || "" });
          return;
        }
        if (type === "checkbox" || type === "radio") {
          emit(element.checked ? "check" : "uncheck", { target, checked: Boolean(element.checked) });
          return;
        }
        emit("fill", { target, value: editableValue(element) });
      }, 220));
    }

    function onClick(event) {
      const element = event.target && event.target.closest ? event.target.closest("a,button,input,textarea,select,label,[role],summary,[contenteditable='true'],[tabindex]") : event.target;
      if (!element || element === document.documentElement || element === document.body) return;
      if (locatorPickActionId) {
        event.preventDefault();
        event.stopPropagation();
        emit("__repairLocator", { actionId: locatorPickActionId, target: describe(element) });
        clearHover();
        return;
      }
      if (assertionMode) {
        event.preventDefault();
        event.stopPropagation();
        emit("assertVisible", { target: describe(element) });
        return;
      }
      if (isFormControl(element)) return;
      emit("click", { target: describe(element) });
    }

    function onInput(event) {
      const element = event.target;
      if (isFormControl(element)) recordEditable(element);
    }

    function onKeyDown(event) {
      const specialKeys = new Set(["Enter", "Tab", "Escape", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
      if (!specialKeys.has(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) return;
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) return;
      const parts = [];
      if (event.metaKey) parts.push("Meta");
      if (event.ctrlKey) parts.push("Control");
      if (event.altKey) parts.push("Alt");
      if (event.shiftKey && event.key !== "Shift") parts.push("Shift");
      parts.push(event.key);
      emit("press", { key: parts.join("+"), target: describe(event.target) });
    }

    function onScroll() {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function() {
        scrollTimer = null;
        emit("scroll", { scrollX: window.scrollX || 0, scrollY: window.scrollY || 0 });
      }, 260);
    }

    function onMouseOver(event) {
      const element = event.target && event.target.closest ? event.target.closest("a,button,input,textarea,select,label,[role],summary,[contenteditable='true'],[tabindex],div,span") : event.target;
      setHover(element);
    }

    function onBeforeUnload() {
      for (const timer of inputTimers.values()) clearTimeout(timer);
      inputTimers.clear();
      if (scrollTimer) clearTimeout(scrollTimer);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("beforeunload", onBeforeUnload, true);
    if (locatorPickActionId && document.body) {
      previousCursor = document.body.style.cursor || "";
      document.body.style.cursor = "crosshair";
    }

    window.__techCcHubRecorderCleanup = function() {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("beforeunload", onBeforeUnload, true);
      if (locatorPickActionId && document.body) document.body.style.cursor = previousCursor;
      clearHover();
      onBeforeUnload();
      window.__techCcHubRecorderCleanup = null;
    };
    return true;
  }`;
}
