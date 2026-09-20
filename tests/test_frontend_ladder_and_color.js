/**
 * Automated test suite for:
 * 1. Multicolumn responsive settings layout
 * 2. Persistent rank ladder overlay & randomize with finale (#1 last)
 * 3. Color grading effects (presets, sliders, live CSS filter sync)
 * 4. Serialization & localStorage persistence
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

// Elements required
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
const previewRankLadder = getOrCreate("preview-rank-ladder");
const toggleRankLadder = getOrCreate("toggle-rank-ladder", "input");
toggleRankLadder.type = "checkbox";
const rankLadderPos = getOrCreate("rank-ladder-pos", "select");
rankLadderPos.value = "left";

const colorGradingPreset = getOrCreate("color-grading-preset", "select");
colorGradingPreset.value = "none";
const colorContrast = getOrCreate("color-contrast", "input");
colorContrast.value = "1.0";
const colorContrastVal = getOrCreate("color-contrast-val", "span");
const colorSaturation = getOrCreate("color-saturation", "input");
colorSaturation.value = "1.0";
const colorSaturationVal = getOrCreate("color-saturation-val", "span");
const colorBrightness = getOrCreate("color-brightness", "input");
colorBrightness.value = "0.0";
const colorBrightnessVal = getOrCreate("color-brightness-val", "span");
const colorWarmth = getOrCreate("color-warmth", "input");
colorWarmth.value = "0.0";
const colorWarmthVal = getOrCreate("color-warmth-val", "span");
const btnResetColorGrading = getOrCreate("btn-reset-color-grading", "button");

const btnRandomizeFinale = getOrCreate("btn-randomize-finale", "button");
const btnRandomizePlacements = getOrCreate("btn-randomize-placements", "button");
const bulkModal = getOrCreate("bulk-add-modal");
const bulkItemsInput = getOrCreate("bulk-items-input", "textarea");
const bulkRandomizeOrder = getOrCreate("bulk-randomize-order", "input");
bulkRandomizeOrder.type = "checkbox";
const bulkRandomizeFinale = getOrCreate("bulk-randomize-finale", "input");
bulkRandomizeFinale.type = "checkbox";
const bulkClearExisting = getOrCreate("bulk-clear-existing", "input");
bulkClearExisting.type = "checkbox";
bulkClearExisting.checked = true;
const btnProcessBulkAdd = getOrCreate("btn-process-bulk-add", "button");
const btnCloseBulkModal = getOrCreate("btn-close-bulk-modal", "button");
const btnBulkAdd = getOrCreate("btn-bulk-add", "button");

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
global.fetch = async () => ({ ok: true, json: async () => ({ status: "ok" }) });

// Load app.js
const appJsPath = path.join(__dirname, "../app/static/app.js");
const appJsCode = fs.readFileSync(appJsPath, "utf-8");
eval(appJsCode);

console.log("=== 1. Testing Randomize with Finale (#1 Last) ===");
itemsContainer.innerHTML = "";
const sampleOtters = [
  { rank: "5", title: "Baby Otter Splash", source: "a.mp4" },
  { rank: "4", title: "Sleepy Floating Otter", source: "b.mp4" },
  { rank: "3", title: "Hand Holding Otters", source: "c.mp4" },
  { rank: "2", title: "Otter Belly Rubs", source: "d.mp4" },
  { rank: "1", title: "Otter Hugs Finale", source: "e.mp4" }
];
sampleOtters.forEach(c => window.addItem(c));

// Execute Randomize with Finale
window.randomizeWithFinale();

const finaleItems = window.getItemsData();
if (finaleItems.length !== 5) {
  throw new Error(`Expected 5 items after randomizeWithFinale, got ${finaleItems.length}`);
}

// Crucial requirement: Rank 1 MUST be in the last clip slot!
const lastItem = finaleItems[finaleItems.length - 1];
if (Number(lastItem.rank) !== 1) {
  throw new Error(`Rank 1 was NOT placed in the final slot! Got rank ${lastItem.rank} at last position`);
}

// Preceding items must NOT be rank 1, but must be a permutation of 2..5
const precedingRanks = finaleItems.slice(0, 4).map(it => Number(it.rank)).sort((a, b) => a - b);
if (precedingRanks.join(",") !== "2,3,4,5") {
  throw new Error(`Preceding ranks corrupted: ${precedingRanks.join(",")}`);
}

// All 5 original titles must be preserved
const resultTitles = finaleItems.map(it => it.title).sort();
const originalTitles = sampleOtters.map(it => it.title).sort();
if (resultTitles.join("|") !== originalTitles.join("|")) {
  throw new Error("Titles were lost during randomizeWithFinale");
}
console.log("✓ randomizeWithFinale guarantees Rank 1 is in the final slot while other ranks are scrambled!");

console.log("=== 2. Testing Bulk Add with Finale Randomization ===");
bulkItemsInput.value = "1. Golden Play\n2. Silver Play\n3. Bronze Play\n4. Highlight Play\n5. Opening Move";
bulkRandomizeFinale.checked = true;
bulkClearExisting.checked = true;

btnProcessBulkAdd.dispatchEvent({ type: "click" });

const bulkFinaleItems = window.getItemsData();
if (bulkFinaleItems.length !== 5) throw new Error(`Bulk items count mismatch: ${bulkFinaleItems.length}`);
const bulkLastItem = bulkFinaleItems[bulkFinaleItems.length - 1];
if (Number(bulkLastItem.rank) !== 1) {
  throw new Error(`Bulk Add with Finale did not put Rank 1 last: got ${bulkLastItem.rank}`);
}
console.log("✓ Bulk Add with Finale randomization verified!");

console.log("=== 3. Testing Color Grading Live CSS Filter Sync ===");
colorGradingPreset.value = "cinematic";
colorContrast.value = "1.2";
colorSaturation.value = "1.3";
colorBrightness.value = "0.02";
colorWarmth.value = "0.2";

const filterStr = window.getLiveColorGradingFilter();
console.log("Live Cinematic Filter String:", filterStr);
if (!filterStr.includes("contrast") || !filterStr.includes("saturate") || !filterStr.includes("sepia")) {
  throw new Error(`Invalid live color grading filter string: ${filterStr}`);
}

window.updateLivePreview();
if (!previewActiveVideo.style.filter || !previewActiveVideo.style.filter.includes("contrast")) {
  throw new Error(`previewActiveVideo filter not applied: ${previewActiveVideo.style.filter}`);
}

// Reset Colors
btnResetColorGrading.dispatchEvent({ type: "click" });
window.updateLivePreview();
if (colorGradingPreset.value !== "none") throw new Error("Preset did not reset to none");
if (colorContrast.value !== "1.0") throw new Error("Contrast did not reset to 1.0");
console.log("✓ Color grading live preview CSS filter & reset verified!");

console.log("=== 4. Testing Persistent Rank Ladder Live Overlay ===");
toggleRankLadder.checked = true;
rankLadderPos.value = "left";

window.updateLivePreview();
if (previewRankLadder.style.display === "none") {
  throw new Error("previewRankLadder should be visible when toggleRankLadder is checked");
}
if (!previewRankLadder.classList.contains("ladder-pos-left")) {
  throw new Error(`previewRankLadder missing ladder-pos-left: ${previewRankLadder.className}`);
}

// Test ladder rows generation
window.renderPreviewRankLadder(2); // active clip at index 2
const ladderRows = previewRankLadder.querySelectorAll(".rank-ladder-row");
if (ladderRows.length !== 5) {
  throw new Error(`Expected 5 ladder rows, found ${ladderRows.length}`);
}
// Check that row has class active for currently playing clip
const activeLadderRow = ladderRows.find(r => r.classList.contains("active"));
if (!activeLadderRow) {
  throw new Error("No active rank ladder row found for current clip");
}
console.log("✓ Persistent rank ladder live overlay rendering verified!");

console.log("=== 5. Testing Multicolumn Layout & Responsive CSS in index.html and style.css ===");
const indexHtmlContent = fs.readFileSync(path.join(__dirname, "../app/static/index.html"), "utf-8");
const styleCssContent = fs.readFileSync(path.join(__dirname, "../app/static/style.css"), "utf-8");

if (!indexHtmlContent.includes("settings-sidebar-grid")) {
  throw new Error("index.html missing settings-sidebar-grid container");
}
if (!indexHtmlContent.includes('id="group-color"')) {
  throw new Error("index.html missing group-color accordion section");
}
if (!indexHtmlContent.includes('id="toggle-rank-ladder"')) {
  throw new Error("index.html missing toggle-rank-ladder");
}
if (!indexHtmlContent.includes('id="preview-rank-ladder"')) {
  throw new Error("index.html missing preview-rank-ladder");
}

if (!styleCssContent.includes("@container (min-width: 660px)")) {
  throw new Error("style.css missing @container (min-width: 660px) rule for multi-column grid");
}
if (!styleCssContent.includes(".rank-ladder-container")) {
  throw new Error("style.css missing .rank-ladder-container rules");
}
console.log("✓ Multicolumn CSS and DOM markup verified!");

console.log("=== 6. Testing Form Config Serialization & Persistence ===");
toggleRankLadder.checked = true;
rankLadderPos.value = "right";
colorGradingPreset.value = "vibrant";
colorContrast.value = "1.15";
colorSaturation.value = "1.25";

const cfg = window.getFormConfig();
if (cfg.show_rank_ladder !== true) throw new Error("show_rank_ladder != true");
if (cfg.rank_ladder_position !== "right") throw new Error("rank_ladder_position != right");
if (cfg.color_grading_preset !== "vibrant") throw new Error("color_grading_preset != vibrant");
if (cfg.color_contrast !== 1.15) throw new Error(`color_contrast expected 1.15, got ${cfg.color_contrast}`);
if (cfg.color_saturation !== 1.25) throw new Error(`color_saturation expected 1.25, got ${cfg.color_saturation}`);

window.saveFormState();
// Clear DOM values
toggleRankLadder.checked = false;
rankLadderPos.value = "left";
colorGradingPreset.value = "none";
colorContrast.value = "1.0";

const reloaded = window.loadFormState();
if (!reloaded) throw new Error("loadFormState returned false");
if (toggleRankLadder.checked !== true) throw new Error("Restored toggleRankLadder != true");
if (rankLadderPos.value !== "right") throw new Error("Restored rankLadderPos != right");
if (colorGradingPreset.value !== "vibrant") throw new Error("Restored colorGradingPreset != vibrant");
if (colorContrast.value !== "1.15") throw new Error("Restored colorContrast != 1.15");
console.log("✓ Form config serialization and localStorage persistence verified!");

console.log("\n=======================================================");
console.log("SUCCESS: All frontend ladder & color tests passed!");
console.log("=======================================================\n");
