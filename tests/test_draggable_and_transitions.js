/**
 * Automated test for Draggable Splitter, Intro Duration, Transitions, and Text Animations.
 */

const fs = require("fs");
const path = require("path");

class MockElement {
  constructor(tagName = "div", id = "") {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = "";
    this.value = "";
    this.textContent = "";
    this._innerHTML = "";
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.listeners = {};
    this.options = [];
    this.checked = false;
    this.classList = {
      add: (cls) => { if (!this.className.includes(cls)) this.className = (this.className + " " + cls).trim(); },
      remove: (cls) => { this.className = this.className.replace(new RegExp(`(^|\\s)${cls}(\\s|$)`), " ").trim(); },
      contains: (cls) => this.className.split(/\s+/).includes(cls),
      toggle: (cls) => { if (this.classList.contains(cls)) this.classList.remove(cls); else this.classList.add(cls); }
    };
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.children = [];
    const tagMatches = val.match(/<([a-zA-Z0-9-]+)([^>]*)>/g) || [];
    tagMatches.forEach(tagStr => {
      const tagMatch = tagStr.match(/<([a-zA-Z0-9-]+)/);
      const classMatch = tagStr.match(/class="([^"]+)"/);
      const idMatch = tagStr.match(/id="([^"]+)"/);
      const valMatch = tagStr.match(/value="([^"]*)"/);

      if (tagMatch) {
        const child = new MockElement(tagMatch[1]);
        if (classMatch) child.className = classMatch[1];
        if (idMatch) child.id = idMatch[1];
        if (valMatch) child.value = valMatch[1];
        child.parentElement = this;
        this.children.push(child);
      }
    });
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    if (this.tagName === "SELECT") {
      this.options.push(child);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  dispatchEvent(event) {
    const type = typeof event === "string" ? event : event.type;
    const handlers = this.listeners[type] || [];
    handlers.forEach(h => h({ target: this, type, clientX: event.clientX || 0, preventDefault: () => {} }));
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const results = [];
    function search(node) {
      for (const c of node.children) {
        if (sel.startsWith("#") && c.id === sel.slice(1)) results.push(c);
        else if (sel.startsWith(".") && c.className.split(" ").includes(sel.slice(1))) results.push(c);
        else if (sel.includes('[name="') && sel.includes(c.name)) results.push(c);
        else if (sel.includes('[value="') && sel.includes(c.value)) results.push(c);
        else if (sel.toLowerCase() === c.tagName.toLowerCase()) results.push(c);
        search(c);
      }
    }
    search(this);
    return results;
  }

  getBoundingClientRect() {
    return { left: 800, top: 0, width: 380, height: 800 };
  }
}

const elementsMap = new Map();
function getOrCreate(id, tag = "div") {
  if (!elementsMap.has(id)) {
    const el = new MockElement(tag, id);
    elementsMap.set(id, el);
  }
  return elementsMap.get(id);
}

// Elements setup
const itemsContainer = getOrCreate("items-container");
const btnAddItem = getOrCreate("btn-add-item", "button");
const btnShuffleItems = getOrCreate("btn-shuffle-items", "button");
const btnGenerate = getOrCreate("btn-generate", "button");
const btnExportTop = getOrCreate("btn-export-top", "button");
const btnCancelJob = getOrCreate("btn-cancel-job", "button");
const videoTitle = getOrCreate("video-title", "textarea");
videoTitle.value = "CHAMPIONS\nOF 2026";
const resolutionPreset = getOrCreate("resolution-preset", "select");
resolutionPreset.value = "1080x1920";
const fontSelect = getOrCreate("font-select", "select");
fontSelect.value = "Geist";
const accentColor = getOrCreate("accent-color", "input");
accentColor.value = "gold";
const bgColor = getOrCreate("bg-color", "input");
bgColor.value = "0x141414";
const introSeconds = getOrCreate("intro-seconds", "input");
introSeconds.value = "4.5";
const transitionsToggle = getOrCreate("transitions-toggle", "input");
transitionsToggle.checked = true;

