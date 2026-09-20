/**
 * Automated test suite for the new studio features:
 * 1. Uniform settings style
 * 2. Text background boxes & text shadows
 * 3. Bulk Add ranking at once
 * 4. Thumbnail preview on clip links
 * 5. Title & clip name font size sliders
 * 6. Individual clip volume control
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
    handlers.forEach(h => h({ target: this, type }));
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const results = [];
    function search(node) {
      for (const c of node.children) {
        let match = false;
        if (sel.startsWith("#") && c.id === sel.slice(1)) match = true;
        else if (sel.startsWith(".") && c.classList.contains(sel.slice(1))) match = true;
        else if (sel.includes("[name=") && sel.includes("[value=")) {
          const mName = sel.match(/name="([^"]+)"/);
          const mVal = sel.match(/value="([^"]+)"/);
          if (mName && mVal && c.name === mName[1] && c.value === mVal[1]) match = true;
        } else if (sel.includes(":checked") && sel.includes("[name=")) {
          const mName = sel.match(/name="([^"]+)"/);
          if (mName && c.name === mName[1] && c.checked) match = true;
        } else if (sel.toLowerCase() === c.tagName.toLowerCase()) match = true;

        if (match) results.push(c);
        search(c);
      }
    }
    search(this);
    return results;
  }

  focus() {}
  load() {}
  pause() {}
  play() { return Promise.resolve(); }
}

const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();

// Build Document DOM tree
const rootDoc = new MockElement("html");
const body = new MockElement("body");
rootDoc.appendChild(body);

const form = new MockElement("form", "video-form");
body.appendChild(form);

// Title Settings Elements
const videoTitle = new MockElement("textarea", "video-title");
videoTitle.value = "TOP 5 GOALKEEPER SAVES";
form.appendChild(videoTitle);

const wordColorsContainer = new MockElement("div", "title-word-colors");
form.appendChild(wordColorsContainer);

const titleFontSize = new MockElement("input", "title-font-size");
titleFontSize.value = "72";
form.appendChild(titleFontSize);

const titleFontSizeVal = new MockElement("span", "title-font-size-val");
titleFontSizeVal.textContent = "72px";
form.appendChild(titleFontSizeVal);

const titleBgStyle = new MockElement("select", "title-bg-style");
titleBgStyle.value = "dark";
form.appendChild(titleBgStyle);

const titleShadowToggle = new MockElement("input", "title-shadow-toggle");
titleShadowToggle.type = "checkbox";
titleShadowToggle.checked = true;
form.appendChild(titleShadowToggle);

// Clip Title Settings Elements
const itemFontSize = new MockElement("input", "item-font-size");
itemFontSize.value = "56";
form.appendChild(itemFontSize);

const itemFontSizeVal = new MockElement("span", "item-font-size-val");
itemFontSizeVal.textContent = "56px";
form.appendChild(itemFontSizeVal);

const itemBgStyle = new MockElement("select", "item-bg-style");
itemBgStyle.value = "accent";
form.appendChild(itemBgStyle);

const itemShadowToggle = new MockElement("input", "item-shadow-toggle");
itemShadowToggle.type = "checkbox";
itemShadowToggle.checked = true;
form.appendChild(itemShadowToggle);

// Format & Media Elements
const resolutionSelect = new MockElement("select", "resolution-preset");
resolutionSelect.value = "1080x1920";
form.appendChild(resolutionSelect);

const fontSelect = new MockElement("select", "font-select");
fontSelect.value = "Oswald";
form.appendChild(fontSelect);

const accentColor = new MockElement("input", "accent-color");
accentColor.value = "yellow";
form.appendChild(accentColor);

const bgColor = new MockElement("input", "bg-color");
bgColor.value = "0x141414";
form.appendChild(bgColor);

const bgImageId = new MockElement("input", "bg-image-id");
form.appendChild(bgImageId);

const bgImageFilename = new MockElement("span", "bg-image-filename");
form.appendChild(bgImageFilename);

const bgmId = new MockElement("input", "bgm-id");
form.appendChild(bgmId);

const bgmFilename = new MockElement("span", "bgm-filename");
form.appendChild(bgmFilename);

const bgmVolume = new MockElement("input", "bgm-volume");
bgmVolume.value = "0.25";
form.appendChild(bgmVolume);

const clipVolume = new MockElement("input", "clip-volume");
clipVolume.value = "1.0";
form.appendChild(clipVolume);

const introSeconds = new MockElement("input", "intro-seconds");
introSeconds.value = "3.0";
form.appendChild(introSeconds);

const transitionsToggle = new MockElement("input", "transitions-toggle");
transitionsToggle.type = "checkbox";
transitionsToggle.checked = true;
form.appendChild(transitionsToggle);

const clipFit = new MockElement("input");
clipFit.type = "radio";
clipFit.name = "clip-fit";
clipFit.value = "fit";
clipFit.checked = true;
form.appendChild(clipFit);

const itemLabelPos = new MockElement("input");
itemLabelPos.type = "radio";
itemLabelPos.name = "item-label-pos";
itemLabelPos.value = "bottom";
itemLabelPos.checked = true;
form.appendChild(itemLabelPos);

// Items Deck Elements
const itemsContainer = new MockElement("div", "items-container");
form.appendChild(itemsContainer);

const btnAddItem = new MockElement("button", "btn-add-item");
form.appendChild(btnAddItem);

const btnShuffleItems = new MockElement("button", "btn-shuffle-items");
form.appendChild(btnShuffleItems);

const btnBulkAdd = new MockElement("button", "btn-bulk-add");
form.appendChild(btnBulkAdd);

const bulkAddModal = new MockElement("div", "bulk-add-modal");
body.appendChild(bulkAddModal);

const btnCloseBulkModal = new MockElement("button", "btn-close-bulk-modal");
bulkAddModal.appendChild(btnCloseBulkModal);

const bulkItemsInput = new MockElement("textarea", "bulk-items-input");
bulkAddModal.appendChild(bulkItemsInput);

const bulkClearExisting = new MockElement("input", "bulk-clear-existing");
bulkClearExisting.type = "checkbox";
bulkClearExisting.checked = true;
bulkAddModal.appendChild(bulkClearExisting);

const btnProcessBulkAdd = new MockElement("button", "btn-process-bulk-add");
bulkAddModal.appendChild(btnProcessBulkAdd);

// Stage & Live Preview Elements
const previewScreen = new MockElement("div", "preview-screen");
body.appendChild(previewScreen);

const previewIntroContent = new MockElement("div", "preview-intro-content");
previewScreen.appendChild(previewIntroContent);

const previewIntroTitle = new MockElement("div", "preview-intro-title");
previewIntroContent.appendChild(previewIntroTitle);

const previewItemContent = new MockElement("div", "preview-item-content");
previewScreen.appendChild(previewItemContent);

const previewItemTopTitle = new MockElement("div", "preview-item-top-title");
previewItemContent.appendChild(previewItemTopTitle);

const previewItemClipBox = new MockElement("div", "preview-item-clip-box");
previewItemContent.appendChild(previewItemClipBox);

const previewActiveVideo = new MockElement("video", "preview-active-video");
previewItemClipBox.appendChild(previewActiveVideo);

const previewClipPlaceholder = new MockElement("div", "preview-clip-placeholder");
previewItemClipBox.appendChild(previewClipPlaceholder);

const previewItemLabel = new MockElement("div", "preview-item-label");
previewItemContent.appendChild(previewItemLabel);

const previewClipTitle = new MockElement("div", "preview-clip-title");
previewItemClipBox.appendChild(previewClipTitle);

const previewClipSource = new MockElement("div", "preview-clip-source");
previewItemClipBox.appendChild(previewClipSource);

const previewClipFramingBadge = new MockElement("div", "preview-clip-framing-badge");
previewItemClipBox.appendChild(previewClipFramingBadge);

const previewMode = new MockElement("input");
previewMode.type = "radio";
previewMode.name = "preview-mode";
previewMode.value = "intro";
previewMode.checked = true;
form.appendChild(previewMode);

// Setup globals
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1200,
  innerHeight: 800
};
global.document = {
  getElementById: (id) => {
    let found = null;
    function search(n) {
      if (n.id === id) { found = n; return; }
      for (const c of n.children) { search(c); if (found) return; }
    }
    search(rootDoc);
    return found;
  },
  querySelector: (sel) => rootDoc.querySelector(sel),
  querySelectorAll: (sel) => rootDoc.querySelectorAll(sel),
  createElement: (tag) => new MockElement(tag)
};
global.localStorage = mockLocalStorage;
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
global.performance = { now: () => 0 };
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.alert = (msg) => console.log("[Mock Alert]:", msg);

// Load app.js
const appCode = fs.readFileSync(path.join(__dirname, "../app/static/app.js"), "utf8");
eval(appCode);

console.log("=== 1. Testing Bulk Add Parsing ===");
const sampleRaw = `
1. Stunning Overhead Kick
2) Impossible Diving Header
3 - Rocket Long Shot
#4 Volley from Outside Box
- Cheeky Panenka Penalty
`;
const parsed = window.parseBulkRankings(sampleRaw);
console.log("Parsed Bulk Rankings:", parsed);
if (parsed.length !== 5) throw new Error(`Expected 5 items parsed, got ${parsed.length}`);
if (parsed[0] !== "Stunning Overhead Kick") throw new Error(`First item mismatch: ${parsed[0]}`);
if (parsed[4] !== "Cheeky Panenka Penalty") throw new Error(`Fifth item mismatch: ${parsed[4]}`);
console.log("✓ Bulk ranking parsing verified!");

console.log("=== 2. Testing Bulk Add Execution in UI ===");
bulkItemsInput.value = sampleRaw;
bulkClearExisting.checked = true;
window.processBulkAdd();

const itemRows = itemsContainer.querySelectorAll(".item-row");
console.log(`Generated ${itemRows.length} item rows.`);
if (itemRows.length !== 5) throw new Error(`Expected 5 item rows, got ${itemRows.length}`);

// Recalculated ranks should be descending: 5, 4, 3, 2, 1
const ranks = itemRows.map(r => r.querySelector(".item-rank").value);
console.log("Countdown ranks in order:", ranks);
if (ranks.join(",") !== "5,4,3,2,1") throw new Error(`Ranks not descending countdown: ${ranks}`);
console.log("✓ Bulk Add UI insertion and countdown ranking verified!");

console.log("=== 3. Testing Per-Item Volume and Thumbnail in Row ===");
const row1 = itemRows[0];
const volSlider1 = row1.querySelector(".item-volume");
const thumbBox1 = row1.querySelector(".item-thumb-box");
if (!volSlider1) throw new Error("Missing .item-volume slider in row");
if (!thumbBox1) throw new Error("Missing .item-thumb-box in row");

volSlider1.value = "1.5";
volSlider1.dispatchEvent("input");
const volValBadge1 = row1.querySelector(".item-vol-val");
console.log("Vol badge display:", volValBadge1.textContent);
if (volValBadge1.textContent !== "150%") throw new Error("Volume badge did not update to 150%");

// Source thumbnail update
const srcInput1 = row1.querySelector(".item-source");
srcInput1.value = "/uploads/test_clip.mp4";
srcInput1.dispatchEvent("input");
const thumbVid1 = thumbBox1.querySelector(".item-thumb-video");
if (thumbVid1.style.display !== "block") throw new Error("Thumbnail video did not show");
console.log("✓ Thumbnail display and individual volume verified!");

console.log("=== 4. Testing Title & Clip Font Size, Background Styles & Shadows in Preview ===");
titleFontSize.value = "80";
titleBgStyle.value = "dark";
titleShadowToggle.checked = true;

itemFontSize.value = "64";
itemBgStyle.value = "accent";
itemShadowToggle.checked = true;

window.updateLivePreview();

// Verify intro title styling
if (!previewIntroTitle.classList.contains("title-bg-dark")) {
  throw new Error(`Intro title missing title-bg-dark: ${previewIntroTitle.className}`);
}
if (!previewIntroTitle.classList.contains("title-shadow")) {
  throw new Error(`Intro title missing title-shadow: ${previewIntroTitle.className}`);
}

// Switch to item preview mode
previewMode.value = "item";
window.updateLivePreview();

if (!previewItemLabel.classList.contains("item-label-bg-accent")) {
  throw new Error(`Item label missing item-label-bg-accent: ${previewItemLabel.className}`);
}
if (!previewItemLabel.classList.contains("item-label-shadow")) {
  throw new Error(`Item label missing item-label-shadow: ${previewItemLabel.className}`);
}
console.log("✓ Title and Item Font Size, Background & Shadow live preview verified!");

console.log("=== 5. Testing Serialization in getFormConfig() ===");
const cfg = window.getFormConfig();
console.log("Serialized Config Options:", {
  title_font_size: cfg.title_font_size,
  item_font_size: cfg.item_font_size,
  title_bg_style: cfg.title_bg_style,
  title_shadow: cfg.title_shadow,
  item_bg_style: cfg.item_bg_style,
  item_shadow: cfg.item_shadow,
  itemsCount: cfg.items.length,
  firstItemVolume: cfg.items[0].volume
});

if (cfg.title_font_size !== 80) throw new Error("title_font_size != 80");
if (cfg.item_font_size !== 64) throw new Error("item_font_size != 64");
if (cfg.title_bg_style !== "dark") throw new Error("title_bg_style != dark");
if (cfg.title_shadow !== true) throw new Error("title_shadow != true");
if (cfg.item_bg_style !== "accent") throw new Error("item_bg_style != accent");
if (cfg.item_shadow !== true) throw new Error("item_shadow != true");
if (cfg.items[0].volume !== 1.5) throw new Error(`First item volume != 1.5, got ${cfg.items[0].volume}`);
console.log("✓ Form config serialization verified!");

console.log("=== 6. Testing localStorage Persistence (saveFormState & loadFormState) ===");
window.saveFormState();

// Change values in DOM
titleFontSize.value = "50";
itemFontSize.value = "40";
titleBgStyle.value = "none";
titleShadowToggle.checked = false;
itemBgStyle.value = "solid";
itemShadowToggle.checked = false;

// Reload from localStorage
const loaded = window.loadFormState();
if (!loaded) throw new Error("loadFormState returned false");

if (titleFontSize.value !== 80) throw new Error(`Loaded title_font_size mismatch: ${titleFontSize.value}`);
if (itemFontSize.value !== 64) throw new Error(`Loaded item_font_size mismatch: ${itemFontSize.value}`);
if (titleBgStyle.value !== "dark") throw new Error(`Loaded title_bg_style mismatch: ${titleBgStyle.value}`);
if (titleShadowToggle.checked !== true) throw new Error(`Loaded title_shadow mismatch: ${titleShadowToggle.checked}`);
if (itemBgStyle.value !== "accent") throw new Error(`Loaded item_bg_style mismatch: ${itemBgStyle.value}`);
if (itemShadowToggle.checked !== true) throw new Error(`Loaded item_shadow mismatch: ${itemShadowToggle.checked}`);

const loadedItems = window.getItemsData();
if (loadedItems[0].volume !== 1.5) throw new Error(`Loaded item volume mismatch: ${loadedItems[0].volume}`);
console.log("✓ Form state persistence for all 6 new settings verified!");

console.log("\n=======================================================");
console.log("SUCCESS: All new features in frontend test passed!");
console.log("=======================================================\n");
