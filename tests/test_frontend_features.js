/**
 * Automated test for Frontend Timeline Player, Multiline Titles, Fonts, and Shuffle Ranking.
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
      add: (cls) => { if (!this.className.includes(cls)) this.className += ` ${cls}`; },
      remove: (cls) => { this.className = this.className.replace(cls, "").trim(); },
      contains: (cls) => this.className.includes(cls),
      toggle: (cls) => { if (this.className.includes(cls)) this.classList.remove(cls); else this.classList.add(cls); }
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
        else if (sel.includes('value="') && sel.includes(c.value)) results.push(c);
        else if (sel.toLowerCase() === c.tagName.toLowerCase()) results.push(c);
        search(c);
      }
    }
    search(this);
    return results;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 400, height: 28 };
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

// Register DOM elements
const itemsContainer = getOrCreate("items-container");
const btnAddItem = getOrCreate("btn-add-item", "button");
const btnShuffleItems = getOrCreate("btn-shuffle-items", "button");
const btnGenerate = getOrCreate("btn-generate", "button");
const btnExportTop = getOrCreate("btn-export-top", "button");
const btnCancelJob = getOrCreate("btn-cancel-job", "button");
const videoTitle = getOrCreate("video-title", "textarea");
videoTitle.value = "TOP 3\nGREATEST MOMENTS";
const resolutionPreset = getOrCreate("resolution-preset", "select");
resolutionPreset.value = "1920x1080";
const fontSelect = getOrCreate("font-select", "select");
fontSelect.value = "Impact";
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
const previewClipFramingBadge = getOrCreate("preview-clip-framing-badge");
const previewItemClipBox = getOrCreate("preview-item-clip-box");
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

// Timeline elements
const btnTimelinePlay = getOrCreate("btn-timeline-play", "button");
const btnTimelineRewind = getOrCreate("btn-timeline-rewind", "button");
const timelineTimecode = getOrCreate("timeline-timecode");
const timelineScrubber = getOrCreate("timeline-scrubber");
const timelineSegmentsTrack = getOrCreate("timeline-segments-track");
const timelineProgressFill = getOrCreate("timeline-progress-fill");
const timelinePlayhead = getOrCreate("timeline-playhead");
const timelineActiveSegment = getOrCreate("timeline-active-segment");
const timelineLoopToggle = getOrCreate("timeline-loop-toggle", "input");
timelineLoopToggle.checked = true;
const iconPlay = getOrCreate("icon-play");
const iconPause = getOrCreate("icon-pause");

const radioFit = new MockElement("input");
radioFit.name = "clip-fit";
radioFit.value = "fill";
radioFit.checked = true;

const radioSequence = new MockElement("input");
radioSequence.name = "preview-mode";
radioSequence.value = "sequence";
radioSequence.checked = true;

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
rootDoc.appendChild(timelineSegmentsTrack);
rootDoc.appendChild(radioFit);
rootDoc.appendChild(radioSequence);
rootDoc.appendChild(radioIntro);
rootDoc.appendChild(radioItem);

const storageStore = {};
global.window = global;
global.document = {
  getElementById: id => elementsMap.get(id) || null,
  createElement: tag => new MockElement(tag),
  querySelector: sel => {
    if (sel.includes('name="preview-mode"')) {
      if (sel.includes(':checked')) return radioSequence.checked ? radioSequence : (radioIntro.checked ? radioIntro : radioItem);
      if (sel.includes('value="sequence"')) return radioSequence;
      if (sel.includes('value="intro"')) return radioIntro;
      if (sel.includes('value="item"')) return radioItem;
    }
    if (sel.includes('name="clip-fit"')) {
      return radioFit;
    }
    return rootDoc.querySelector(sel);
  },
  querySelectorAll: sel => {
    if (sel.includes('name="preview-mode"')) return [radioSequence, radioIntro, radioItem];
    if (sel.includes('name="clip-fit"')) return [radioFit];
    return rootDoc.querySelectorAll(sel);
  }
};
global.localStorage = {
  getItem: key => storageStore[key] || null,
  setItem: (key, val) => { storageStore[key] = String(val); },
  removeItem: key => { delete storageStore[key]; }
};

// Evaluate app.js
const appJsPath = path.resolve(__dirname, "../app/static/app.js");
eval(fs.readFileSync(appJsPath, "utf-8"));

console.log("=== 1. Testing Multiline Title & Font Family in Preview ===");
window.updateLivePreview();
if (!previewIntroTitle.innerHTML.includes("<br>")) {
  throw new Error("Multiline title did not render <br> line break in preview intro!");
}
if (!previewScreen.style.fontFamily.includes("Impact")) {
  throw new Error(`Expected font family to include 'Impact', got '${previewScreen.style.fontFamily}'`);
}
console.log("✓ Multiline title and font selection rendered successfully in preview!");

console.log("=== 2. Testing Timeline Player Segments & Seeking ===");
itemsContainer.innerHTML = "";
window.addItem("Gold Medal Play", "clip1.mp4", 0, 8);
window.addItem("Silver Medal Play", "clip2.mp4", 0, 6);
const player = window.timelinePlayer;
player.buildSegments();

console.log(`Total duration: ${player.totalDuration}s with ${player.segments.length} segments`);
if (player.segments.length !== 3) throw new Error(`Expected 3 segments (intro + 2 items), got ${player.segments.length}`);
if (player.segments[0].duration !== 3.0) throw new Error("Intro segment duration should be 3.0s");

// Seek to intro (1.0s)
player.seekTo(1.0);
if (player.getActiveSegment().type !== "intro") throw new Error("At 1.0s, active segment should be intro");
console.log("✓ At 1.0s, active segment is intro");

// Seek to Item 1 (5.0s)
player.seekTo(5.0);
const segAt5 = player.getActiveSegment();
if (segAt5.type !== "item" || segAt5.itemIndex !== 0) throw new Error(`At 5.0s, active segment should be item 0, got ${JSON.stringify(segAt5)}`);
console.log(`✓ At 5.0s, active segment is Item #${segAt5.rank} (${segAt5.title})`);

console.log("=== 3. Testing Shuffle Ranking ===");
const ranksBefore = window.getItemsData().map(i => i.title);
console.log("Titles before:", ranksBefore);
window.shuffleItems();
const itemsAfter = window.getItemsData();
console.log("Ranks after shuffle:", itemsAfter.map(i => `#${i.rank} ${i.title}`));
// Check descending ranks
if (itemsAfter[0].rank !== 2 || itemsAfter[1].rank !== 1) {
  throw new Error("Ranks should be recalculated descending after shuffle!");
}
console.log("✓ Shuffle items and rank recalculation verified!");

console.log("=== 4. Testing Form Config Serialization with clip_fit & font ===");
const cfg = window.getFormConfig();
console.log("Form config clip_fit:", cfg.clip_fit, "font:", cfg.font);
if (cfg.clip_fit !== "fill") throw new Error(`Expected clip_fit 'fill', got '${cfg.clip_fit}'`);
if (cfg.font !== "Impact") throw new Error(`Expected font 'Impact', got '${cfg.font}'`);
console.log("✓ Form config serialization with new fields verified!");

console.log("\n=======================================================");
console.log("SUCCESS: All Single-Page Studio & Timeline tests passed!");
console.log("=======================================================");
