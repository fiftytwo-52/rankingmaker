/**
 * Automated test for Frontend Live Preview Screen & Word-by-Word Title Coloring.
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
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.children = [];
    // Extract class and id elements from HTML string
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
    if (this.tagName === "SELECT") {
      const optIdx = this.options.indexOf(child);
      if (optIdx !== -1) this.options.splice(optIdx, 1);
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
        if (sel.startsWith("#") && c.id === sel.slice(1)) results.push(c);
        else if (sel.startsWith(".") && c.className.split(" ").includes(sel.slice(1))) results.push(c);
        else if (sel.includes("[name=") || sel.includes("[value=")) {
          if (sel.includes('value="') && sel.includes(c.value)) results.push(c);
        } else if (sel.toLowerCase() === c.tagName.toLowerCase()) results.push(c);
        search(c);
      }
    }
    search(this);
    return results;
  }
}

// Minimal DOM environment
const elementsMap = new Map();
function getOrCreate(id, tag = "div") {
  if (!elementsMap.has(id)) {
    const el = new MockElement(tag, id);
    elementsMap.set(id, el);
  }
  return elementsMap.get(id);
}

// Setup elements required by index.html & app.js
const itemsContainer = getOrCreate("items-container");
const btnAddItem = getOrCreate("btn-add-item", "button");
const btnGenerate = getOrCreate("btn-generate", "button");
const btnCancelJob = getOrCreate("btn-cancel-job", "button");
const videoTitle = getOrCreate("video-title", "input");
videoTitle.value = "TOP 5 GREATEST GOALS";
const resolutionPreset = getOrCreate("resolution-preset", "select");
resolutionPreset.value = "1920x1080";
const accentColor = getOrCreate("accent-color", "input");
accentColor.value = "yellow";
const bgColor = getOrCreate("bg-color", "input");
bgColor.value = "0x141414";

const titleWordsContainer = getOrCreate("title-words-container");
const btnResetWordColors = getOrCreate("btn-reset-word-colors", "button");
const previewScreen = getOrCreate("preview-screen");
const previewIntroContent = getOrCreate("preview-intro-content");
const previewItemContent = getOrCreate("preview-item-content");
const previewIntroTitle = getOrCreate("preview-intro-title");
const previewItemTopTitle = getOrCreate("preview-item-top-title");
const previewClipTitle = getOrCreate("preview-clip-title");
const previewClipSource = getOrCreate("preview-clip-source");
const previewItemLabel = getOrCreate("preview-item-label");
const previewItemSelectorWrapper = getOrCreate("preview-item-selector-wrapper");
const previewItemSelect = getOrCreate("preview-item-select", "select");

const bgImageFile = getOrCreate("bg-image-file", "input");
const btnUploadBgImage = getOrCreate("btn-upload-bg-image", "button");
const bgImageFilename = getOrCreate("bg-image-filename", "span");
const bgImageId = getOrCreate("bg-image-id", "input");
const bgmFile = getOrCreate("bgm-file", "input");
const btnUploadBgm = getOrCreate("btn-upload-bgm", "button");
const bgmFilename = getOrCreate("bgm-filename", "span");
const bgmId = getOrCreate("bgm-id", "input");
const bgmVolume = getOrCreate("bgm-volume", "input");
const clipVolume = getOrCreate("clip-volume", "input");
const videoForm = getOrCreate("video-form", "form");

const radioIntro = new MockElement("input");
radioIntro.name = "preview-mode";
radioIntro.value = "intro";
radioIntro.checked = true;

const radioItem = new MockElement("input");
radioItem.name = "preview-mode";
radioItem.value = "item";
radioItem.checked = false;

const rootDoc = new MockElement("body");
rootDoc.appendChild(itemsContainer);
rootDoc.appendChild(titleWordsContainer);
rootDoc.appendChild(radioIntro);
rootDoc.appendChild(radioItem);

// Mock window and document
const storageStore = {};
global.window = global;
global.document = {
  getElementById: id => elementsMap.get(id) || null,
  createElement: tag => new MockElement(tag),
  querySelector: sel => {
    if (sel.includes('name="preview-mode"')) {
      if (sel.includes(':checked')) return radioIntro.checked ? radioIntro : radioItem;
      if (sel.includes('value="intro"')) return radioIntro;
      if (sel.includes('value="item"')) return radioItem;
    }
    return rootDoc.querySelector(sel);
  },
  querySelectorAll: sel => {
    if (sel.includes('name="preview-mode"')) return [radioIntro, radioItem];
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

console.log("=== Step 1: Testing Word-by-Word Color Chips Generation ===");
window.renderWordColorChips();
const chips = titleWordsContainer.children;
console.log(`Generated ${chips.length} word chips for '${videoTitle.value}'`);
if (chips.length !== 4) throw new Error(`Expected 4 word chips, got ${chips.length}`);

console.log("=== Step 2: Testing Word Color Selection ===");
// Change color of word '5' (index 1) to red (#ff0000)
const colorInputWord5 = chips[1].querySelector(".word-color-input");
colorInputWord5.value = "#ff0000";
colorInputWord5.dispatchEvent("input");

const wordsData = window.getTitleWordsData();
console.log("wordsData:", wordsData);
if (!wordsData || wordsData.length !== 4) throw new Error("wordsData length invalid");
if (wordsData[1].word !== "5" || wordsData[1].color !== "#ff0000") {
  throw new Error(`Word 5 color should be #ff0000, got ${wordsData[1].color}`);
}

console.log("=== Step 3: Verifying Intro Preview Rendering ===");
console.log("Intro preview HTML:", previewIntroTitle.innerHTML);
if (!previewIntroTitle.innerHTML.includes("#ff0000") || !previewIntroTitle.innerHTML.includes("5")) {
  throw new Error("Intro preview does not contain colored word '5'!");
}
if (previewScreen.style.aspectRatio !== "16 / 9") {
  throw new Error(`Expected aspect ratio '16 / 9', got '${previewScreen.style.aspectRatio}'`);
}

console.log("=== Step 4: Verifying Aspect Ratio Switching (Portrait 9:16) ===");
resolutionPreset.value = "1080x1920";
resolutionPreset.dispatchEvent("change");
if (previewScreen.style.aspectRatio !== "9 / 16") {
  throw new Error(`Expected aspect ratio '9 / 16', got '${previewScreen.style.aspectRatio}'`);
}
console.log("Aspect ratio switched to 9 / 16 successfully!");

console.log("=== Step 5: Verifying Item Clip Preview Mode ===");
radioIntro.checked = false;
radioItem.checked = true;
radioItem.dispatchEvent("change");

if (previewIntroContent.style.display !== "none") throw new Error("Intro should be hidden in item mode");
if (previewItemContent.style.display !== "block") throw new Error("Item view should be visible in item mode");
console.log("Item top title HTML:", previewItemTopTitle.innerHTML);
if (!previewItemTopTitle.innerHTML.includes("#ff0000")) {
  throw new Error("Item top banner does not reflect word colors!");
}

console.log("=== Step 6: Verifying Form Config Serialization ===");
const cfg = window.getFormConfig();
if (!cfg.title_words || cfg.title_words.length !== 4) {
  throw new Error("getFormConfig() must include title_words array!");
}
if (cfg.title_words[1].color !== "#ff0000") {
  throw new Error("getFormConfig() title_words[1].color is not #ff0000");
}
console.log("Form config correctly includes title_words:", cfg.title_words);

console.log("=== Step 7: Verifying localStorage Persistence ===");
window.saveFormState();
const rawSaved = storageStore["ranking_video_form_state"];
if (!rawSaved) throw new Error("Form state not found in localStorage!");
const parsed = JSON.parse(rawSaved);
if (!parsed.title_words || parsed.title_words[1].color !== "#ff0000") {
  throw new Error("title_words not properly persisted in localStorage!");
}
console.log("localStorage persistence verified successfully!");

console.log("\n=======================================================");
console.log("SUCCESS: All Frontend Preview & Word Color tests passed!");
console.log("=======================================================\n");
