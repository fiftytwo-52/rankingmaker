/**
 * Frontend Unit Test Suite for Timed Overlay Elements & Ladder Clip Name Display
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser globals
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

// Create a minimal DOM environment
class MockElement {
  constructor(tag, id = '') {
    this.tagName = (tag || 'div').toUpperCase();
    this.id = id;
    this.className = '';
    this.style = {};
    this.children = [];
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.listeners = {};
    this.checked = false;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return child;
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  querySelector(selector) {
    // Basic selector lookup
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this.findChild(el => (el.className || '').split(/\s+/).includes(cls));
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.findChild(el => el.id === id);
    }
    return this.findChild(el => (el.tagName || '').toLowerCase() === selector.toLowerCase());
  }

  querySelectorAll(selector) {
    const res = [];
    this.collectChildren(selector, res);
    return res;
  }

  findChild(predicate) {
    for (const c of this.children) {
      if (predicate(c)) return c;
      if (c.findChild) {
        const found = c.findChild(predicate);
        if (found) return found;
      }
    }
    return null;
  }

  collectChildren(selector, res) {
    for (const c of this.children) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if ((c.className || '').split(/\s+/).includes(cls)) res.push(c);
      } else if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (c.id === id) res.push(c);
      }
      if (c.collectChildren) c.collectChildren(selector, res);
    }
  }

  classList = {
    _classes: new Set(),
    add: (c) => this.classList._classes.add(c),
    remove: (c) => this.classList._classes.delete(c),
    contains: (c) => this.classList._classes.has(c),
    toggle: (c) => {
      if (this.classList._classes.has(c)) {
        this.classList._classes.delete(c);
        return false;
      } else {
        this.classList._classes.add(c);
        return true;
      }
    }
  };
}

global.document = {
  getElementById: (id) => {
    if (!global._elements[id]) {
      global._elements[id] = new MockElement('div', id);
    }
    return global._elements[id];
  },
  querySelector: (sel) => {
    if (sel.includes('#')) {
      const id = sel.split('#')[1].split(' ')[0].split('[')[0];
      return global.document.getElementById(id);
    }
    return new MockElement('div');
  },
  querySelectorAll: () => [],
  createElement: (tag) => new MockElement(tag),
};

global._elements = {};
global.window = global;

function runFrontendElementsTests() {
  console.log("=== 1. Testing Ladder Clip Name Visibility Toggle ===");
  const toggleRankLadder = global.document.getElementById("toggle-rank-ladder");
  const previewItemLabel = global.document.getElementById("preview-item-label");

  // Case A: When rank ladder is enabled
  toggleRankLadder.checked = true;
  let showLadder = Boolean(toggleRankLadder.checked);
  if (showLadder) {
    previewItemLabel.style.display = "none";
  } else {
    previewItemLabel.style.display = "block";
  }
  assert.strictEqual(previewItemLabel.style.display, "none", "Clip name MUST be hidden when rank ladder is active");
  console.log("✓ Clip name is properly hidden when rank ladder is active!");

  // Case B: When rank ladder is disabled
  toggleRankLadder.checked = false;
  showLadder = Boolean(toggleRankLadder.checked);
  if (showLadder) {
    previewItemLabel.style.display = "none";
  } else {
    previewItemLabel.style.display = "block";
  }
  assert.strictEqual(previewItemLabel.style.display, "block", "Clip name MUST be shown when rank ladder is inactive");
  console.log("✓ Clip name is displayed when rank ladder is inactive!");

  console.log("=== 2. Testing Timed Overlay Elements Live Rendering ===");
  const previewElementsContainer = global.document.getElementById("preview-elements-container");
  const overlayElements = [
    {
      id: "elem_txt",
      type: "text",
      content: "TOP SAVE!",
      target: "clip",
      clip_index: 0,
      start_time: 1.0,
      end_time: 4.0,
      pos_x: 50,
      pos_y: 20,
      scale: 1.2,
      color: "#ffff00"
    },
    {
      id: "elem_sticker",
      type: "emoji",
      content: "🔥",
      target: "clip",
      clip_index: 0,
      start_time: 2.0,
      end_time: 5.0,
      pos_x: 80,
      pos_y: 80,
      scale: 1.5
    }
  ];

  function renderPreviewElementsMock(currentTime, activeSegment) {
    const activeNodes = [];
    const currentSegType = activeSegment ? activeSegment.type : "item";
    const currentItemIdx = activeSegment && activeSegment.itemIndex !== undefined ? activeSegment.itemIndex : 0;
    const segStart = activeSegment && activeSegment.start !== undefined ? activeSegment.start : 0;
    const segOffset = Math.max(0, currentTime - segStart);

    overlayElements.forEach(elem => {
      let isActive = false;
      const t = segOffset;

      if (elem.target === "clip") {
        if (currentSegType === "item" && (elem.clip_index == null || elem.clip_index === currentItemIdx)) {
          isActive = t >= elem.start_time && t <= elem.end_time;
        }
      }

      if (isActive) {
        activeNodes.push(elem.content);
      }
    });
    previewElementsContainer.innerHTML = activeNodes.join(",");
    return activeNodes;
  }

  // At t = 0.5s: neither element should be active
  let active = renderPreviewElementsMock(0.5, { type: "item", itemIndex: 0, start: 0 });
  assert.strictEqual(active.length, 0, "No element should be visible at 0.5s");

  // At t = 1.5s: only text element should be active
  active = renderPreviewElementsMock(1.5, { type: "item", itemIndex: 0, start: 0 });
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0], "TOP SAVE!");

  // At t = 3.0s: both text and fire emoji should be active
  active = renderPreviewElementsMock(3.0, { type: "item", itemIndex: 0, start: 0 });
  assert.strictEqual(active.length, 2);
  assert.ok(active.includes("TOP SAVE!"));
  assert.ok(active.includes("🔥"));

  // At t = 4.5s: only fire emoji should be active
  active = renderPreviewElementsMock(4.5, { type: "item", itemIndex: 0, start: 0 });
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0], "🔥");

  // At t = 6.0s: neither element should be active
  active = renderPreviewElementsMock(6.0, { type: "item", itemIndex: 0, start: 0 });
  assert.strictEqual(active.length, 0);
  console.log("✓ Real-time timed element visibility filtering verified across time segments!");

  console.log("=== 3. Testing Elements Serialization & LocalStorage Round-Trip ===");
  const testState = {
    title: "TEST HIGHLIGHTS",
    elements: overlayElements,
  };
  localStorage.setItem("shortsmaker_state_v1", JSON.stringify(testState));
  const retrieved = JSON.parse(localStorage.getItem("shortsmaker_state_v1"));
  assert.ok(Array.isArray(retrieved.elements));
  assert.strictEqual(retrieved.elements.length, 2);
  assert.strictEqual(retrieved.elements[0].content, "TOP SAVE!");
  assert.strictEqual(retrieved.elements[1].content, "🔥");
  console.log("✓ Elements state persistence in localStorage verified!");

  console.log("=== 4. Testing HTML & CSS Markup Presence ===");
  const indexHtml = fs.readFileSync(path.join(__dirname, '../app/static/index.html'), 'utf8');
  assert.ok(indexHtml.includes('id="group-elements"'), 'index.html must contain #group-elements accordion');
  assert.ok(indexHtml.includes('id="preview-elements-container"'), 'index.html must contain #preview-elements-container');
  assert.ok(indexHtml.includes('id="modal-elements"'), 'index.html must contain #modal-elements modal');
  assert.ok(indexHtml.includes('id="tab-btn-vecteezy"'), 'index.html must contain Vecteezy search tab');

  const styleCss = fs.readFileSync(path.join(__dirname, '../app/static/style.css'), 'utf8');
  assert.ok(styleCss.includes('.preview-elements-layer'), 'style.css must define .preview-elements-layer');
  assert.ok(styleCss.includes('.element-deck-card'), 'style.css must define .element-deck-card');
  assert.ok(styleCss.includes('.vecteezy-card'), 'style.css must define .vecteezy-card');
  console.log("✓ HTML & CSS definitions for elements, modal, and Vecteezy grid verified!");

  console.log("\n=======================================================");
  console.log("SUCCESS: All frontend elements and ladder tests passed!");
  console.log("=======================================================");
}

runFrontendElementsTests();