const splitterResizer = getOrCreate("splitter-resizer");
const studioStagePanel = getOrCreate("studio-stage-panel");
studioStagePanel.style.width = "380px";

const titleWordsContainer = getOrCreate("title-words-container");
const btnResetWordColors = getOrCreate("btn-reset-word-colors", "button");
const previewScreen = getOrCreate("preview-screen");
const previewIntroContent = getOrCreate("preview-intro-content");
const previewItemContent = getOrCreate("preview-item-content");
const previewIntroTitle = getOrCreate("preview-intro-title");
const previewItemTopTitle = getOrCreate("preview-item-top-title");
const previewClipTitle = getOrCreate("preview-clip-title");
const previewClipSource = getOrCreate("preview-clip-source");
const previewClipFramingBadge = getOrCreate("preview-clip-framing-badge");
const previewItemClipBox = getOrCreate("preview-item-clip-box");
const previewItemLabel = getOrCreate("preview-item-label");
const previewItemSelectorWrapper = getOrCreate("preview-item-selector-wrapper");
const previewItemSelect = getOrCreate("preview-item-select", "select");

const radioFit = new MockElement("input");
radioFit.name = "clip-fit";
radioFit.value = "fit";
radioFit.checked = true;

const radioSeq = new MockElement("input");
radioSeq.name = "preview-mode";
radioSeq.value = "sequence";
radioSeq.checked = true;

const radioIntro = new MockElement("input");
radioIntro.name = "preview-mode";
radioIntro.value = "intro";
radioIntro.checked = false;

const radioItem = new MockElement("input");
radioItem.name = "preview-mode";
radioItem.value = "item";
radioItem.checked = false;

const rootDoc = new MockElement("body");
rootDoc.appendChild(itemsContainer);
rootDoc.appendChild(titleWordsContainer);
rootDoc.appendChild(radioFit);
rootDoc.appendChild(radioSeq);
rootDoc.appendChild(radioIntro);
rootDoc.appendChild(radioItem);
rootDoc.appendChild(splitterResizer);
rootDoc.appendChild(studioStagePanel);

// Mock window and document
const storageStore = {};
global.window = global;
global.window.addEventListener = (event, handler) => {
  rootDoc.addEventListener(event, handler);
};
global.document = {
  body: rootDoc,
  getElementById: id => elementsMap.get(id) || null,
  createElement: tag => new MockElement(tag),
  querySelector: sel => {
    if (sel.includes('name="preview-mode"')) {
      if (sel.includes(':checked')) {
        if (radioSeq.checked) return radioSeq;
        if (radioIntro.checked) return radioIntro;
        return radioItem;
      }
    }
    if (sel.includes('name="clip-fit"')) {
      return radioFit;
    }
    return rootDoc.querySelector(sel);
  },
  querySelectorAll: sel => {
    if (sel.includes('name="preview-mode"')) return [radioSeq, radioIntro, radioItem];
    if (sel.includes('name="clip-fit"')) return [radioFit];
    return rootDoc.querySelectorAll(sel);
  }
};
global.localStorage = {
  getItem: key => storageStore[key] || null,
  setItem: (key, val) => { storageStore[key] = String(val); },
  removeItem: key => { delete storageStore[key]; }
};

// Load app.js
const appJsPath = path.resolve(__dirname, "../app/static/app.js");
const appJsContent = fs.readFileSync(appJsPath, "utf-8");
eval(appJsContent);

console.log("=== 1. Testing Intro Seconds Dynamic Segment Length ===");
introSeconds.value = "5.0";
introSeconds.dispatchEvent("input");

const segs = window.timelinePlayer.segments;
console.log(`Timeline intro segment duration: ${segs[0].duration}s (expected 5.0s)`);
if (segs[0].duration !== 5.0) {
  throw new Error(`Expected intro duration 5.0s, got ${segs[0].duration}`);
}

