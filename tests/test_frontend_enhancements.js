/**
 * Automated test suite for enhanced features:
 * 1. Preview sound and mute toggle
 * 2. Download status pills (Empty, Downloading, Ready, Download Failed)
 * 3. Pre-filled ranks & randomized placement shuffling
 * 4. Framing boxes (blur & card)
 * 5. Extended font sizes (up to 250px)
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
    this._checked = false;
    this.type = "";
    this.name = "";
    this.volume = 1.0;
    this.muted = false;
    this.currentTime = 0;
    this.classList = {
      add: (...classes) => {
        classes.forEach(cls => {
          if (!this.className.split(/\s+/).includes(cls)) {
            this.className = (this.className + " " + cls).trim();
          }
        });
      },
      remove: (...classes) => {
        classes.forEach(cls => {
          this.className = this.className.split(/\s+/).filter(c => c !== cls).join(" ").trim();
        });
      },
      contains: (cls) => this.className.split(/\s+/).includes(cls),
      toggle: (cls) => {
        if (this.classList.contains(cls)) this.classList.remove(cls);
        else this.classList.add(cls);
      }
    };
  }

  get checked() {
    return this._checked;
  }

  set checked(val) {
    this._checked = Boolean(val);
    if (this.type === "radio" && this._checked && this.parentElement) {
      const form = this.closest ? this.closest("form") : null;
      const root = form || document;
      const radios = root.querySelectorAll(`input[type="radio"][name="${this.name}"]`);
      radios.forEach(r => {
        if (r !== this) r._checked = false;
      });
    }
  }

  getAttribute(name) {
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.dataset[key] !== undefined ? this.dataset[key] : null;
    }
    return this[name] !== undefined ? this[name] : null;
  }

  setAttribute(name, val) {
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = val;
    } else {
      this[name] = val;
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.children = [];
    if (!val) return;
    const tokens = val.match(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g) || [];
    let current = this;
    const stack = [this];
    tokens.forEach(tok => {
      if (tok.startsWith("</")) {
        if (stack.length > 1) {
          stack.pop();
          current = stack[stack.length - 1];
        }
      } else {
        const isSelfClosing = tok.endsWith("/>") || /<(img|input|hr|br|source)/i.test(tok);
        const tagMatch = tok.match(/<([a-zA-Z0-9-]+)/);
        const classMatch = tok.match(/class="([^"]+)"/);
        const idMatch = tok.match(/id="([^"]+)"/);
        const valMatch = tok.match(/value="([^"]*)"/);
        const typeMatch = tok.match(/type="([^"]*)"/);
        const nameMatch = tok.match(/name="([^"]*)"/);

        if (tagMatch) {
          const child = new MockElement(tagMatch[1]);
          if (classMatch) child.className = classMatch[1];
          if (idMatch) child.id = idMatch[1];
          if (valMatch) child.value = valMatch[1];
          if (typeMatch) child.type = typeMatch[1];
          if (nameMatch) child.name = nameMatch[1];
          current.appendChild(child);
          if (!isSelfClosing) {
            stack.push(child);
            current = child;
          }
        }
      }
    });
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  dispatchEvent(event) {
    const handlers = this.listeners[event.type] || [];
    handlers.forEach(h => h(event));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const check = (node) => {
      if (selector.startsWith("#") && node.id === selector.slice(1)) results.push(node);
      else if (selector.startsWith(".") && node.classList.contains(selector.slice(1))) results.push(node);
      else if (selector.toLowerCase() === node.tagName.toLowerCase()) results.push(node);
      else if (selector.includes("[name=")) {
        const m = selector.match(/\[name="([^"]+)"\]/);
        if (m && node.name === m[1]) results.push(node);
      }
      for (const child of node.children) check(child);
    };
    for (const child of this.children) check(child);
    return results;
  }

  closest(selector) {
    let p = this.parentElement;
    while (p) {
      if (selector.startsWith(".") && p.classList.contains(selector.slice(1))) return p;
      if (selector.startsWith("#") && p.id === selector.slice(1)) return p;
      if (p.tagName.toLowerCase() === selector.toLowerCase()) return p;
      p = p.parentElement;
    }
    return null;
  }

  play() { return Promise.resolve(); }
  pause() {}
  load() {}
}

const elementStore = new Map();
function getOrCreate(id, tag = "div") {
  if (!elementStore.has(id)) {
    elementStore.set(id, new MockElement(tag, id));
  }
  return elementStore.get(id);
}

// Elements required by app.js
const itemsContainer = getOrCreate("items-container");
const previewActiveVideo = getOrCreate("preview-active-video", "video");
const previewBgmAudio = getOrCreate("preview-bgm-audio", "audio");
const previewClipBox = getOrCreate("preview-item-clip-box");
const previewItemLabel = getOrCreate("preview-item-label");
const previewItemTopTitle = getOrCreate("preview-item-top-title");
const previewIntroTitle = getOrCreate("preview-intro-title");
const previewIntroContent = getOrCreate("preview-intro-content");
const previewItemContent = getOrCreate("preview-item-content");
const previewScreen = getOrCreate("preview-screen");
const btnPreviewMute = getOrCreate("btn-preview-mute", "button");
const btnRandomizePlacements = getOrCreate("btn-randomize-placements", "button");
const bulkModal = getOrCreate("bulk-add-modal");
const bulkItemsInput = getOrCreate("bulk-items-input", "textarea");
const bulkRandomizeOrder = getOrCreate("bulk-randomize-order", "input");
bulkRandomizeOrder.type = "checkbox";
const bulkClearExisting = getOrCreate("bulk-clear-existing", "input");
bulkClearExisting.type = "checkbox";
bulkClearExisting.checked = true;
const btnProcessBulkAdd = getOrCreate("btn-process-bulk-add", "button");
const btnCloseBulkModal = getOrCreate("btn-close-bulk-modal", "button");
const btnBulkAdd = getOrCreate("btn-bulk-add", "button");

const titleFontSize = getOrCreate("title-font-size", "input");
const itemFontSize = getOrCreate("item-font-size", "input");
const titleBgStyle = getOrCreate("title-bg-style", "select");
const titleShadowToggle = getOrCreate("title-shadow-toggle", "input");
titleShadowToggle.type = "checkbox";
const itemBgStyle = getOrCreate("item-bg-style", "select");
const itemShadowToggle = getOrCreate("item-shadow-toggle", "input");
itemShadowToggle.type = "checkbox";
const previewMode = getOrCreate("preview-mode", "select");
const clipVolume = getOrCreate("clip-volume", "input");
clipVolume.value = "1.0";

const clipFitContainer = new MockElement("div", "clip-fit-radios");
["fit", "fill", "stretch", "blur", "card"].forEach(val => {
  const radio = new MockElement("input");
  radio.type = "radio";
  radio.name = "clip-fit";
  radio.value = val;
  if (val === "fit") radio.checked = true;
  clipFitContainer.appendChild(radio);
});

global.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => {
    if (elementStore.has(id)) return elementStore.get(id);
    return getOrCreate(id);
  },
  querySelector: (sel) => {
    if (sel.startsWith("#")) return document.getElementById(sel.slice(1));
    if (sel.includes('input[name="clip-fit"]:checked') || sel.includes('input[name="clip_fit"]:checked')) {
      const radios = clipFitContainer.querySelectorAll('input');
      return radios.find(r => r.checked) || null;
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('clip-fit') || sel.includes('clip_fit')) {
      return clipFitContainer.querySelectorAll('input');
    }
    return [];
  },
  addEventListener: () => {}
};

const localData = {};
global.localStorage = {
  getItem: (k) => localData[k] || null,
  setItem: (k, v) => { localData[k] = String(v); },
  removeItem: (k) => { delete localData[k]; }
};

global.window = {
  addEventListener: () => {},
  document: global.document,
  localStorage: global.localStorage,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  location: { reload: () => {} }
};

// Mock fetch
global.fetch = async (url) => {
  if (url.includes("/api/media-assets")) {
    return { ok: true, json: async () => ({ videos: [], images: [], bgm: [] }) };
  }
  if (url.includes("/api/recent-videos")) {
    return { ok: true, json: async () => ({ recent: [] }) };
  }
  return { ok: true, json: async () => ({ status: "ok" }) };
};

// Load app.js
const appJsPath = path.join(__dirname, "../app/static/app.js");
const appJsCode = fs.readFileSync(appJsPath, "utf-8");
eval(appJsCode);

console.log("=== 1. Testing Preview Audio & Mute State ===");
// Default preview is unmuted
if (typeof window.setPreviewMute !== "function") {
  throw new Error("window.setPreviewMute is not a function!");
}

// Test Muting
window.setPreviewMute(true);
if (!previewActiveVideo.muted) throw new Error("previewActiveVideo should be muted");
if (!previewBgmAudio.muted) throw new Error("previewBgmAudio should be muted");
if (!btnPreviewMute.classList.contains("muted")) throw new Error("btnPreviewMute should have .muted class");

// Test Unmuting
window.setPreviewMute(false);
if (previewActiveVideo.muted) throw new Error("previewActiveVideo should not be muted");
if (previewBgmAudio.muted) throw new Error("previewBgmAudio should not be muted");
if (btnPreviewMute.classList.contains("muted")) throw new Error("btnPreviewMute should NOT have .muted class");
console.log("✓ Preview Audio and Mute toggling verified!");

console.log("=== 2. Testing Item Download Status Pills ===");
// Create item rows
itemsContainer.innerHTML = "";
window.addItem({ rank: "5", title: "Whale", source: "", start: 0, end: 5, volume: 1.0 });
window.addItem({ rank: "4", title: "Shark", source: "https://example.com/shark.mp4", start: 0, end: 5, volume: 0.8 });
window.addItem({ rank: "3", title: "Dolphin", source: "media/assets/dolphin.mp4", start: 0, end: 5, volume: 1.2 });

const rows = itemsContainer.querySelectorAll(".item-row");
if (rows.length !== 3) throw new Error(`Expected 3 item rows, found ${rows.length}`);

// Empty source check
window.updateItemRowStatus(rows[0]);
const pill0 = rows[0].querySelector(".item-status-pill");
if (!pill0 || !pill0.classList.contains("status-empty") || pill0.textContent !== "No Media") {
  throw new Error(`Row 0 status pill invalid: ${pill0 ? pill0.className + " " + pill0.textContent : "null"}`);
}

// Local ready file check
window.updateItemRowStatus(rows[2]);
const pill2 = rows[2].querySelector(".item-status-pill");
if (!pill2 || !pill2.classList.contains("status-ready") || pill2.textContent !== "Ready") {
  throw new Error(`Row 2 status pill invalid: ${pill2 ? pill2.className + " " + pill2.textContent : "null"}`);
}

// Downloading URL check
window.updateItemRowStatus(rows[1]);
const pill1 = rows[1].querySelector(".item-status-pill");
if (!pill1 || !pill1.classList.contains("status-downloading") || !pill1.textContent.includes("Downloading")) {
  throw new Error(`Row 1 status pill invalid: ${pill1 ? pill1.className + " " + pill1.textContent : "null"}`);
}
console.log("✓ Item download status pills verified!");

console.log("=== 3. Testing Ranked Placement Randomization ===");
// Add 5 items with known data
itemsContainer.innerHTML = "";
const originalClips = [
  { rank: "5", title: "Alpha", source: "a.mp4", volume: 0.5 },
  { rank: "4", title: "Beta", source: "b.mp4", volume: 0.7 },
  { rank: "3", title: "Gamma", source: "c.mp4", volume: 0.9 },
  { rank: "2", title: "Delta", source: "d.mp4", volume: 1.1 },
  { rank: "1", title: "Epsilon", source: "e.mp4", volume: 1.3 }
];
originalClips.forEach(c => window.addItem(c));

// Trigger placement randomization
window.randomizeItemPlacements();

const shuffledItems = window.getItemsData();
if (shuffledItems.length !== 5) throw new Error("Shuffled items length mismatch");

// Ranks must remain strictly ordered 5, 4, 3, 2, 1
const ranks = shuffledItems.map(it => it.rank);
if (ranks.join(",") !== "5,4,3,2,1") {
  throw new Error(`Ranks changed after randomization! Got: ${ranks.join(",")}`);
}

// But the payload titles must be a permutation of Alpha..Epsilon
const titles = shuffledItems.map(it => it.title).sort();
if (titles.join(",") !== "Alpha,Beta,Delta,Epsilon,Gamma") {
  throw new Error(`Titles corrupted after randomization: ${titles.join(",")}`);
}
console.log("✓ Randomize Item Placements preserves ranks while shuffling payloads!");

console.log("=== 4. Testing Bulk Add with Randomization ===");
bulkItemsInput.value = "Falcon\nEagle\nHawk\nOwl\nRaven";
bulkRandomizeOrder.checked = true;
bulkClearExisting.checked = true;

// Click confirm
btnProcessBulkAdd.dispatchEvent({ type: "click" });

const bulkItems = window.getItemsData();
if (bulkItems.length !== 5) throw new Error(`Expected 5 items from bulk add, got ${bulkItems.length}`);
const bulkRanks = bulkItems.map(it => it.rank);
if (bulkRanks.join(",") !== "5,4,3,2,1") {
  throw new Error(`Bulk add ranks invalid: ${bulkRanks.join(",")}`);
}
const bulkTitles = bulkItems.map(it => it.title).sort();
if (bulkTitles.join(",") !== "Eagle,Falcon,Hawk,Owl,Raven") {
  throw new Error(`Bulk add titles missing items: ${bulkTitles.join(",")}`);
}
console.log("✓ Bulk Add with randomize option verified!");

console.log("=== 5. Testing Framing Classes (blur & card) ===");
const radios = clipFitContainer.querySelectorAll('input[name="clip-fit"]');
const blurRadio = radios.find(r => r.value === "blur");
const cardRadio = radios.find(r => r.value === "card");
const fitRadio = radios.find(r => r.value === "fit");

previewMode.value = "item";

// Test blur framing
blurRadio.checked = true;
window.updateLivePreview();
if (!previewScreen.classList.contains("preview-fit-blur")) {
  throw new Error(`previewScreen missing preview-fit-blur: ${previewScreen.className}`);
}

// Test card framing
cardRadio.checked = true;
window.updateLivePreview();
if (!previewScreen.classList.contains("preview-fit-card")) {
  throw new Error(`previewScreen missing preview-fit-card: ${previewScreen.className}`);
}

// Test fit framing
fitRadio.checked = true;
window.updateLivePreview();
if (!previewScreen.classList.contains("preview-fit-fit")) {
  throw new Error(`previewScreen missing preview-fit-fit: ${previewScreen.className}`);
}
console.log("✓ Framing classes (blur, card, fit) preview verified!");

console.log("=== 6. Testing Extended Font Sizes (up to 250px) ===");
titleFontSize.value = "240";
itemFontSize.value = "180";
window.updateLivePreview();

const formCfg = window.getFormConfig();
if (formCfg.title_font_size !== 240) {
  throw new Error(`title_font_size expected 240, got ${formCfg.title_font_size}`);
}
if (formCfg.item_font_size !== 180) {
  throw new Error(`item_font_size expected 180, got ${formCfg.item_font_size}`);
}
console.log("✓ Extended font sizes serialization verified!");

console.log("\n=======================================================");
console.log("SUCCESS: All enhanced features in frontend test passed!");
console.log("=======================================================\n");