console.log("=== 2. Testing Transitions Toggle & Config ===");
const cfg = window.getFormConfig();
console.log("cfg.intro_seconds:", cfg.intro_seconds, "cfg.transitions:", cfg.transitions);
if (cfg.intro_seconds !== 5.0) throw new Error("Config intro_seconds invalid");
if (cfg.transitions !== true) throw new Error("Config transitions should be true");

transitionsToggle.checked = false;
transitionsToggle.dispatchEvent("change");
const cfg2 = window.getFormConfig();
if (cfg2.transitions !== false) throw new Error("Config transitions should be false after toggle");

console.log("=== 3. Testing Draggable Splitter Resizer ===");
// Simulate mousedown at clientX = 800
splitterResizer.dispatchEvent({ type: "mousedown", clientX: 800 });
if (!splitterResizer.classList.contains("dragging")) {
  throw new Error("splitterResizer should have .dragging class on mousedown");
}
if (!rootDoc.classList.contains("resizing-panel")) {
  throw new Error("document.body should have .resizing-panel class on mousedown");
}

// Drag left by 70px (clientX = 730) -> stage width should increase from 380 to 450
rootDoc.dispatchEvent({ type: "mousemove", clientX: 730 });
console.log("Stage panel width after dragging left 70px:", studioStagePanel.style.width);
if (studioStagePanel.style.width !== "450px") {
  throw new Error(`Expected width 450px, got ${studioStagePanel.style.width}`);
}

// Release drag
rootDoc.dispatchEvent({ type: "mouseup", clientX: 730 });
if (splitterResizer.classList.contains("dragging")) {
  throw new Error("splitterResizer should not have .dragging after mouseup");
}
if (rootDoc.classList.contains("resizing-panel")) {
  throw new Error("document.body should not have .resizing-panel after mouseup");
}

console.log("=== 4. Testing Text & Clip Preview Animations ===");
radioSeq.checked = false;
radioIntro.checked = true;
radioIntro.dispatchEvent("change");
window.updateLivePreview();
console.log("Intro title classes:", previewIntroTitle.className);
if (!previewIntroTitle.className.includes("animate-pop")) {
  throw new Error("previewIntroTitle should have animate-pop class");
}

radioIntro.checked = false;
radioItem.checked = true;
radioItem.dispatchEvent("change");
window.updateLivePreview();
console.log("Item label classes:", previewItemLabel.className);
if (!previewItemLabel.className.includes("animate-slide")) {
  throw new Error("previewItemLabel should have animate-slide class");
}
if (!previewItemClipBox.className.includes("animate-clip")) {
  throw new Error("previewItemClipBox should have animate-clip class");
}

console.log("=== 5. Testing Dynamic Responsive Preview Screen Resizing ===");
const stageContainer = getOrCreate("preview-frame-container");
stageContainer.getBoundingClientRect = () => ({ width: 600, height: 800 });
window.fitPreviewToStage();
console.log("Preview screen size in 600x800 stage:", previewScreen.style.width, previewScreen.style.height);
// 800 - 24 = 776 height. 776 * 9 / 16 = 437px width.
if (previewScreen.style.height !== "776px" || previewScreen.style.width !== "437px") {
  throw new Error(`Expected 437px x 776px, got ${previewScreen.style.width} x ${previewScreen.style.height}`);
}

// Now simulate narrower stage: 300x800
stageContainer.getBoundingClientRect = () => ({ width: 300, height: 800 });
window.fitPreviewToStage();
console.log("Preview screen size in 300x800 stage:", previewScreen.style.width, previewScreen.style.height);
// 300 - 24 = 276 width. 276 / (9 / 16) = 491px height.
if (previewScreen.style.width !== "276px" || previewScreen.style.height !== "491px") {
  throw new Error(`Expected 276px x 491px, got ${previewScreen.style.width} x ${previewScreen.style.height}`);
}
console.log("✓ Dynamic responsive fitting verified without hardcoded pixel limits!");

console.log("\n=======================================================");
console.log("SUCCESS: All Draggable, Intro, and Animation tests passed!");
console.log("=======================================================\n");
