// Ranking Video Studio - Core Frontend Engine & Timeline Player

const itemsContainer = document.getElementById("items-container");
const btnAddItem = document.getElementById("btn-add-item");
const btnShuffleItems = document.getElementById("btn-shuffle-items");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function colorNameToHex(c) {
  const NAMED = {
    white: "#ffffff", black: "#000000", red: "#ff0000",
    green: "#008000", lime: "#00ff00", blue: "#0000ff",
    yellow: "#ffff00", cyan: "#00ffff", magenta: "#ff00ff",
    gold: "#ffd700", orange: "#ffa500", pink: "#ffc0cb",
    purple: "#800080", silver: "#c0c0c0", gray: "#808080"
  };
  const str = String(c || "#ffff00").trim().toLowerCase();
  if (NAMED[str]) return NAMED[str];
  let hex = str.replace(/^#/, "");
  if (hex.startsWith("0x") || hex.startsWith("0X")) hex = hex.slice(2);
  if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
  if (hex.length === 6) return "#" + hex;
  return "#ffff00";
}

// Internal cache for pre-downloaded remote sources
const downloadedSources = new Map();
const downloadingSet = new Set();
const downloadFailedSet = new Set();
const downloadErrors = new Map();
let overlayElements = [];

function updateItemRowStatus(row, srcVal) {
  if (!row) return;
  const statusEl = row.querySelector(".item-status-pill");
  if (!statusEl) return;
  const s = String(srcVal !== undefined ? srcVal : (row.querySelector(".item-source")?.value || "")).trim();

  if (!s) {
    statusEl.className = "item-status-pill status-empty";
    statusEl.textContent = "No Media";
    statusEl.title = "No video source provided";
    statusEl.style.cursor = "default";
    statusEl.onclick = null;
    return;
  }

  if (s.startsWith("http://") || s.startsWith("https://")) {
    if (downloadedSources.has(s)) {
      statusEl.className = "item-status-pill status-ready";
      statusEl.textContent = "Ready";
      statusEl.title = "Source video downloaded and ready";
      statusEl.style.cursor = "default";
      statusEl.onclick = null;
    } else if (downloadingSet.has(s)) {
      statusEl.className = "item-status-pill status-downloading";
      statusEl.textContent = "Downloading...";
      statusEl.title = "Downloading video from source URL...";
      statusEl.style.cursor = "default";
      statusEl.onclick = null;
    } else if (downloadFailedSet.has(s)) {
      statusEl.className = "item-status-pill status-error";
      statusEl.textContent = "Failed (Retry)";
      const reason = downloadErrors.get(s) || "Download failed.";
      statusEl.title = `${reason} Click to retry download.`;
      statusEl.style.cursor = "pointer";
      statusEl.onclick = (e) => {
        e.stopPropagation();
        preDownloadSource(s, true);
      };
    } else {
      statusEl.className = "item-status-pill status-pending";
      statusEl.textContent = "Pending";
      statusEl.title = "Click to download source now";
      statusEl.style.cursor = "pointer";
      statusEl.onclick = (e) => {
        e.stopPropagation();
        preDownloadSource(s, true);
      };
    }
  } else {
    // Local upload or file
    statusEl.className = "item-status-pill status-ready";
    statusEl.textContent = "Ready";
    statusEl.title = "Local media ready";
    statusEl.style.cursor = "default";
    statusEl.onclick = null;
  }
}

function updateAllItemStatuses() {
  if (!itemsContainer) return;
  const rows = itemsContainer.querySelectorAll(".item-row");
  rows.forEach(row => {
    const srcInput = row.querySelector(".item-source");
    if (srcInput) {
      updateItemRowStatus(row, srcInput.value);
      updateRowThumb(row, srcInput.value);
    }
  });
}

async function preDownloadSource(url, force = false) {
  if (!url || typeof url !== "string") return;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return;

  if (force) {
    downloadFailedSet.delete(trimmed);
    downloadErrors.delete(trimmed);
  }

  if (downloadedSources.has(trimmed) || downloadingSet.has(trimmed) || downloadFailedSet.has(trimmed)) return;

  downloadingSet.add(trimmed);
  downloadFailedSet.delete(trimmed);
  downloadErrors.delete(trimmed);
  updateAllItemStatuses();
  try {
    const res = await fetch("/api/download-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) {
        downloadedSources.set(trimmed, data.url);
        downloadFailedSet.delete(trimmed);
        downloadErrors.delete(trimmed);
      }
    } else {
      let errText = `Download failed (HTTP ${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) errText = errJson.detail;
      } catch (_) {}
      downloadFailedSet.add(trimmed);
      downloadErrors.set(trimmed, errText);
    }
  } catch (err) {
    console.warn("Failed to pre-download video:", err);
    downloadFailedSet.add(trimmed);
    downloadErrors.set(trimmed, err.message || "Network error");
  } finally {
    downloadingSet.delete(trimmed);
    updateAllItemStatuses();
    if (typeof updateLivePreview === "function") {
      updateLivePreview();
    }
  }
}

function updateRowThumb(row, srcVal) {
  if (!row) return;
  const thumbBox = row.querySelector(".item-thumb-box");
  if (!thumbBox) return;
  const thumbVid = thumbBox.querySelector(".item-thumb-video");
  const placeholder = thumbBox.querySelector(".thumb-placeholder");
  const s = String(srcVal || "").trim();

  if (!s) {
    if (thumbVid) {
      thumbVid.style.display = "none";
      thumbVid.src = "";
    }
    if (placeholder) placeholder.style.display = "flex";
    return;
  }

  let resolved = "";
  if (s.startsWith("http://") || s.startsWith("https://")) {
    if (downloadedSources.has(s)) {
      resolved = downloadedSources.get(s);
    } else if (!downloadingSet.has(s) && !downloadFailedSet.has(s)) {
      preDownloadSource(s);
    }
  } else if (s.startsWith("/uploads/") || s.startsWith("/downloads/")) {
    resolved = s;
  } else {
    resolved = `/uploads/${s}`;
  }

  if (resolved && thumbVid) {
    const cur = (typeof thumbVid.getAttribute === "function") ? thumbVid.getAttribute("data-src") : (thumbVid.dataset ? thumbVid.dataset.src : "");
    if (cur !== resolved) {
      thumbVid.src = resolved;
      if (typeof thumbVid.setAttribute === "function") thumbVid.setAttribute("data-src", resolved);
      else if (thumbVid.dataset) thumbVid.dataset.src = resolved;
      if (typeof thumbVid.load === "function") {
        try { thumbVid.load(); } catch (e) {}
      }
    }
    thumbVid.style.display = "block";
    if (placeholder) placeholder.style.display = "none";
  } else {
    if (thumbVid) thumbVid.style.display = "none";
    if (placeholder) placeholder.style.display = "flex";
  }
}

function createItemRow(rank = 1, title = "", source = "", start = 0, end = 8, volume = 1.0) {
  const row = document.createElement("div");
  row.className = "item-row";

  const volVal = (volume !== undefined && volume !== null && !isNaN(volume)) ? volume : 1.0;
  const volPercent = Math.round(volVal * 100);

  row.innerHTML = `
    <div class="item-header-row">
      <div class="rank-pill-label">
        <span>#</span>
        <input type="number" class="item-rank" value="${rank}" title="Countdown Rank">
      </div>
      <span class="item-status-pill status-empty">No Media</span>
      <input type="text" class="item-title" placeholder="Item Title (e.g. Winner Announcement)" value="${escapeHtml(title)}" style="flex: 1;">
      <button type="button" class="btn-duplicate-item btn-ghost-sm" title="Duplicate item" style="padding: 2px 6px; margin-right: 4px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <span>Duplicate</span>
      </button>
      <button type="button" class="btn-remove-item btn-ghost-sm btn-danger-sm" title="Remove item">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Remove</span>
      </button>
    </div>
    <div class="item-details-row" style="align-items: center; gap: 8px;">
      <div class="item-thumb-box" title="Clip Video Thumbnail">
        <video class="item-thumb-video" muted playsinline preload="metadata" style="display: none;"></video>
        <div class="thumb-placeholder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div style="flex: 2; min-width: 140px; display: flex; gap: 4px;">
        <input type="text" class="item-source" placeholder="Video URL or Upload ID" value="${escapeHtml(source)}" style="flex: 1;">
        <input type="file" class="item-file-input" style="display: none;" accept="video/*">
        <button type="button" class="btn-upload-clip btn-ghost-sm" title="Upload video file">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Upload</span>
        </button>
      </div>
      <div class="time-range-group">
        <label class="time-label">Start:
          <input type="number" class="item-start" value="${start}" step="0.5">s
        </label>
        <label class="time-label">End:
          <input type="number" class="item-end" value="${end}" step="0.5">s
        </label>
      </div>
      <div class="item-volume-group" title="Clip Audio Volume">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        <input type="range" class="item-volume item-volume-slider" min="0" max="2" step="0.1" value="${volVal}">
        <span class="item-vol-val">${volPercent}%</span>
      </div>
    </div>
  `;

  // Focus tracking: immediately focus this item in preview screen
  const selectThisItemInPreview = () => {
    if (!itemsContainer) return;
    const allRows = Array.from(itemsContainer.querySelectorAll(".item-row"));
    const myIdx = allRows.indexOf(row);
    if (myIdx >= 0 && previewItemSelect) {
      previewItemSelect.value = myIdx;
      const modeRadio = document.querySelector('input[name="preview-mode"]:checked');
      if (modeRadio && modeRadio.value === "item") {
        updateLivePreview();
      } else if (timelinePlayer && !timelinePlayer.isPlaying) {
        const segs = timelinePlayer.segments || [];
        const seg = segs.find(s => s.type === "item" && s.itemIndex === myIdx);
        if (seg) {
          timelinePlayer.seekTo(seg.start + 0.05);
        }
      }
    }
  };

  row.addEventListener("click", selectThisItemInPreview);
  row.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("focus", selectThisItemInPreview);
  });

  // Wire duplicate button
  const btnDuplicate = row.querySelector(".btn-duplicate-item");
  if (btnDuplicate) {
    btnDuplicate.addEventListener("click", (e) => {
      e.stopPropagation();
      const s = row.querySelector(".item-source")?.value || "";
      const t = row.querySelector(".item-title")?.value || "";
      const st = parseFloat(row.querySelector(".item-start")?.value) || 0;
      const en = parseFloat(row.querySelector(".item-end")?.value) || 8;
      const vol = parseFloat(row.querySelector(".item-volume")?.value);
      const v = isNaN(vol) ? 1.0 : vol;
      
      const newRow = createItemRow(1, t, s, st, en, v);
      row.insertAdjacentElement("afterend", newRow);
      recalcRanks();
      updateItemRowStatus(newRow, s);
      updateRowThumb(newRow, s);
      timelinePlayer?.buildSegments();
      updateLivePreview();
      saveFormState();
    });
  }

  // Wire remove button
  const btnRemove = row.querySelector(".btn-remove-item");
  if (btnRemove) {
    btnRemove.addEventListener("click", () => {
      row.remove();
      recalcRanks();
      timelinePlayer?.buildSegments();
      updateLivePreview();
      saveFormState();
    });
  }

  // Wire title live input
  const titleInput = row.querySelector(".item-title");
  if (titleInput) {
    titleInput.addEventListener("input", () => {
      selectThisItemInPreview();
      updateLivePreview();
      saveFormState();
    });
  }

  // Wire time range live inputs
  const startInput = row.querySelector(".item-start");
  const endInput = row.querySelector(".item-end");
  if (startInput) {
    startInput.addEventListener("input", () => {
      selectThisItemInPreview();
      timelinePlayer?.buildSegments();
      updateLivePreview();
      saveFormState();
    });
  }
  if (endInput) {
    endInput.addEventListener("input", () => {
      selectThisItemInPreview();
      timelinePlayer?.buildSegments();
      updateLivePreview();
      saveFormState();
    });
  }

  // Wire clip volume slider with live audio feedback
  const volSlider = row.querySelector(".item-volume");
  const volValBadge = row.querySelector(".item-vol-val");
  if (volSlider && volValBadge) {
    volSlider.addEventListener("input", () => {
      volValBadge.textContent = `${Math.round(parseFloat(volSlider.value) * 100)}%`;
      selectThisItemInPreview();
      if (timelinePlayer && timelinePlayer.isPlaying) {
        const activeVid = document.getElementById("preview-active-video");
        const globalClipVol = parseFloat(document.getElementById("clip-volume")?.value || 1.0);
        if (activeVid && !activeVid.muted) {
          activeVid.volume = Math.max(0, Math.min(1.0, globalClipVol * parseFloat(volSlider.value)));
        }
      }
      updateLivePreview();
      saveFormState();
    });
  }

  // Wire clip upload & source blur
  const fileInput = row.querySelector(".item-file-input");
  const uploadBtn = row.querySelector(".btn-upload-clip");
  const sourceInput = row.querySelector(".item-source");

  if (sourceInput) {
    let dlInputTimeout = null;
    sourceInput.addEventListener("input", () => {
      const val = (sourceInput.value || "").trim();
      updateRowThumb(row, sourceInput.value);
      updateItemRowStatus(row, sourceInput.value);
      selectThisItemInPreview();
      updateLivePreview();
      if ((val.startsWith("http://") || val.startsWith("https://")) && val.length > 10) {
        clearTimeout(dlInputTimeout);
        dlInputTimeout = setTimeout(() => {
          preDownloadSource(val);
        }, 800);
      }
    });
    sourceInput.addEventListener("change", () => {
      const val = (sourceInput.value || "").trim();
      clearTimeout(dlInputTimeout);
      updateRowThumb(row, val);
      updateItemRowStatus(row, val);
      if (val.startsWith("http://") || val.startsWith("https://")) {
        preDownloadSource(val, true);
      }
    });
    sourceInput.addEventListener("blur", () => {
      const val = (sourceInput.value || "").trim();
      clearTimeout(dlInputTimeout);
      updateRowThumb(row, val);
      updateItemRowStatus(row, val);
      if (val.startsWith("http://") || val.startsWith("https://")) {
        preDownloadSource(val, true);
      }
    });
    if (source) {
      updateRowThumb(row, source);
      updateItemRowStatus(row, source);
      if (source.startsWith("http://") || source.startsWith("https://")) {
        preDownloadSource(source);
      }
    }
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append("file", file);
      uploadBtn.textContent = "Uploading...";
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        if (sourceInput) {
          sourceInput.value = data.id;
          updateRowThumb(row, data.id);
          updateItemRowStatus(row, data.id);
        }
        uploadBtn.textContent = "Uploaded!";
        saveFormState();
        timelinePlayer?.buildSegments();
        updateLivePreview();
        setTimeout(() => { uploadBtn.textContent = "Upload"; }, 2000);
      } catch (e) {
        alert("Error uploading clip: " + e.message);
        uploadBtn.textContent = "Upload";
      }
    });
  }

  return row;
}

function recalcRanks() {
  if (!itemsContainer) return;
  const rows = Array.from(itemsContainer.querySelectorAll(".item-row"));
  const total = rows.length;
  if (total === 0) return;

  const isRandom = document.getElementById("toggle-random-ranks")?.checked;
  if (isRandom && total > 1) {
    const ranks = [];
    for (let i = 2; i <= total; i++) ranks.push(i);
    for (let i = ranks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
    }
    for (let i = 0; i < total - 1; i++) {
      const rankInput = rows[i].querySelector(".item-rank");
      if (rankInput) rankInput.value = ranks[i];
    }
    const lastInput = rows[total - 1].querySelector(".item-rank");
    if (lastInput) lastInput.value = 1;
  } else {
    rows.forEach((row, index) => {
      const rankInput = row.querySelector(".item-rank");
      if (rankInput) {
        rankInput.value = total - index; // descending N, N-1, ... 1
      }
    });
  }
  
  timelinePlayer?.buildSegments();
  if (typeof updateLivePreview === "function") updateLivePreview();
}

function addItem(titleOrObj = "", source = "", start = 0, end = 8, volume = 1.0) {
  if (!itemsContainer) return;
  let title = titleOrObj;
  let s = source;
  let st = start;
  let en = end;
  let vol = volume;
  let rankVal = 1;

  if (typeof titleOrObj === "object" && titleOrObj !== null) {
    title = titleOrObj.title || "";
    s = titleOrObj.source || titleOrObj.url || "";
    st = titleOrObj.start !== undefined ? titleOrObj.start : 0;
    en = titleOrObj.end !== undefined ? titleOrObj.end : 8;
    vol = titleOrObj.volume !== undefined ? titleOrObj.volume : 1.0;
    if (titleOrObj.rank !== undefined) rankVal = titleOrObj.rank;
  }

  const row = createItemRow(rankVal, title, s, st, en, vol);
  itemsContainer.appendChild(row);
  recalcRanks();
  updateItemRowStatus(row, s);
  updateRowThumb(row, s);
}

function shuffleItems() {
  if (!itemsContainer) return;
  const rows = Array.from(itemsContainer.querySelectorAll(".item-row"));
  if (rows.length <= 1) return;

  // Fisher-Yates shuffle
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  itemsContainer.innerHTML = "";
  rows.forEach(r => itemsContainer.appendChild(r));
  recalcRanks();
  timelinePlayer?.buildSegments();
  saveFormState();
}

if (btnShuffleItems) {
  btnShuffleItems.addEventListener("click", shuffleItems);
}

// Randomize Placements: keep countdown ranks in order and randomly assign clips into ranks
const btnRandomizePlacements = document.getElementById("btn-randomize-placements");

function randomizeItemPlacements() {
  if (!itemsContainer) return;
  const rows = Array.from(itemsContainer.querySelectorAll(".item-row"));
  if (rows.length <= 1) return;

  const payloads = rows.map(r => ({
    title: r.querySelector(".item-title")?.value || "",
    source: r.querySelector(".item-source")?.value || "",
    start: r.querySelector(".item-start")?.value || "0",
    end: r.querySelector(".item-end")?.value || "8",
    volume: r.querySelector(".item-volume")?.value || "1.0",
  }));

  for (let i = payloads.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [payloads[i], payloads[j]] = [payloads[j], payloads[i]];
  }

  rows.forEach((r, idx) => {
    const p = payloads[idx];
    const tInp = r.querySelector(".item-title");
    const sInp = r.querySelector(".item-source");
    const stInp = r.querySelector(".item-start");
    const enInp = r.querySelector(".item-end");
    const vInp = r.querySelector(".item-volume");
    const vBadge = r.querySelector(".item-vol-val");

    if (tInp) tInp.value = p.title;
    if (sInp) {
      sInp.value = p.source;
      updateRowThumb(r, p.source);
      updateItemRowStatus(r, p.source);
    }
    if (stInp) stInp.value = p.start;
    if (enInp) enInp.value = p.end;
    if (vInp) {
      vInp.value = p.volume;
      if (vBadge) vBadge.textContent = `${Math.round(parseFloat(p.volume) * 100)}%`;
    }
  });

  timelinePlayer?.buildSegments();
  updateLivePreview();
  saveFormState();
}

if (btnRandomizePlacements) {
  btnRandomizePlacements.addEventListener("click", randomizeItemPlacements);
}

// Randomize Finale: scrambles items across ranks, keeping Rank 1 as the final reveal clip
const btnRandomizeFinale = document.getElementById("btn-randomize-finale");

function randomizeWithFinale() {
  if (!itemsContainer) return;
  const rows = Array.from(itemsContainer.querySelectorAll(".item-row"));
  if (rows.length <= 1) return;

  const data = getItemsData();
  const N = data.length;

  const shuffled = [...data];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const otherRanks = [];
  for (let r = 2; r <= N; r++) otherRanks.push(r);
  for (let i = otherRanks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherRanks[i], otherRanks[j]] = [otherRanks[j], otherRanks[i]];
  }
  const targetRanks = [...otherRanks, 1];

  itemsContainer.innerHTML = "";
  shuffled.forEach((item, idx) => {
    item.rank = targetRanks[idx];
    addItem(item);
  });

  saveFormState();
  timelinePlayer?.buildSegments();
  updateLivePreview();
}

if (btnRandomizeFinale) {
  btnRandomizeFinale.addEventListener("click", randomizeWithFinale);
}

// Bulk Add Rankings Modal & Parser
const btnBulkAdd = document.getElementById("btn-bulk-add");
const bulkAddModal = document.getElementById("bulk-add-modal");
const btnCloseBulkModal = document.getElementById("btn-close-bulk-modal");
const bulkItemsInput = document.getElementById("bulk-items-input");
const bulkClearExisting = document.getElementById("bulk-clear-existing");
const bulkRandomizeOrder = document.getElementById("bulk-randomize-order");
const bulkRandomizeFinale = document.getElementById("bulk-randomize-finale");
const btnProcessBulkAdd = document.getElementById("btn-process-bulk-add");

function parseBulkRankings(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const items = [];
  lines.forEach(line => {
    // Strip leading numbers or bullets like "1. ", "1) ", "1 - ", "#1 ", "# 1:", "- ", "* "
    const cleaned = line.replace(/^\s*(?:#?\s*\d+\s*(?:[\.\)\-:]|\s-|\s:)?|\-|\*)\s*/, "").trim();
    if (cleaned) {
      items.push(cleaned);
    }
  });
  return items;
}

function processBulkAdd() {
  if (!bulkItemsInput) return;
  const parsed = parseBulkRankings(bulkItemsInput.value);
  if (parsed.length === 0) {
    alert("Please paste at least one item ranking (e.g.\n1. Best Play\n2. Epic Moment).");
    return;
  }

  const shouldClear = bulkClearExisting ? bulkClearExisting.checked : true;
  if (shouldClear && itemsContainer) {
    itemsContainer.innerHTML = "";
  }

  let itemsToAdd = [...parsed];
  const N = itemsToAdd.length;

  if (bulkRandomizeFinale && bulkRandomizeFinale.checked && N > 1) {
    for (let i = itemsToAdd.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [itemsToAdd[i], itemsToAdd[j]] = [itemsToAdd[j], itemsToAdd[i]];
    }
    const otherRanks = [];
    for (let r = 2; r <= N; r++) otherRanks.push(r);
    for (let i = otherRanks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherRanks[i], otherRanks[j]] = [otherRanks[j], otherRanks[i]];
    }
    const targetRanks = [...otherRanks, 1];
    itemsToAdd.forEach((title, idx) => {
      addItem({ rank: targetRanks[idx], title, source: "", start: 0, end: 8, volume: 1.0 });
    });
  } else if (bulkRandomizeOrder && bulkRandomizeOrder.checked) {
    for (let i = itemsToAdd.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [itemsToAdd[i], itemsToAdd[j]] = [itemsToAdd[j], itemsToAdd[i]];
    }
    itemsToAdd.forEach(title => {
      addItem(title, "", 0, 8, 1.0);
    });
    recalcRanks();
  } else {
    itemsToAdd.forEach(title => {
      addItem(title, "", 0, 8, 1.0);
    });
    recalcRanks();
  }

  timelinePlayer?.buildSegments();
  updateLivePreview();
  saveFormState();

  if (bulkAddModal) bulkAddModal.style.display = "none";
  bulkItemsInput.value = "";
}

if (btnBulkAdd && bulkAddModal) {
  btnBulkAdd.addEventListener("click", () => {
    bulkAddModal.style.display = "flex";
    if (bulkItemsInput) {
      bulkItemsInput.focus();
    }
  });
}

if (btnCloseBulkModal && bulkAddModal) {
  btnCloseBulkModal.addEventListener("click", () => {
    bulkAddModal.style.display = "none";
  });
}

if (bulkAddModal) {
  bulkAddModal.addEventListener("click", (e) => {
    if (e.target === bulkAddModal) {
      bulkAddModal.style.display = "none";
    }
  });
}

if (btnProcessBulkAdd) {
  btnProcessBulkAdd.addEventListener("click", processBulkAdd);
}


function getItemsData() {
  if (!itemsContainer) return [];
  const rows = itemsContainer.querySelectorAll(".item-row");
  const items = [];
  rows.forEach(row => {
    const rank = parseInt(row.querySelector(".item-rank")?.value, 10) || 0;
    const title = String(row.querySelector(".item-title")?.value || "").trim();
    const source = String(row.querySelector(".item-source")?.value || "").trim();
    const start = parseFloat(row.querySelector(".item-start")?.value) || 0;
    const endVal = String(row.querySelector(".item-end")?.value || "").trim();
    const end = endVal !== "" ? parseFloat(endVal) : null;
    const volInput = row.querySelector(".item-volume");
    const volume = volInput ? parseFloat(volInput.value) : 1.0;
    items.push({ rank, title, source, start, end, volume });
  });
  return items;
}

// Background image upload
const bgImageFile = document.getElementById("bg-image-file");
const btnUploadBgImage = document.getElementById("btn-upload-bg-image");
const bgImageFilename = document.getElementById("bg-image-filename");
const bgImageId = document.getElementById("bg-image-id");

if (btnUploadBgImage && bgImageFile) {
  btnUploadBgImage.addEventListener("click", () => bgImageFile.click());
  bgImageFile.addEventListener("change", async () => {
    if (!bgImageFile.files.length) return;
    const file = bgImageFile.files[0];
    const formData = new FormData();
    formData.append("file", file);
    btnUploadBgImage.textContent = "Uploading...";
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (bgImageId) bgImageId.value = data.id;
      if (bgImageFilename) bgImageFilename.textContent = data.filename;
      btnUploadBgImage.textContent = "Change Image";
      if (typeof updateLivePreview === "function") updateLivePreview();
      saveFormState();
    } catch (e) {
      alert("Failed to upload background image: " + e.message);
      btnUploadBgImage.textContent = "Upload Image";
    }
  });
}

// Background music upload
const bgmFile = document.getElementById("bgm-file");
const btnUploadBgm = document.getElementById("btn-upload-bgm");
const bgmFilename = document.getElementById("bgm-filename");
const bgmId = document.getElementById("bgm-id");

if (btnUploadBgm && bgmFile) {
  btnUploadBgm.addEventListener("click", () => bgmFile.click());
  bgmFile.addEventListener("change", async () => {
    if (!bgmFile.files.length) return;
    const file = bgmFile.files[0];
    const formData = new FormData();
    formData.append("file", file);
    btnUploadBgm.textContent = "Uploading...";
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (bgmId) bgmId.value = data.id;
      if (bgmFilename) bgmFilename.textContent = data.filename;
      btnUploadBgm.textContent = "Change Audio";
      saveFormState();
    } catch (e) {
      alert("Failed to upload music: " + e.message);
      btnUploadBgm.textContent = "Upload Audio";
    }
  });
}

function getFormConfig() {
  const [width, height] = (document.getElementById("resolution-preset")?.value || "1080x1920")
    .split("x")
    .map(n => parseInt(n, 10));

  const clipFitRadio = document.querySelector('input[name="clip-fit"]:checked');
  const clipFitVal = clipFitRadio ? clipFitRadio.value : "fit";
  const labelPosRadio = document.querySelector('input[name="item-label-pos"]:checked');
  const labelPosVal = labelPosRadio ? labelPosRadio.value : "bottom";
  const fontVal = document.getElementById("font-select")?.value || "Geist";
  const introSecInput = document.getElementById("intro-seconds");
  const introSec = introSecInput ? (parseFloat(introSecInput.value) || 3.0) : 3.0;
  const transitionsCheck = document.getElementById("transitions-toggle");
  const transitionsVal = transitionsCheck ? Boolean(transitionsCheck.checked) : true;

  const titleFontSize = parseInt(document.getElementById("title-font-size")?.value, 10) || 68;
  const itemFontSize = parseInt(document.getElementById("item-font-size")?.value, 10) || 52;
  const titleBgStyle = document.getElementById("title-bg-style")?.value || "none";
  const titleShadowToggle = document.getElementById("title-shadow-toggle");
  const titleShadow = titleShadowToggle ? Boolean(titleShadowToggle.checked) : true;
  const itemBgStyle = document.getElementById("item-bg-style")?.value || "dark";
  const itemShadowToggle = document.getElementById("item-shadow-toggle");
  const itemShadow = itemShadowToggle ? Boolean(itemShadowToggle.checked) : true;

  const toggleLadder = document.getElementById("toggle-rank-ladder");
  const showRankLadder = toggleLadder ? Boolean(toggleLadder.checked) : false;
  const ladderPos = document.getElementById("rank-ladder-pos")?.value || "left";
  const ladderBgStyle = document.getElementById("rank-ladder-bg-style")?.value || "dark";
  const ladderGap = parseInt(document.getElementById("rank-ladder-gap")?.value, 10) || 50;
  const ladderStartY = parseInt(document.getElementById("rank-ladder-start-y")?.value, 10) || 28;
  const ladderOrder = document.getElementById("rank-ladder-order")?.value || "desc";

  const colorPreset = document.getElementById("color-grading-preset")?.value || "none";
  const colorContrast = parseFloat(document.getElementById("color-contrast")?.value || "1.0") || 1.0;
  const colorSaturation = parseFloat(document.getElementById("color-saturation")?.value || "1.0") || 1.0;
  const colorBrightness = parseFloat(document.getElementById("color-brightness")?.value || "0.0") || 0.0;
  const colorWarmth = parseFloat(document.getElementById("color-warmth")?.value || "0.0") || 0.0;

  return {
    title: (document.getElementById("video-title")?.value || "TOP RANKING").trim(),
    title_words: getTitleWordsData(),
    width: width || 1920,
    height: height || 1080,
    clip_fit: clipFitVal,
    item_label_position: labelPosVal,
    title_font_size: titleFontSize,
    item_font_size: itemFontSize,
    title_bg_style: titleBgStyle,
    title_shadow: titleShadow,
    item_bg_style: itemBgStyle,
    item_shadow: itemShadow,
    show_rank_ladder: showRankLadder,
    randomize_ranks: document.getElementById("toggle-random-ranks") ? Boolean(document.getElementById("toggle-random-ranks").checked) : false,
    rank_ladder_position: ladderPos,
    rank_ladder_bg_style: ladderBgStyle,
    rank_ladder_gap: ladderGap,
    rank_ladder_start_y: ladderStartY,
    rank_ladder_order: ladderOrder,
    color_grading_preset: colorPreset,
    color_contrast: colorContrast,
    color_saturation: colorSaturation,
    color_brightness: colorBrightness,
    color_warmth: colorWarmth,
    accent: (document.getElementById("accent-color")?.value || "#ffff00").trim(),
    bg_color: (document.getElementById("bg-color")?.value || "#141414").trim(),
    bg_image: bgImageId && bgImageId.value ? bgImageId.value : null,
    bgm: bgmId && bgmId.value ? bgmId.value : null,
    bgm_volume: parseFloat(document.getElementById("bgm-volume")?.value || 0.25),
    clip_volume: parseFloat(document.getElementById("clip-volume")?.value || 1.0),
    intro_seconds: introSec,
    clip_seconds: 8.0,
    font: fontVal,
    transitions: transitionsVal,
    elements: overlayElements,
    items: getItemsData(),
  };
}

// Job execution & polling
let currentJobId = null;
let pollTimer = null;

const btnGenerate = document.getElementById("btn-generate");
const btnExportTop = document.getElementById("btn-export-top");
const btnCancelJob = document.getElementById("btn-cancel-job");
const jobStatusSection = document.getElementById("job-status-section");
const jobStatusBadge = document.getElementById("job-status-badge");
const jobProgressBar = document.getElementById("job-progress-bar");
const jobProgressText = document.getElementById("job-progress-text");
const jobErrorMsg = document.getElementById("job-error-msg");
const jobResultSection = document.getElementById("job-result-section");
const videoPreview = document.getElementById("video-preview");
const downloadLink = document.getElementById("download-link");

async function startJob() {
  const cfg = getFormConfig();
  if (!cfg.items || cfg.items.length === 0) {
    alert("Please add at least 1 countdown item to generate a video.");
    return;
  }

  for (let i = 0; i < cfg.items.length; i++) {
    const item = cfg.items[i];
    if (!item.title) {
      alert(`Item #${item.rank || i + 1} is missing a title.`);
      return;
    }
    if (!item.source) {
      alert(`Item #${item.rank || i + 1} is missing a source URL or uploaded clip.`);
      return;
    }
    if (item.end !== null && item.end <= item.start) {
      alert(`Item #${item.rank}: end time (${item.end}s) must be greater than start time (${item.start}s).`);
      return;
    }
  }

  if (btnGenerate) btnGenerate.disabled = true;
  if (btnExportTop) btnExportTop.disabled = true;
  if (jobStatusSection) jobStatusSection.style.display = "block";
  if (btnCancelJob) btnCancelJob.style.display = "inline-block";
  if (jobStatusBadge) {
    jobStatusBadge.textContent = "QUEUED";
    jobStatusBadge.style.color = "#007bff";
  }
  if (jobProgressBar) jobProgressBar.value = 0;
  if (jobProgressText) jobProgressText.textContent = "Submitting job...";
  if (jobErrorMsg) jobErrorMsg.style.display = "none";
  if (jobResultSection) jobResultSection.style.display = "none";
  if (videoPreview) {
    videoPreview.pause();
    videoPreview.removeAttribute("src");
  }

  try {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail ? JSON.stringify(err.detail) : "Failed to start job");
    }

    const data = await res.json();
    currentJobId = data.job_id;
    if (jobProgressText) jobProgressText.textContent = "Job started. Rendering segments...";

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => pollJob(currentJobId), 1000);
    pollJob(currentJobId);
  } catch (e) {
    if (btnGenerate) btnGenerate.disabled = false;
    if (btnExportTop) btnExportTop.disabled = false;
    if (jobStatusBadge) {
      jobStatusBadge.textContent = "FAILED";
      jobStatusBadge.style.color = "#dc3545";
    }
    if (jobErrorMsg) {
      jobErrorMsg.textContent = e.message;
      jobErrorMsg.style.display = "block";
    }
  }
}

async function pollJob(jobId) {
  try {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return;

    const data = await res.json();
    if (jobStatusBadge) jobStatusBadge.textContent = data.status.toUpperCase();
    if (jobProgressBar) jobProgressBar.value = data.progress || 0;
    if (jobProgressText) jobProgressText.textContent = `[${data.progress}%] ${data.message || ""}`;

    if (data.status === "running") {
      if (jobStatusBadge) jobStatusBadge.style.color = "#ffc107";
      if (btnCancelJob) btnCancelJob.style.display = "inline-block";
    } else if (data.status === "done") {
      clearInterval(pollTimer);
      if (btnGenerate) btnGenerate.disabled = false;
      if (btnExportTop) btnExportTop.disabled = false;
      if (btnCancelJob) btnCancelJob.style.display = "none";
      if (jobStatusBadge) jobStatusBadge.style.color = "#28a745";
      if (jobProgressText) jobProgressText.textContent = "Finished! Ready to preview & download.";

      const downloadUrl = `/api/jobs/${jobId}/download`;
      const streamUrl = `/api/jobs/${jobId}/video`;
      if (downloadLink) downloadLink.href = downloadUrl;
      if (videoPreview) {
        videoPreview.src = streamUrl;
        videoPreview.load();
      }
      if (jobResultSection) jobResultSection.style.display = "block";

      // Retain downloaded sources so user preview and item deck remain ready
    } else if (data.status === "failed") {
      clearInterval(pollTimer);
      if (btnGenerate) btnGenerate.disabled = false;
      if (btnExportTop) btnExportTop.disabled = false;
      if (btnCancelJob) btnCancelJob.style.display = "none";
      if (jobStatusBadge) jobStatusBadge.style.color = "#dc3545";
      if (jobErrorMsg) {
        jobErrorMsg.textContent = data.error || data.message || "Unknown error occurred";
        jobErrorMsg.style.display = "block";
      }
    } else if (data.status === "cancelled") {
      clearInterval(pollTimer);
      if (btnGenerate) btnGenerate.disabled = false;
      if (btnExportTop) btnExportTop.disabled = false;
      if (btnCancelJob) btnCancelJob.style.display = "none";
      if (jobStatusBadge) jobStatusBadge.style.color = "#6c757d";
      if (jobProgressText) jobProgressText.textContent = "Job was cancelled.";
    }
  } catch (e) {
    console.error("Polling error:", e);
  }
}

async function cancelCurrentJob() {
  if (!currentJobId) return;
  if (btnCancelJob) btnCancelJob.disabled = true;
  try {
    await fetch(`/api/jobs/${currentJobId}/cancel`, { method: "POST" });
  } finally {
    if (btnCancelJob) btnCancelJob.disabled = false;
  }
}

const btnCloseJobStatus = document.getElementById("btn-close-job-status");
if (btnCloseJobStatus) {
  btnCloseJobStatus.addEventListener("click", () => {
    if (jobStatusSection) jobStatusSection.style.display = "none";
  });
}

const btnDeleteJob = document.getElementById("btn-delete-job");
if (btnDeleteJob) {
  btnDeleteJob.addEventListener("click", async () => {
    if (!currentJobId) return;
    if (!confirm("Are you sure you want to delete this job and its output?")) return;
    try {
      await fetch(`/api/jobs/${currentJobId}`, { method: "DELETE" });
      if (jobStatusSection) jobStatusSection.style.display = "none";
      if (jobResultSection) jobResultSection.style.display = "none";
      if (videoPreview) {
        videoPreview.pause();
        videoPreview.removeAttribute("src");
      }
      currentJobId = null;
    } catch (e) {
      alert("Failed to delete job: " + e.message);
    }
  });
}

if (btnGenerate) btnGenerate.addEventListener("click", startJob);
if (btnExportTop) btnExportTop.addEventListener("click", startJob);
if (btnAddItem) btnAddItem.addEventListener("click", () => {
  const d = typeof getDeckDefaults === "function" ? getDeckDefaults() : { start: 0, end: 8, volume: 1.0 };
  addItem("", "", d.start, d.end, d.volume);
  timelinePlayer?.buildSegments();
  saveFormState();
});
if (btnCancelJob) btnCancelJob.addEventListener("click", cancelCurrentJob);

// Word-by-word title colors & Multiline Handling
const titleWordsContainer = document.getElementById("title-words-container");
const videoTitleInput = document.getElementById("video-title");
const accentColorInput = document.getElementById("accent-color");
const btnResetWordColors = document.getElementById("btn-reset-word-colors");

function getTitleWordsData() {
  if (!titleWordsContainer) return null;
  const chips = titleWordsContainer.querySelectorAll(".word-chip");
  if (!chips.length) return null;
  const words = [];
  chips.forEach(chip => {
    const word = chip.dataset.word || "";
    const color = chip.querySelector(".word-color-input")?.value || "#ffff00";
    if (word) {
      words.push({ word, color });
    }
  });
  return words.length > 0 ? words : null;
}

function renderWordColorChips(savedWords = null) {
  if (!titleWordsContainer || !videoTitleInput) return;
  const rawTitle = videoTitleInput.value || "";
  // Split title words while respecting word tokens
  const words = rawTitle.trim() ? rawTitle.trim().split(/\s+/).filter(Boolean) : [];

  const existingMap = new Map();
  if (Array.isArray(savedWords)) {
    savedWords.forEach(sw => {
      if (sw.word && sw.color) existingMap.set(sw.word, sw.color);
    });
  } else {
    titleWordsContainer.querySelectorAll(".word-chip").forEach(chip => {
      const w = chip.dataset.word;
      const c = chip.querySelector(".word-color-input")?.value;
      if (w && c) existingMap.set(w, c);
    });
  }

  const defaultHex = colorNameToHex(accentColorInput?.value || "#ffff00");
  titleWordsContainer.innerHTML = "";

  words.forEach(w => {
    const chip = document.createElement("div");
    chip.className = "word-chip";
    chip.dataset.word = w;

    const colorVal = existingMap.has(w) ? colorNameToHex(existingMap.get(w)) : defaultHex;

    chip.innerHTML = `
      <span>${escapeHtml(w)}</span>
      <input type="color" class="word-color-input" value="${colorVal}">
    `;

    const colorInput = chip.querySelector(".word-color-input");
    if (colorInput) {
      colorInput.addEventListener("input", () => {
        updateLivePreview();
        saveFormState();
      });
      colorInput.addEventListener("change", () => {
        updateLivePreview();
        saveFormState();
      });
    }

    titleWordsContainer.appendChild(chip);
  });

  updateLivePreview();
}

if (btnResetWordColors) {
  btnResetWordColors.addEventListener("click", () => {
    const defaultHex = colorNameToHex(accentColorInput?.value || "#ffff00");
    titleWordsContainer?.querySelectorAll(".word-color-input").forEach(inp => {
      inp.value = defaultHex;
    });
    updateLivePreview();
    saveFormState();
  });
}

// Live Preview Screen Elements
const previewScreen = document.getElementById("preview-screen");
const titleTextPreview = document.getElementById("preview-title");
const titleBgWidth = document.getElementById("title-bg-width");
const previewIntroContent = document.getElementById("preview-intro-content");
const previewItemContent = document.getElementById("preview-item-content");
const previewIntroTitle = document.getElementById("preview-intro-title");
const previewItemTopTitle = document.getElementById("preview-item-top-title");
const previewClipTitle = document.getElementById("preview-clip-title");
const previewClipSource = document.getElementById("preview-clip-source");
const previewClipFramingBadge = document.getElementById("preview-clip-framing-badge");
const previewItemClipBox = document.getElementById("preview-item-clip-box");
const previewItemLabel = document.getElementById("preview-item-label");
const previewItemSelectorWrapper = document.getElementById("preview-item-selector-wrapper");
const previewItemSelect = document.getElementById("preview-item-select");
const resolutionSelect = document.getElementById("resolution-preset");
const fontSelect = document.getElementById("font-select");
const bgColorInput = document.getElementById("bg-color");

let currentPreviewSegmentKey = null;
function triggerPreviewAnimations(segmentKey) {
  if (currentPreviewSegmentKey === segmentKey) return;
  currentPreviewSegmentKey = segmentKey;

  const animateEl = (el, animClass) => {
    if (!el || !el.classList) return;
    if (typeof el.classList.remove === "function") {
      el.classList.remove(animClass);
      if (typeof el.offsetWidth === "number") {
        void el.offsetWidth;
      }
      el.classList.add(animClass);
    }
  };

  if (segmentKey === "intro") {
    animateEl(previewIntroTitle, "animate-pop");
  } else {
    animateEl(previewItemTopTitle, "animate-pop");
    animateEl(previewItemLabel, "animate-slide");
    animateEl(previewItemClipBox, "animate-clip");
  }
}

function buildTitleHtml(defaultColor) {
  const wordsData = getTitleWordsData();
  const rawTitle = (videoTitleInput?.value || "TOP RANKING").trim();

  if (wordsData && wordsData.length > 0) {
    // If multiline title is entered in textarea, map words across lines
    const lines = rawTitle.split(/\r?\n/);
    let wordIdx = 0;
    const lineHtmls = [];

    lines.forEach(line => {
      const lineWords = line.trim().split(/\s+/).filter(Boolean);
      const spanParts = [];
      lineWords.forEach(() => {
        if (wordIdx < wordsData.length) {
          const w = wordsData[wordIdx++];
          spanParts.push(`<span style="color: ${w.color};">${escapeHtml(w.word)}</span>`);
        }
      });
      lineHtmls.push(spanParts.join(" "));
    });

    return lineHtmls.join("<br>");
  } else {
    // Escape lines and join with <br>
    return rawTitle
      .split(/\r?\n/)
      .map(line => `<span style="color: ${defaultColor};">${escapeHtml(line)}</span>`)
      .join("<br>");
  }
}

function fitPreviewToStage() {
  if (!previewScreen) return;
  const res = resolutionSelect?.value || "1080x1920";
  const isPortrait = res === "1080x1920";
  const targetRatio = isPortrait ? (9 / 16) : (16 / 9);

  previewScreen.style.aspectRatio = isPortrait ? "9 / 16" : "16 / 9";
  previewScreen.style.maxWidth = "100%";
  previewScreen.style.maxHeight = "100%";

  const stage = document.getElementById("preview-frame-container") || previewScreen.parentElement;
  if (!stage || typeof stage.getBoundingClientRect !== "function") return;
  const rect = stage.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return;

  const availW = Math.max(60, rect.width - 24);
  const availH = Math.max(60, rect.height - 24);

  let targetW, targetH;
  if ((availW / availH) > targetRatio) {
    targetH = availH;
    targetW = targetH * targetRatio;
  } else {
    targetW = availW;
    targetH = targetW / targetRatio;
  }

  previewScreen.style.width = `${Math.round(targetW)}px`;
  previewScreen.style.height = `${Math.round(targetH)}px`;
}

// ----------------------------------------------------
// Color Grading & Rank Ladder Controls
// ----------------------------------------------------
const toggleRankLadder = document.getElementById("toggle-rank-ladder");
const toggleRandomRanks = document.getElementById("toggle-random-ranks");
const rankLadderPos = document.getElementById("rank-ladder-pos");
const rankLadderBgStyle = document.getElementById("rank-ladder-bg-style");
const rankLadderGap = document.getElementById("rank-ladder-gap");
const rankLadderGapVal = document.getElementById("rank-ladder-gap-val");
const rankLadderStartY = document.getElementById("rank-ladder-start-y");
const rankLadderStartYVal = document.getElementById("rank-ladder-start-y-val");
const rankLadderOrder = document.getElementById("rank-ladder-order");
const previewRankLadder = document.getElementById("preview-rank-ladder");

const colorGradingPreset = document.getElementById("color-grading-preset");
const colorContrast = document.getElementById("color-contrast");
const colorContrastVal = document.getElementById("color-contrast-val");
const colorSaturation = document.getElementById("color-saturation");
const colorSaturationVal = document.getElementById("color-saturation-val");
const colorBrightness = document.getElementById("color-brightness");
const colorBrightnessVal = document.getElementById("color-brightness-val");
const colorWarmth = document.getElementById("color-warmth");
const colorWarmthVal = document.getElementById("color-warmth-val");
const btnResetColorGrading = document.getElementById("btn-reset-color-grading");

function getLiveColorGradingFilter() {
  const preset = colorGradingPreset ? colorGradingPreset.value : "none";
  const cMult = colorContrast ? parseFloat(colorContrast.value) || 1.0 : 1.0;
  const sMult = colorSaturation ? parseFloat(colorSaturation.value) || 1.0 : 1.0;
  const bOff = colorBrightness ? parseFloat(colorBrightness.value) || 0.0 : 0.0;
  const wOff = colorWarmth ? parseFloat(colorWarmth.value) || 0.0 : 0.0;

  const presets = {
    none: { c: 1.0, s: 1.0, b: 1.0, sepia: 0, hue: 0 },
    vibrant: { c: 1.12, s: 1.35, b: 1.02, sepia: 0.04, hue: 0 },
    cinematic: { c: 1.18, s: 1.12, b: 0.98, sepia: 0.12, hue: -5 },
    warm_vintage: { c: 1.06, s: 1.10, b: 1.03, sepia: 0.28, hue: -8 },
    cool_noir: { c: 1.20, s: 0.85, b: 0.97, sepia: 0, hue: 10 },
    neon_punch: { c: 1.25, s: 1.50, b: 1.0, sepia: 0, hue: -15 },
    film_matte: { c: 0.95, s: 0.92, b: 1.04, sepia: 0.08, hue: 0 },
  };

  const p = presets[preset] || presets.none;
  const finalContrast = Math.round(p.c * cMult * 100) / 100;
  const finalSaturate = Math.round(p.s * sMult * 100) / 100;
  const finalBrightness = Math.round((p.b + bOff) * 100) / 100;
  const finalSepia = Math.max(0, Math.min(1, p.sepia + (wOff > 0 ? wOff * 0.35 : 0)));
  const finalHue = Math.round(p.hue + (wOff < 0 ? wOff * -25 : 0));

  const parts = [];
  if (finalContrast !== 1.0) parts.push(`contrast(${finalContrast})`);
  if (finalSaturate !== 1.0) parts.push(`saturate(${finalSaturate})`);
  if (finalBrightness !== 1.0) parts.push(`brightness(${finalBrightness})`);
  if (finalSepia > 0.01) parts.push(`sepia(${finalSepia.toFixed(2)})`);
  if (finalHue !== 0) parts.push(`hue-rotate(${finalHue}deg)`);

  return parts.join(" ");
}

function renderPreviewRankLadder(activeItemIdx = null) {
  if (!previewRankLadder || !toggleRankLadder) return;
  if (!toggleRankLadder.checked) {
    previewRankLadder.style.display = "none";
    return;
  }
  previewRankLadder.style.display = "flex";
  const pos = rankLadderPos ? rankLadderPos.value : "left";
  const bgStyle = rankLadderBgStyle ? rankLadderBgStyle.value : "dark";
  const gap = rankLadderGap ? parseInt(rankLadderGap.value, 10) || 50 : 50;
  const startYPct = rankLadderStartY ? parseInt(rankLadderStartY.value, 10) || 28 : 28;
  const order = rankLadderOrder ? rankLadderOrder.value : "desc";

  previewRankLadder.className = `rank-ladder-container ladder-pos-${pos}`;
  previewRankLadder.style.gap = `${gap}px`;
  previewRankLadder.style.top = `${startYPct}%`;

  const items = getItemsData();
  if (!items.length) {
    previewRankLadder.innerHTML = "";
    return;
  }

  let sortedRanks = Array.from(new Set(items.map(it => Number(it.rank) || 1))).sort((a, b) => a - b);
  // order: desc = highest rank number first (e.g. 5,4,3,2,1), asc = lowest first (1,2,3,4,5)
  if (order === "desc") sortedRanks = sortedRanks.slice().reverse();

  const rankMap = new Map();
  items.forEach(it => rankMap.set(Number(it.rank), it));

  const revealedRanks = new Set();
  let currentRank = null;
  if (activeItemIdx !== null && activeItemIdx >= 0 && activeItemIdx < items.length) {
    for (let i = 0; i <= activeItemIdx; i++) {
      revealedRanks.add(Number(items[i].rank));
    }
    currentRank = Number(items[activeItemIdx].rank);
  }

  previewRankLadder.innerHTML = sortedRanks.map(r => {
    const isActive = (r === currentRank);
    const isRevealed = revealedRanks.has(r);
    const item = rankMap.get(r);
    const titleText = (isRevealed && item) ? escapeHtml(item.title || "") : "";
    const rowCls = `rank-ladder-row rank-${r} ${isActive ? "active" : ""}`;
    return `
      <div class="${rowCls}">
        <span class="rank-ladder-num">${r}.</span>
        ${titleText ? `<span class="rank-ladder-text item-label-bg-${bgStyle}">${titleText}</span>` : ""}
      </div>
    `;
  }).join("");
}

if (colorGradingPreset) {
  colorGradingPreset.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}
if (colorContrast) {
  colorContrast.addEventListener("input", () => {
    if (colorContrastVal) colorContrastVal.textContent = `${parseFloat(colorContrast.value).toFixed(2)}x`;
    updateLivePreview();
    saveFormState();
  });
}
if (colorSaturation) {
  colorSaturation.addEventListener("input", () => {
    if (colorSaturationVal) colorSaturationVal.textContent = `${Math.round(parseFloat(colorSaturation.value) * 100)}%`;
    updateLivePreview();
    saveFormState();
  });
}
if (colorBrightness) {
  colorBrightness.addEventListener("input", () => {
    if (colorBrightnessVal) colorBrightnessVal.textContent = parseFloat(colorBrightness.value).toFixed(2);
    updateLivePreview();
    saveFormState();
  });
}
if (colorWarmth) {
  colorWarmth.addEventListener("input", () => {
    if (colorWarmthVal) colorWarmthVal.textContent = parseFloat(colorWarmth.value).toFixed(2);
    updateLivePreview();
    saveFormState();
  });
}
if (btnResetColorGrading) {
  btnResetColorGrading.addEventListener("click", () => {
    if (colorGradingPreset) colorGradingPreset.value = "none";
    if (colorContrast) colorContrast.value = "1.0";
    if (colorContrastVal) colorContrastVal.textContent = "1.00x";
    if (colorSaturation) colorSaturation.value = "1.0";
    if (colorSaturationVal) colorSaturationVal.textContent = "100%";
    if (colorBrightness) colorBrightness.value = "0.0";
    if (colorBrightnessVal) colorBrightnessVal.textContent = "0.00";
    if (colorWarmth) colorWarmth.value = "0.0";
    if (colorWarmthVal) colorWarmthVal.textContent = "0.00";
    updateLivePreview();
    saveFormState();
  });
}

if (toggleRankLadder) {
  toggleRankLadder.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}
if (rankLadderPos) {
  rankLadderPos.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}
if (rankLadderBgStyle) {
  rankLadderBgStyle.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}
if (rankLadderGap) {
  rankLadderGap.addEventListener("input", () => {
    if (rankLadderGapVal) rankLadderGapVal.textContent = `${rankLadderGap.value}px`;
    updateLivePreview();
    saveFormState();
  });
}
if (rankLadderStartY) {
  rankLadderStartY.addEventListener("input", () => {
    if (rankLadderStartYVal) rankLadderStartYVal.textContent = `${rankLadderStartY.value}%`;
    updateLivePreview();
    saveFormState();
  });
}
if (rankLadderOrder) {
  rankLadderOrder.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}
if (titleBgWidth) {
  titleBgWidth.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}
if (toggleRandomRanks) {
  toggleRandomRanks.addEventListener("change", () => {
    recalcRanks();
    saveFormState();
  });
}

function updateLivePreview(forcedSegment = null) {
  if (!previewScreen) return;

  // Aspect ratio adjustment (Optimized for YouTube Shorts mobile screen)
  const res = resolutionSelect?.value || "1080x1920";
  if (res === "1080x1920") {
    previewScreen.style.aspectRatio = "9 / 16";
    previewScreen.style.borderRadius = "18px";
  } else {
    previewScreen.style.aspectRatio = "16 / 9";
    previewScreen.style.borderRadius = "12px";
  }
  fitPreviewToStage();


  // Font family adjustment & select styling
  const fontVal = fontSelect?.value || "Geist";
  previewScreen.style.fontFamily = `"${fontVal}", var(--font-sans)`;
  if (fontSelect) {
    fontSelect.style.fontFamily = `"${fontVal}", var(--font-sans)`;
  }

  // Canvas background
  const rawBg = (bgColorInput?.value || "#141414").trim();
  let bgHex = rawBg;
  if (bgHex.startsWith("0x") || bgHex.startsWith("0X")) {
    bgHex = "#" + bgHex.slice(2);
  }
  previewScreen.style.backgroundColor = bgHex;

  if (bgImageId && bgImageId.value) {
    previewScreen.style.backgroundImage = `url(/uploads/${bgImageId.value})`;
  } else {
    previewScreen.style.backgroundImage = "none";
  }

  const defaultColor = colorNameToHex(accentColorInput?.value || "#ffff00");
  if (defaultColor && defaultColor.length === 7) {
    const r = parseInt(defaultColor.slice(1, 3), 16);
    const g = parseInt(defaultColor.slice(3, 5), 16);
    const b = parseInt(defaultColor.slice(5, 7), 16);
    document.documentElement.style.setProperty('--live-accent-r', r);
    document.documentElement.style.setProperty('--live-accent-g', g);
    document.documentElement.style.setProperty('--live-accent-b', b);
  }

  const titleHtml = buildTitleHtml(defaultColor);

  // Framing mode (fit, fill, stretch, blur, card)
  const clipFitRadio = document.querySelector('input[name="clip-fit"]:checked');
  const clipFitVal = clipFitRadio ? clipFitRadio.value : "fit";
  if (previewClipFramingBadge) {
    previewClipFramingBadge.textContent = `Framing: ${clipFitVal.toUpperCase()}`;
  }

  if (previewScreen && previewScreen.classList && typeof previewScreen.classList.remove === "function") {
    previewScreen.classList.remove("preview-fit-fit", "preview-fit-fill", "preview-fit-stretch", "preview-fit-blur", "preview-fit-card");
    previewScreen.classList.add(`preview-fit-${clipFitVal}`);
  }


  // Font sizes, text background styles & shadows
  const titleFontSize = parseInt(document.getElementById("title-font-size")?.value, 10) || 68;
  const itemFontSize = parseInt(document.getElementById("item-font-size")?.value, 10) || 52;
  const titleBgStyle = document.getElementById("title-bg-style")?.value || "none";
  const titleShadowToggle = document.getElementById("title-shadow-toggle");
  const titleShadow = titleShadowToggle ? Boolean(titleShadowToggle.checked) : true;
  const itemBgStyle = document.getElementById("item-bg-style")?.value || "dark";
  const itemShadowToggle = document.getElementById("item-shadow-toggle");
  const itemShadow = itemShadowToggle ? Boolean(itemShadowToggle.checked) : true;

  const applyTitleStyle = (el, baseScale) => {
    if (!el) return;
    el.style.fontSize = `${Math.round((titleFontSize / 68) * baseScale)}px`;
    if (el.classList && typeof el.classList.remove === "function") {
      el.classList.remove("title-bg-none", "title-bg-dark", "title-bg-solid", "title-bg-accent", "title-bg-full", "title-shadow", "title-no-shadow");
      el.classList.add(`title-bg-${titleBgStyle}`);
      const bgWidth = document.getElementById("title-bg-width")?.value || "wrap";
      if (bgWidth === "full" && titleBgStyle !== "none") {
        el.classList.add("title-bg-full");
      }
      el.classList.add(titleShadow ? "title-shadow" : "title-no-shadow");
    }
  };
  applyTitleStyle(previewIntroTitle, 18);
  applyTitleStyle(previewItemTopTitle, 15);

  // Clip label position (bottom, left, right) and styling
  const labelPosRadio = document.querySelector('input[name="item-label-pos"]:checked');
  const labelPosVal = labelPosRadio ? labelPosRadio.value : "bottom";
  if (previewItemLabel) {
    previewItemLabel.style.fontSize = `${Math.round((itemFontSize / 52) * 13)}px`;
    if (previewItemLabel.classList && typeof previewItemLabel.classList.remove === "function") {
      previewItemLabel.classList.remove(
        "label-pos-bottom", "label-pos-left", "label-pos-right",
        "item-label-bg-none", "item-label-bg-dark", "item-label-bg-solid", "item-label-bg-accent",
        "item-label-shadow", "item-label-no-shadow"
      );
      previewItemLabel.classList.add(`label-pos-${labelPosVal}`);
      previewItemLabel.classList.add(`item-label-bg-${itemBgStyle}`);
      previewItemLabel.classList.add(itemShadow ? "item-label-shadow" : "item-label-no-shadow");
    } else {
      previewItemLabel.className = `label-pos-${labelPosVal} item-label-bg-${itemBgStyle} ${itemShadow ? "item-label-shadow" : "item-label-no-shadow"}`;
    }
  }

  const activeVideo = document.getElementById("preview-active-video");
  const clipPlaceholder = document.getElementById("preview-clip-placeholder");
  if (activeVideo) {
    activeVideo.style.filter = getLiveColorGradingFilter();
  }

  // Preview Mode: 'sequence' (timeline), 'intro', or 'item'
  const modeRadio = document.querySelector('input[name="preview-mode"]:checked');
  const mode = forcedSegment ? (forcedSegment.type === "intro" ? "intro" : "item") : (modeRadio?.value || "sequence");

  if (mode === "intro") {
    if (previewIntroContent) previewIntroContent.style.display = "flex";
    if (previewItemContent) previewItemContent.style.display = "none";
    if (previewItemSelectorWrapper) previewItemSelectorWrapper.style.display = "none";
    if (previewIntroTitle) previewIntroTitle.innerHTML = titleHtml;
    if (activeVideo) {
      if (typeof activeVideo.pause === "function") {
        try { activeVideo.pause(); } catch(e) {}
      }
      activeVideo.style.display = "none";
    }
    if (clipPlaceholder) clipPlaceholder.style.display = "flex";
    triggerPreviewAnimations("intro");
  } else if (mode === "item") {
    if (previewIntroContent) previewIntroContent.style.display = "none";
    if (previewItemContent) previewItemContent.style.display = "block";
    if (previewItemSelectorWrapper && !forcedSegment) {
      previewItemSelectorWrapper.style.display = "inline-flex";
    }
    if (previewItemTopTitle) previewItemTopTitle.innerHTML = titleHtml;

    const items = getItemsData();
    if (previewItemSelect && !forcedSegment) {
      const prevVal = parseInt(previewItemSelect.value, 10) || 0;
      previewItemSelect.innerHTML = "";
      items.forEach((it, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `#${it.rank} - ${it.title || "Untitled"}`;
        previewItemSelect.appendChild(opt);
      });
      if (previewItemSelect.options.length > prevVal) {
        previewItemSelect.value = prevVal;
      }
    }

    const selectedIdx = forcedSegment && forcedSegment.itemIndex !== undefined
      ? forcedSegment.itemIndex
      : (previewItemSelect ? (parseInt(previewItemSelect.value, 10) || 0) : 0);

    const item = items[selectedIdx] || { rank: 1, title: "Item Title", source: "", start: 0, end: 8 };

    if (previewClipTitle) {
      previewClipTitle.textContent = item.title ? item.title : "Clip Video Area";
    }
    if (previewClipSource) {
      previewClipSource.textContent = item.source ? item.source : "(Source Media)";
    }
    if (previewItemLabel) {
      const showLadder = toggleRankLadder ? Boolean(toggleRankLadder.checked) : false;
      if (showLadder) {
        previewItemLabel.style.display = "none";
      } else {
        previewItemLabel.style.display = "block";
        previewItemLabel.textContent = `#${item.rank}  ${item.title || "Item Title"}`;
      }
    }

    // Real-Time Video Playback Resolution
    let resolvedVideoSrc = "";
    if (item.source && typeof item.source === "string") {
      const s = item.source.trim();
      if (s.startsWith("http://") || s.startsWith("https://")) {
        if (downloadedSources.has(s)) {
          resolvedVideoSrc = downloadedSources.get(s);
        } else if (!downloadingSet.has(s) && !downloadFailedSet.has(s)) {
          preDownloadSource(s);
        }
      } else if (s.startsWith("/uploads/") || s.startsWith("/downloads/")) {
        resolvedVideoSrc = s;
      } else if (s.length > 0) {
        resolvedVideoSrc = `/uploads/${s}`;
      }
    }

    if (activeVideo) {
      if (resolvedVideoSrc) {
        if (clipFitVal === "fill") {
          activeVideo.style.objectFit = "cover";
        } else if (clipFitVal === "stretch") {
          activeVideo.style.objectFit = "fill";
        } else {
          activeVideo.style.objectFit = "contain";
        }

        // Live Audio Volume & Mute Sync
        const globalClipVol = parseFloat(document.getElementById("clip-volume")?.value || 1.0);
        const itemVol = item.volume !== undefined ? item.volume : 1.0;
        const effectiveVol = Math.max(0, Math.min(1.0, globalClipVol * itemVol));
        if (typeof activeVideo.volume === "number") {
          activeVideo.volume = effectiveVol;
        }
        activeVideo.muted = isPreviewMuted;

        const currentSrc = (typeof activeVideo.getAttribute === "function")
          ? activeVideo.getAttribute("data-current-src")
          : (activeVideo.dataset ? activeVideo.dataset.currentSrc : "");

        if (currentSrc !== resolvedVideoSrc) {
          activeVideo.src = resolvedVideoSrc;
          if (typeof activeVideo.setAttribute === "function") {
            activeVideo.setAttribute("data-current-src", resolvedVideoSrc);
          } else if (activeVideo.dataset) {
            activeVideo.dataset.currentSrc = resolvedVideoSrc;
          }
          if (typeof activeVideo.load === "function") {
            try { activeVideo.load(); } catch(e) {}
          }
        }

        let targetTime = item.start || 0;
        if (forcedSegment && timelinePlayer) {
          const segOffset = Math.max(0, timelinePlayer.currentTime - forcedSegment.start);
          targetTime = (item.start || 0) + segOffset;
        }

        if (item.end && targetTime > item.end) {
          targetTime = item.end;
        }

        if (typeof activeVideo.currentTime === "number") {
          if (Math.abs(activeVideo.currentTime - targetTime) > 0.35) {
            try { activeVideo.currentTime = targetTime; } catch(e) {}
          }
        }

        if (timelinePlayer && timelinePlayer.isPlaying) {
          if (typeof activeVideo.play === "function" && activeVideo.paused) {
            activeVideo.play().catch(() => {});
          }
        } else {
          if (typeof activeVideo.pause === "function" && !activeVideo.paused) {
            activeVideo.pause();
          }
        }

        activeVideo.style.display = "block";
        if (clipPlaceholder) clipPlaceholder.style.display = "none";
      } else {
        if (typeof activeVideo.pause === "function") {
          try { activeVideo.pause(); } catch(e) {}
        }
        activeVideo.style.display = "none";
        if (clipPlaceholder) clipPlaceholder.style.display = "flex";
      }
    }

    triggerPreviewAnimations(`item-${selectedIdx}`);
  } else {
    // Sequence mode: handled by TimelinePlayer
    if (timelinePlayer) {
      timelinePlayer.renderCurrentFrame();
    }
  }

  // Live Rank Ladder Overlay Sync
  let activeLadderIdx = null;
  if (forcedSegment) {
    if (forcedSegment.type === "item") {
      activeLadderIdx = forcedSegment.itemIndex !== undefined ? forcedSegment.itemIndex : 0;
    }
  } else if (mode === "item") {
    activeLadderIdx = parseInt(previewItemSelect?.value || 0, 10);
  }
  renderPreviewRankLadder(activeLadderIdx);
  renderPreviewElements(
    timelinePlayer ? timelinePlayer.currentTime : 0,
    forcedSegment || { type: mode, itemIndex: activeLadderIdx }
  );
}

// ----------------------------------------------------
// Real-Time Audio Engine & Preview Sound Controls
// ----------------------------------------------------
let isPreviewMuted = false;
const btnPreviewMute = document.getElementById("btn-preview-mute");
const iconAudioOn = document.getElementById("icon-audio-on");
const iconAudioOff = document.getElementById("icon-audio-off");
const previewBgmAudio = document.getElementById("preview-bgm-audio");

function setPreviewMute(muted) {
  isPreviewMuted = Boolean(muted);
  const activeVideo = document.getElementById("preview-active-video");
  if (activeVideo) {
    activeVideo.muted = isPreviewMuted;
  }
  if (previewBgmAudio) {
    previewBgmAudio.muted = isPreviewMuted;
  }
  if (btnPreviewMute) {
    if (isPreviewMuted) btnPreviewMute.classList.add("muted");
    else btnPreviewMute.classList.remove("muted");
  }
  if (iconAudioOn) iconAudioOn.style.display = isPreviewMuted ? "none" : "inline-block";
  if (iconAudioOff) iconAudioOff.style.display = isPreviewMuted ? "inline-block" : "none";
}

if (btnPreviewMute) {
  btnPreviewMute.addEventListener("click", () => {
    setPreviewMute(!isPreviewMuted);
  });
}

// ----------------------------------------------------
// Real-Time Timeline Engine & Scrubber Player
// ----------------------------------------------------
class TimelinePlayer {
  constructor() {
    this.currentTime = 0;
    this.totalDuration = 0;
    this.isPlaying = false;
    this.segments = [];
    this.lastTimestamp = 0;
    this.animationFrameId = null;

    this.playBtn = document.getElementById("btn-timeline-play");
    this.rewindBtn = document.getElementById("btn-timeline-rewind");
    this.timecodeEl = document.getElementById("timeline-timecode");
    this.scrubberEl = document.getElementById("timeline-scrubber");
    this.segmentsTrackEl = document.getElementById("timeline-segments-track");
    this.progressFillEl = document.getElementById("timeline-progress-fill");
    this.playheadEl = document.getElementById("timeline-playhead");
    this.activeSegEl = document.getElementById("timeline-active-segment");
    this.loopToggle = document.getElementById("timeline-loop-toggle");
    this.iconPlay = document.getElementById("icon-play");
    this.iconPause = document.getElementById("icon-pause");

    this.initListeners();
    this.buildSegments();
  }

  syncBgmAudio() {
    if (!previewBgmAudio) return;
    const bgmSrc = bgmId && bgmId.value ? `/uploads/${bgmId.value}` : "";
    if (bgmSrc) {
      if (previewBgmAudio.src !== bgmSrc && !previewBgmAudio.src.endsWith(bgmSrc)) {
        previewBgmAudio.src = bgmSrc;
      }
      const bgmVolInput = document.getElementById("bgm-volume");
      const bgmVol = bgmVolInput ? parseFloat(bgmVolInput.value) || 0.25 : 0.25;
      if (typeof previewBgmAudio.volume === "number") {
        previewBgmAudio.volume = Math.max(0, Math.min(1.0, bgmVol));
      }
      previewBgmAudio.muted = isPreviewMuted;

      if (this.isPlaying) {
        if (typeof previewBgmAudio.play === "function" && previewBgmAudio.paused) {
          previewBgmAudio.play().catch(() => {});
        }
      } else {
        if (typeof previewBgmAudio.pause === "function" && !previewBgmAudio.paused) {
          previewBgmAudio.pause();
        }
      }
    } else {
      if (typeof previewBgmAudio.pause === "function") {
        previewBgmAudio.pause();
      }
    }
  }

  initListeners() {
    if (this.playBtn) {
      this.playBtn.addEventListener("click", () => this.togglePlay());
    }
    if (this.rewindBtn) {
      this.rewindBtn.addEventListener("click", () => this.seekTo(0));
    }

    // Keyboard Spacebar play/pause
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
          const activeTag = document.activeElement ? document.activeElement.tagName : "";
          if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
          e.preventDefault();
          this.togglePlay();
        }
      });
    }

    // Scrubber click & drag seeking
    if (this.scrubberEl && typeof this.scrubberEl.addEventListener === "function") {
      let isDragging = false;
      const handleScrub = (e) => {
        if (!this.scrubberEl.getBoundingClientRect) return;
        const rect = this.scrubberEl.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const fraction = rect.width > 0 ? clickX / rect.width : 0;
        this.seekTo(fraction * this.totalDuration);
      };

      this.scrubberEl.addEventListener("mousedown", (e) => {
        isDragging = true;
        handleScrub(e);
      });
      if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("mousemove", (e) => {
          if (isDragging) handleScrub(e);
        });
        window.addEventListener("mouseup", () => {
          isDragging = false;
        });
      }
    }
  }

  buildSegments() {
    const items = getItemsData();
    const introInput = document.getElementById("intro-seconds");
    const introSec = introInput ? (parseFloat(introInput.value) || 3.0) : 3.0;
    this.segments = [];
    let currentT = 0;

    // Intro segment
    this.segments.push({
      type: "intro",
      title: "Intro Title",
      start: currentT,
      end: currentT + introSec,
      duration: introSec,
    });
    currentT += introSec;

    // Item segments
    items.forEach((item, idx) => {
      let dur = 8.0;
      if (item.end !== null && !isNaN(item.end) && item.end > item.start) {
        dur = item.end - item.start;
      }
      this.segments.push({
        type: "item",
        itemIndex: idx,
        rank: item.rank,
        title: item.title || `Item #${item.rank}`,
        source: item.source,
        start: currentT,
        end: currentT + dur,
        duration: dur,
      });
      currentT += dur;
    });

    this.totalDuration = Math.max(1.0, currentT);
    this.renderSegmentsTrack();
    this.updateUI();
  }

  renderSegmentsTrack() {
    if (!this.segmentsTrackEl) return;
    this.segmentsTrackEl.innerHTML = "";

    this.segments.forEach(seg => {
      const pct = (seg.duration / this.totalDuration) * 100;
      const block = document.createElement("div");
      block.className = "timeline-segment-block";
      block.style.width = `${pct}%`;
      block.title = `${seg.title} (${seg.duration.toFixed(1)}s)`;
      block.textContent = seg.type === "intro" ? "Intro" : `#${seg.rank}`;
      this.segmentsTrackEl.appendChild(block);
    });
  }

  getActiveSegment() {
    if (!this.segments.length) return null;
    const seg = this.segments.find(s => this.currentTime >= s.start && this.currentTime < s.end);
    return seg || this.segments[this.segments.length - 1];
  }

  formatTime(s) {
    const mins = Math.floor(s / 60);
    const secs = (s % 60).toFixed(1);
    const mm = mins < 10 ? "0" + mins : mins;
    const ss = parseFloat(secs) < 10 ? "0" + secs : secs;
    return `${mm}:${ss}`;
  }

  updateUI() {
    const fraction = this.totalDuration > 0 ? (this.currentTime / this.totalDuration) : 0;
    const pct = Math.min(100, Math.max(0, fraction * 100));

    if (this.progressFillEl) this.progressFillEl.style.width = `${pct}%`;
    if (this.playheadEl) this.playheadEl.style.left = `${pct}%`;

    if (this.timecodeEl) {
      this.timecodeEl.textContent = `${this.formatTime(this.currentTime)} / ${this.formatTime(this.totalDuration)}`;
    }

    const active = this.getActiveSegment();
    if (this.activeSegEl && active) {
      this.activeSegEl.textContent = active.type === "intro"
        ? `Intro Screen (${active.duration.toFixed(1)}s)`
        : `Rank #${active.rank}: ${active.title || "Untitled"}`;
    }

    // Highlight active track block
    if (this.segmentsTrackEl) {
      const blocks = this.segmentsTrackEl.children;
      this.segments.forEach((seg, idx) => {
        if (blocks[idx]) {
          if (active === seg) {
            blocks[idx].classList.add("active");
          } else {
            blocks[idx].classList.remove("active");
          }
        }
      });
    }

    renderPreviewElements(this.currentTime, active);
  }

  renderCurrentFrame() {
    const active = this.getActiveSegment();
    if (!active) return;
    updateLivePreview(active);
  }

  seekTo(seconds) {
    this.currentTime = Math.max(0, Math.min(seconds, this.totalDuration));
    this.updateUI();
    if (previewBgmAudio && !isNaN(previewBgmAudio.duration) && previewBgmAudio.duration > 0) {
      try {
        previewBgmAudio.currentTime = this.currentTime % previewBgmAudio.duration;
      } catch(e) {}
    }
    const mode = document.querySelector('input[name="preview-mode"]:checked')?.value || "sequence";
    if (mode === "sequence") {
      this.renderCurrentFrame();
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.currentTime >= this.totalDuration) {
      this.currentTime = 0;
    }
    this.isPlaying = true;
    this.lastTimestamp = performance.now();

    // Ensure timeline mode is active
    const radioSeq = document.querySelector('input[name="preview-mode"][value="sequence"]');
    if (radioSeq) radioSeq.checked = true;

    if (this.iconPlay) this.iconPlay.style.display = "none";
    if (this.iconPause) this.iconPause.style.display = "inline-block";

    const activeVideo = document.getElementById("preview-active-video");
    if (activeVideo) {
      activeVideo.muted = isPreviewMuted;
    }
    this.syncBgmAudio();

    this.tick = (now) => {
      if (!this.isPlaying) return;
      const delta = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;

      this.currentTime += delta;
      if (this.currentTime >= this.totalDuration) {
        if (this.loopToggle && this.loopToggle.checked) {
          this.currentTime = 0;
          if (previewBgmAudio && !isNaN(previewBgmAudio.duration) && previewBgmAudio.duration > 0) {
            try { previewBgmAudio.currentTime = 0; } catch(e) {}
          }
        } else {
          this.currentTime = this.totalDuration;
          this.pause();
          this.updateUI();
          this.renderCurrentFrame();
          return;
        }
      }

      this.updateUI();
      this.renderCurrentFrame();
      this.animationFrameId = requestAnimationFrame(this.tick);
    };

    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.iconPlay) this.iconPlay.style.display = "inline-block";
    if (this.iconPause) this.iconPause.style.display = "none";
    const activeVideo = document.getElementById("preview-active-video");
    if (activeVideo && typeof activeVideo.pause === "function") {
      try { activeVideo.pause(); } catch(e) {}
    }
    if (previewBgmAudio && typeof previewBgmAudio.pause === "function") {
      try { previewBgmAudio.pause(); } catch(e) {}
    }
  }
}

// Global timeline player instance
let timelinePlayer = null;

// Preview mode event wiring
document.querySelectorAll('input[name="preview-mode"]').forEach(r => {
  r.addEventListener("change", () => {
    if (r.value === "sequence") {
      timelinePlayer?.renderCurrentFrame();
    } else {
      updateLivePreview();
    }
    saveFormState();
  });
});

document.querySelectorAll('input[name="item-label-pos"]').forEach(r => {
  r.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
});

if (previewItemSelect) {
  previewItemSelect.addEventListener("change", () => {
    updateLivePreview();
  });
}

if (videoTitleInput) {
  videoTitleInput.addEventListener("input", () => {
    renderWordColorChips();
    updateLivePreview();
    saveFormState();
  });
}

if (fontSelect) {
  fontSelect.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}

document.querySelectorAll('input[name="clip-fit"]').forEach(r => {
  r.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
});

const accentColorPicker = document.getElementById("accent-color-picker");
if (accentColorInput) {
  accentColorInput.addEventListener("input", () => {
    if (accentColorPicker) accentColorPicker.value = colorNameToHex(accentColorInput.value);
    updateLivePreview();
    saveFormState();
  });
}
if (accentColorPicker) {
  accentColorPicker.addEventListener("input", () => {
    if (accentColorInput) accentColorInput.value = accentColorPicker.value;
    updateLivePreview();
    saveFormState();
  });
}

if (resolutionSelect) {
  resolutionSelect.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}

const bgColorPicker = document.getElementById("bg-color-picker");
if (bgColorInput) {
  bgColorInput.addEventListener("input", () => {
    if (bgColorPicker) bgColorPicker.value = colorNameToHex(bgColorInput.value);
    updateLivePreview();
    saveFormState();
  });
}
if (bgColorPicker) {
  bgColorPicker.addEventListener("input", () => {
    if (bgColorInput) bgColorInput.value = bgColorPicker.value;
    updateLivePreview();
    saveFormState();
  });
}

const introSecondsInput = document.getElementById("intro-seconds");
if (introSecondsInput) {
  introSecondsInput.addEventListener("input", () => {
    timelinePlayer?.buildSegments();
    updateLivePreview();
    saveFormState();
  });
  introSecondsInput.addEventListener("change", () => {
    timelinePlayer?.buildSegments();
    updateLivePreview();
    saveFormState();
  });
}

const transitionsToggle = document.getElementById("transitions-toggle");
if (transitionsToggle) {
  transitionsToggle.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}

// Draggable Splitter Resizer
const splitterResizer = document.getElementById("splitter-resizer");
const studioStagePanel = document.getElementById("studio-stage-panel");

if (splitterResizer && studioStagePanel) {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  splitterResizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    const stageRect = studioStagePanel.getBoundingClientRect ? studioStagePanel.getBoundingClientRect() : null;
    startWidth = stageRect ? stageRect.width : (parseInt(studioStagePanel.style.width, 10) || 380);
    splitterResizer.classList.add("dragging");
    if (document.body?.classList) document.body.classList.add("resizing-panel");
    if (typeof e.preventDefault === "function") e.preventDefault();
  });

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const delta = startX - e.clientX;
      let newWidth = startWidth + delta;
      newWidth = Math.max(260, Math.min(720, newWidth));
      studioStagePanel.style.width = `${newWidth}px`;
      fitPreviewToStage();
    });

    window.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        splitterResizer.classList.remove("dragging");
        if (document.body?.classList) document.body.classList.remove("resizing-panel");
        saveFormState();
      }
    });
  }
}

// State Persistence (localStorage)
const STORAGE_KEY = "ranking_video_form_state";

function markSaved() {
  const saveEl = document.getElementById("studio-save-status");
  if (saveEl) saveEl.textContent = "Saved \u00b7 Ready to Export";
}

function markEditing() {
  const saveEl = document.getElementById("studio-save-status");
  if (saveEl) saveEl.textContent = "Changes detected \u00b7 Ready to Export";
}

function saveFormState() {
  try {
    const clipFitRadio = document.querySelector('input[name="clip-fit"]:checked');
    const labelPosRadio = document.querySelector('input[name="item-label-pos"]:checked');
    const state = {
      title: document.getElementById("video-title")?.value || "",
      title_words: getTitleWordsData(),
      preview_mode: document.querySelector('input[name="preview-mode"]:checked')?.value || "sequence",
      resolution: document.getElementById("resolution-preset")?.value || "1920x1080",
      font: document.getElementById("font-select")?.value || "Geist",
      clip_fit: clipFitRadio ? clipFitRadio.value : "fit",
      item_label_position: labelPosRadio ? labelPosRadio.value : "bottom",
      accent: document.getElementById("accent-color")?.value || "#ffff00",
      bg_color: document.getElementById("bg-color")?.value || "#141414",
      bg_image_id: bgImageId?.value || "",
      bg_image_name: bgImageFilename?.textContent || "",
      bgm_id: bgmId?.value || "",
      bgm_name: bgmFilename?.textContent || "",
      bgm_volume: document.getElementById("bgm-volume")?.value || "0.25",
      clip_volume: document.getElementById("clip-volume")?.value || "1.0",
      intro_seconds: document.getElementById("intro-seconds")?.value || "3.0",
      transitions: document.getElementById("transitions-toggle") ? document.getElementById("transitions-toggle").checked : true,
      title_font_size: parseInt(document.getElementById("title-font-size")?.value, 10) || 68,
      item_font_size: parseInt(document.getElementById("item-font-size")?.value, 10) || 52,
      title_bg_style: document.getElementById("title-bg-style")?.value || "none",
      title_bg_width: document.getElementById("title-bg-width")?.value || "wrap",
      title_shadow: document.getElementById("title-shadow-toggle") ? Boolean(document.getElementById("title-shadow-toggle").checked) : true,
      item_bg_style: document.getElementById("item-bg-style")?.value || "dark",
      item_shadow: document.getElementById("item-shadow-toggle") ? Boolean(document.getElementById("item-shadow-toggle").checked) : true,
      show_rank_ladder: document.getElementById("toggle-rank-ladder") ? Boolean(document.getElementById("toggle-rank-ladder").checked) : false,
      randomize_ranks: document.getElementById("toggle-random-ranks") ? Boolean(document.getElementById("toggle-random-ranks").checked) : false,
      rank_ladder_position: document.getElementById("rank-ladder-pos")?.value || "left",
      rank_ladder_bg_style: document.getElementById("rank-ladder-bg-style")?.value || "dark",
      rank_ladder_gap: parseInt(document.getElementById("rank-ladder-gap")?.value, 10) || 50,
      color_grading_preset: document.getElementById("color-grading-preset")?.value || "none",
      color_contrast: document.getElementById("color-contrast")?.value || "1.0",
      color_saturation: document.getElementById("color-saturation")?.value || "1.0",
      color_brightness: document.getElementById("color-brightness")?.value || "0.0",
      color_warmth: document.getElementById("color-warmth")?.value || "0.0",
      stage_width: studioStagePanel?.style.width || "",
      elements: overlayElements,
      items: getItemsData(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    markSaved();
  } catch (e) {
    console.warn("Could not save form state to localStorage:", e);
  }
}

function loadFormState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (!state) return false;

    if (state.title !== undefined && document.getElementById("video-title")) {
      document.getElementById("video-title").value = state.title;
    }
    if (state.preview_mode) {
      const r = document.querySelector(`input[name="preview-mode"][value="${state.preview_mode}"]`);
      if (r) r.checked = true;
    }
    if (state.resolution && document.getElementById("resolution-preset")) {
      document.getElementById("resolution-preset").value = state.resolution;
    }
    if (state.font && document.getElementById("font-select")) {
      document.getElementById("font-select").value = state.font;
    }
    if (state.clip_fit) {
      const fitR = document.querySelector(`input[name="clip-fit"][value="${state.clip_fit}"]`);
      if (fitR) fitR.checked = true;
    }
    if (state.item_label_position) {
      const lpR = document.querySelector(`input[name="item-label-pos"][value="${state.item_label_position}"]`);
      if (lpR) lpR.checked = true;
    }
    if (state.title_font_size !== undefined && document.getElementById("title-font-size")) {
      document.getElementById("title-font-size").value = state.title_font_size;
      const badge = document.getElementById("title-font-size-val");
      if (badge) badge.textContent = `${state.title_font_size}px`;
    }
    if (state.item_font_size !== undefined && document.getElementById("item-font-size")) {
      document.getElementById("item-font-size").value = state.item_font_size;
      const badge = document.getElementById("item-font-size-val");
      if (badge) badge.textContent = `${state.item_font_size}px`;
    }
    if (state.title_bg_style && document.getElementById("title-bg-style")) {
      document.getElementById("title-bg-style").value = state.title_bg_style;
    }
    if (state.title_shadow !== undefined && document.getElementById("title-shadow-toggle")) {
      document.getElementById("title-shadow-toggle").checked = Boolean(state.title_shadow);
    }
    if (state.item_bg_style && document.getElementById("item-bg-style")) {
      document.getElementById("item-bg-style").value = state.item_bg_style;
    }
    if (state.item_shadow !== undefined && document.getElementById("item-shadow-toggle")) {
      document.getElementById("item-shadow-toggle").checked = Boolean(state.item_shadow);
    }
    if (state.show_rank_ladder !== undefined && document.getElementById("toggle-rank-ladder")) {
      document.getElementById("toggle-rank-ladder").checked = state.show_rank_ladder;
    }
    if (state.randomize_ranks !== undefined && document.getElementById("toggle-random-ranks")) {
      document.getElementById("toggle-random-ranks").checked = state.randomize_ranks;
    }
    if (state.rank_ladder_position && document.getElementById("rank-ladder-pos")) {
      document.getElementById("rank-ladder-pos").value = state.rank_ladder_position;
    }
    if (state.rank_ladder_bg_style && document.getElementById("rank-ladder-bg-style")) {
      document.getElementById("rank-ladder-bg-style").value = state.rank_ladder_bg_style;
    }
    if (state.rank_ladder_gap !== undefined && document.getElementById("rank-ladder-gap")) {
      document.getElementById("rank-ladder-gap").value = state.rank_ladder_gap;
      const badge = document.getElementById("rank-ladder-gap-val");
      if (badge) badge.textContent = `${state.rank_ladder_gap}px`;
    }
    if (state.color_grading_preset && document.getElementById("color-grading-preset")) {
      document.getElementById("color-grading-preset").value = state.color_grading_preset;
    }
    if (state.color_contrast !== undefined && document.getElementById("color-contrast")) {
      document.getElementById("color-contrast").value = state.color_contrast;
      const b = document.getElementById("color-contrast-val");
      if (b) b.textContent = `${parseFloat(state.color_contrast).toFixed(2)}x`;
    }
    if (state.color_saturation !== undefined && document.getElementById("color-saturation")) {
      document.getElementById("color-saturation").value = state.color_saturation;
      const b = document.getElementById("color-saturation-val");
      if (b) b.textContent = `${Math.round(parseFloat(state.color_saturation) * 100)}%`;
    }
    if (state.color_brightness !== undefined && document.getElementById("color-brightness")) {
      document.getElementById("color-brightness").value = state.color_brightness;
      const b = document.getElementById("color-brightness-val");
      if (b) b.textContent = parseFloat(state.color_brightness).toFixed(2);
    }
    if (state.color_warmth !== undefined && document.getElementById("color-warmth")) {
      document.getElementById("color-warmth").value = state.color_warmth;
      const b = document.getElementById("color-warmth-val");
      if (b) b.textContent = parseFloat(state.color_warmth).toFixed(2);
    }
    if (state.accent && document.getElementById("accent-color")) {
      document.getElementById("accent-color").value = state.accent;
      if (document.getElementById("accent-color-picker")) {
        document.getElementById("accent-color-picker").value = colorNameToHex(state.accent);
      }
    }
    if (state.bg_color && document.getElementById("bg-color")) {
      document.getElementById("bg-color").value = state.bg_color;
      if (document.getElementById("bg-color-picker")) {
        document.getElementById("bg-color-picker").value = colorNameToHex(state.bg_color);
      }
    }
    if (state.bg_image_id && bgImageId) {
      bgImageId.value = state.bg_image_id;
      if (bgImageFilename && state.bg_image_name) {
        bgImageFilename.textContent = state.bg_image_name;
      }
      if (btnUploadBgImage) btnUploadBgImage.textContent = "Change Image";
    }
    if (state.bgm_id && bgmId) {
      bgmId.value = state.bgm_id;
      if (bgmFilename && state.bgm_name) {
        bgmFilename.textContent = state.bgm_name;
      }
      if (btnUploadBgm) btnUploadBgm.textContent = "Change Audio";
    }
    if (state.bgm_volume !== undefined && document.getElementById("bgm-volume")) {
      document.getElementById("bgm-volume").value = state.bgm_volume;
    }
    if (state.clip_volume !== undefined && document.getElementById("clip-volume")) {
      document.getElementById("clip-volume").value = state.clip_volume;
    }
    if (state.intro_seconds !== undefined && document.getElementById("intro-seconds")) {
      document.getElementById("intro-seconds").value = state.intro_seconds;
    }
    if (state.transitions !== undefined && document.getElementById("transitions-toggle")) {
      document.getElementById("transitions-toggle").checked = Boolean(state.transitions);
    }
    if (state.stage_width && studioStagePanel) {
      studioStagePanel.style.width = state.stage_width;
    }

    if (Array.isArray(state.items) && state.items.length > 0 && itemsContainer) {
      itemsContainer.innerHTML = "";
      state.items.forEach(it => {
        addItem(it.title || "", it.source || "", it.start || 0, it.end !== null ? it.end : 8, it.volume !== undefined ? it.volume : 1.0);
        if (it.source && (it.source.startsWith("http://") || it.source.startsWith("https://"))) {
          preDownloadSource(it.source);
        }
      });
      const rows = itemsContainer.querySelectorAll(".item-row");
      rows.forEach((row, idx) => {
        if (state.items[idx]?.rank !== undefined) {
          const rankInp = row.querySelector(".item-rank");
          if (rankInp) rankInp.value = state.items[idx].rank;
        }
      });
    }

    if (Array.isArray(state.elements)) {
      overlayElements = state.elements;
      renderElementsList();
    }

    renderWordColorChips(state.title_words || null);
    timelinePlayer?.buildSegments();
    updateLivePreview();
    return true;
  } catch (e) {
    console.warn("Could not load form state from localStorage:", e);
  }
  return false;
}

// Auto-save & edit detection
const videoForm = document.getElementById("video-form");
if (videoForm) {
  videoForm.addEventListener("input", () => {
    markEditing();
    timelinePlayer?.buildSegments();
    updateLivePreview();
    saveFormState();
  });
  videoForm.addEventListener("change", () => {
    markEditing();
    timelinePlayer?.buildSegments();
    updateLivePreview();
    saveFormState();
  });
}

// Initialize Timeline & State on DOM load
timelinePlayer = new TimelinePlayer();

const loaded = loadFormState();
if (!loaded) {
  if (itemsContainer && itemsContainer.children.length === 0) {
    addItem("Top Play", "", 0, 8);
    addItem("Runner Up", "", 0, 8);
  }
  renderWordColorChips();
  timelinePlayer?.buildSegments();
  updateLivePreview();
}

// Window resize & ResizeObserver listeners for automatic responsive fitting
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("resize", fitPreviewToStage);
}

if (typeof window !== "undefined" && typeof ResizeObserver !== "undefined") {
  const stageEl = document.getElementById("preview-frame-container");
  if (stageEl) {
    const ro = new ResizeObserver(() => fitPreviewToStage());
    ro.observe(stageEl);
  }
}

// Recent Videos Modal & Source Media Purge Logic
const btnRecentVideos = document.getElementById("btn-recent-videos");
const recentVideosModal = document.getElementById("recent-videos-modal");
const btnCloseRecentModal = document.getElementById("btn-close-recent-modal");
const recentVideosList = document.getElementById("recent-videos-list");
const btnPurgeDownloads = document.getElementById("btn-purge-downloads");

async function loadRecentVideos() {
  if (!recentVideosList) return;
  recentVideosList.innerHTML = '<div style="text-align: center; padding: 24px; color: #888; font-size: 12px;">Loading recent exports...</div>';
  try {
    const res = await fetch("/api/recent-videos");
    if (!res.ok) throw new Error("Failed to fetch recent videos");
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) {
      recentVideosList.innerHTML = '<div style="text-align: center; padding: 28px; color: #777; font-size: 13px;">No exported videos yet. Click "Export Video" to create your first short!</div>';
      return;
    }

    recentVideosList.innerHTML = "";
    list.forEach(v => {
      const card = document.createElement("div");
      card.className = "recent-video-card";
      const dt = v.created_at ? new Date(v.created_at).toLocaleString() : "";
      card.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div class="recent-video-title">${escapeHtml(v.title || "Untitled Export")}</div>
          <div class="recent-video-meta">
            <span>Job: ${escapeHtml(v.job_id)}</span>
            ${dt ? `<span>\u00b7 ${escapeHtml(dt)}</span>` : ""}
          </div>
        </div>
        <a href="${escapeHtml(v.download_url)}" download="${escapeHtml(v.filename)}" class="btn-ghost-sm" style="color: var(--color-accent); text-decoration: none; border-color: rgba(0, 240, 255, 0.4); padding: 4px 10px; font-size: 11px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Download</span>
        </a>
      `;
      recentVideosList.appendChild(card);
    });
  } catch (e) {
    recentVideosList.innerHTML = `<div style="text-align: center; padding: 24px; color: #ff6b6b; font-size: 12px;">Error loading recent videos: ${escapeHtml(e.message)}</div>`;
  }
}

if (btnRecentVideos && recentVideosModal) {
  btnRecentVideos.addEventListener("click", () => {
    recentVideosModal.style.display = "flex";
    loadRecentVideos();
  });
}

if (btnCloseRecentModal && recentVideosModal) {
  btnCloseRecentModal.addEventListener("click", () => {
    recentVideosModal.style.display = "none";
  });
}

if (recentVideosModal) {
  recentVideosModal.addEventListener("click", (e) => {
    if (e.target === recentVideosModal) {
      recentVideosModal.style.display = "none";
    }
  });
}

if (btnPurgeDownloads) {
  btnPurgeDownloads.addEventListener("click", async () => {
    try {
      btnPurgeDownloads.disabled = true;
      btnPurgeDownloads.textContent = "Cleaning...";
      const res = await fetch("/api/cleanup-downloads", { method: "POST" });
      const data = await res.json();
      downloadedSources.clear();
      alert(`Cleaned up ${data.cleaned || 0} cached source files.`);
    } catch (e) {
      alert("Failed to cleanup downloads: " + e.message);
    } finally {
      btnPurgeDownloads.disabled = false;
      btnPurgeDownloads.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> <span>Clean Source Cache</span>`;
    }
  });
}

// Slider badge listeners
const titleFontSizeInput = document.getElementById("title-font-size");
const titleFontSizeVal = document.getElementById("title-font-size-val");
if (titleFontSizeInput) {
  titleFontSizeInput.addEventListener("input", () => {
    if (titleFontSizeVal) titleFontSizeVal.textContent = `${titleFontSizeInput.value}px`;
    updateLivePreview();
    saveFormState();
  });
}

const itemFontSizeInput = document.getElementById("item-font-size");
const itemFontSizeVal = document.getElementById("item-font-size-val");
if (itemFontSizeInput) {
  itemFontSizeInput.addEventListener("input", () => {
    if (itemFontSizeVal) itemFontSizeVal.textContent = `${itemFontSizeInput.value}px`;
    updateLivePreview();
    saveFormState();
  });
}

const uiTogglesAndSelects = [
  "title-bg-style", "item-bg-style", 
  "title-shadow-toggle", "item-shadow-toggle"
];
uiTogglesAndSelects.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", () => {
      updateLivePreview();
      saveFormState();
    });
  }
});

document.querySelectorAll('input[name="item-label-pos"]').forEach(r => {
  r.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
});

// ============================================================================
// Clip Deck Defaults Panel
// ============================================================================
const defaultClipVolInput = document.getElementById("default-clip-volume");
const defaultClipVolVal = document.getElementById("default-clip-volume-val");
if (defaultClipVolInput && defaultClipVolVal) {
  defaultClipVolInput.addEventListener("input", () => {
    defaultClipVolVal.textContent = `${Math.round(parseFloat(defaultClipVolInput.value) * 100)}%`;
    saveFormState();
  });
}

const transitionDurInput = document.getElementById("transition-duration");
const transitionDurVal = document.getElementById("transition-duration-val");
if (transitionDurInput && transitionDurVal) {
  transitionDurInput.addEventListener("input", () => {
    transitionDurVal.textContent = `${parseFloat(transitionDurInput.value).toFixed(2)}s`;
    saveFormState();
  });
}

const transitionStyleSelect = document.getElementById("transition-style");
if (transitionStyleSelect) {
  transitionStyleSelect.addEventListener("change", saveFormState);
}

["default-clip-start", "default-clip-end"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", saveFormState);
});

["global-show-clip-name", "global-show-rank-number", "global-autoplay-preview"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", () => {
    saveFormState();
    updateLivePreview();
  });
});

/** Returns current deck defaults for use when creating a new item row */
function getDeckDefaults() {
  return {
    start: parseFloat(document.getElementById("default-clip-start")?.value || "0"),
    end: parseFloat(document.getElementById("default-clip-end")?.value || "8"),
    volume: parseFloat(document.getElementById("default-clip-volume")?.value || "1.0"),
  };
}

// ============================================================================
// Timed Overlay Elements (Text, Image, Stickers, Emojis & Vecteezy Stock)
// ============================================================================
// overlayElements is declared at top of file

const BUILTIN_STICKERS = [
  { emoji: "🔥", label: "Fire" },
  { emoji: "💯", label: "100" },
  { emoji: "🏆", label: "Trophy" },
  { emoji: "🐐", label: "GOAT" },
  { emoji: "👑", label: "Crown" },
  { emoji: "😱", label: "Shocked" },
  { emoji: "💀", label: "Skull" },
  { emoji: "⭐", label: "Star" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "🚨", label: "Alert" },
  { emoji: "⚽", label: "Goal" },
  { emoji: "💥", label: "Boom" },
  { emoji: "🎯", label: "Bullseye" },
  { emoji: "😂", label: "Laughing" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "🥶", label: "Cold/Ice" },
  { emoji: "🍿", label: "Popcorn" },
  { emoji: "⚡", label: "Lightning" },
  { emoji: "🥇", label: "1st Place" },
  { emoji: "🥊", label: "Knockout" },
  { emoji: "👀", label: "Eyes" },
  { emoji: "🤯", label: "Mind Blown" },
  { emoji: "🤫", label: "Shhh" },
];

function renderElementsList() {
  const container = document.getElementById("elements-list-container");
  if (!container) return;

  if (!overlayElements.length) {
    container.innerHTML = `
      <div id="elements-empty-state" class="elements-empty-state">
        No timed elements yet. Click <strong>+ Text</strong> or <strong>+ Sticker / Stock</strong> to add timed graphics from one timepoint to another.
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  const items = getItemsData();

  overlayElements.forEach((elem, idx) => {
    const card = document.createElement("div");
    card.className = "element-deck-card";
    card.dataset.elemId = elem.id;

    // Target options
    let targetOptions = `<option value="clip" ${elem.target === 'clip' && elem.clip_index == null ? 'selected' : ''}>Active Clip</option>`;
    targetOptions += `<option value="intro" ${elem.target === 'intro' ? 'selected' : ''}>Intro Screen</option>`;
    targetOptions += `<option value="global" ${elem.target === 'global' ? 'selected' : ''}>Global Timeline</option>`;
    items.forEach((it, i) => {
      const isSel = elem.target === 'clip' && elem.clip_index === i;
      targetOptions += `<option value="clip_${i}" ${isSel ? 'selected' : ''}>#${it.rank} ${it.title ? it.title.substring(0, 14) : 'Item'}</option>`;
    });

    let previewBadgeHtml = "";
    if (elem.type === "image" || elem.type === "sticker") {
      previewBadgeHtml = `<img src="${escapeHtml(elem.content)}" alt="sticker">`;
    } else if (elem.type === "emoji") {
      previewBadgeHtml = `<span>${escapeHtml(elem.content)}</span>`;
    } else {
      previewBadgeHtml = `<span style="font-weight: 800; font-family: var(--font-mono); color: ${elem.color || '#38bdf8'};">T</span>`;
    }

    card.innerHTML = `
      <div class="element-card-top-row">
        <div class="element-card-lead">
          <div class="element-preview-badge">${previewBadgeHtml}</div>
          <input type="text" class="element-card-title-input" value="${escapeHtml(elem.content)}" title="Content / Text" placeholder="Text or Image URL">
        </div>
        <select class="element-card-target-select" title="Target Segment">
          ${targetOptions}
        </select>
        <button type="button" class="btn-ghost-sm btn-elem-delete" style="color: #ff6b6b; padding: 2px 6px;" title="Delete Element">&times;</button>
      </div>

      <div class="element-card-time-row">
        <div class="element-time-field" title="Start Time (seconds)">
          <span>Start:</span>
          <input type="number" class="elem-start-input" step="0.1" min="0" value="${elem.start_time !== undefined ? elem.start_time : 0.5}">
        </div>
        <div class="element-time-field" title="End Time (seconds)">
          <span>End:</span>
          <input type="number" class="elem-end-input" step="0.1" min="0.1" value="${elem.end_time !== undefined ? elem.end_time : 3.5}">
        </div>
        <div class="element-time-field" title="Scale / Size">
          <span>Scale:</span>
          <input type="number" class="elem-scale-input" step="0.1" min="0.2" max="5.0" value="${elem.scale !== undefined ? elem.scale : 1.0}">
        </div>
        <button type="button" class="btn-ghost-sm btn-elem-preview-jump" style="font-size: 10px; padding: 2px 6px;" title="Preview this element at its start time">
          ▶ View
        </button>
      </div>

      <div class="element-controls-expander">
        <div class="element-time-field" title="Horizontal Position X%">
          <span>X%:</span>
          <input type="number" class="elem-posx-input" min="0" max="100" value="${elem.pos_x !== undefined ? elem.pos_x : 50}">
        </div>
        <div class="element-time-field" title="Vertical Position Y%">
          <span>Y%:</span>
          <input type="number" class="elem-posy-input" min="0" max="100" value="${elem.pos_y !== undefined ? elem.pos_y : 50}">
        </div>
        ${elem.type === 'text' ? `
        <div class="element-time-field" title="Text Color">
          <span>Color:</span>
          <input type="color" class="elem-color-input" value="${elem.color || '#ffffff'}" style="padding: 0; height: 22px; cursor: pointer;">
        </div>` : ''}
      </div>
    `;

    // Event listeners
    const contentInput = card.querySelector(".element-card-title-input");
    contentInput?.addEventListener("input", () => {
      elem.content = contentInput.value;
      saveFormState();
      updateLivePreview();
    });

    const targetSelect = card.querySelector(".element-card-target-select");
    targetSelect?.addEventListener("change", () => {
      const val = targetSelect.value;
      if (val === "intro") {
        elem.target = "intro";
        elem.clip_index = null;
      } else if (val === "global") {
        elem.target = "global";
        elem.clip_index = null;
      } else if (val.startsWith("clip_")) {
        elem.target = "clip";
        elem.clip_index = parseInt(val.replace("clip_", ""), 10);
      } else {
        elem.target = "clip";
        elem.clip_index = null;
      }
      saveFormState();
      updateLivePreview();
    });

    const startInput = card.querySelector(".elem-start-input");
    startInput?.addEventListener("input", () => {
      elem.start_time = parseFloat(startInput.value) || 0;
      saveFormState();
      updateLivePreview();
    });

    const endInput = card.querySelector(".elem-end-input");
    endInput?.addEventListener("input", () => {
      elem.end_time = parseFloat(endInput.value) || 1;
      saveFormState();
      updateLivePreview();
    });

    const scaleInput = card.querySelector(".elem-scale-input");
    scaleInput?.addEventListener("input", () => {
      elem.scale = parseFloat(scaleInput.value) || 1.0;
      saveFormState();
      updateLivePreview();
    });

    const posXInput = card.querySelector(".elem-posx-input");
    posXInput?.addEventListener("input", () => {
      elem.pos_x = parseFloat(posXInput.value) || 50;
      saveFormState();
      updateLivePreview();
    });

    const posYInput = card.querySelector(".elem-posy-input");
    posYInput?.addEventListener("input", () => {
      elem.pos_y = parseFloat(posYInput.value) || 50;
      saveFormState();
      updateLivePreview();
    });

    const colorInput = card.querySelector(".elem-color-input");
    colorInput?.addEventListener("input", () => {
      elem.color = colorInput.value;
      saveFormState();
      updateLivePreview();
    });

    const btnDelete = card.querySelector(".btn-elem-delete");
    btnDelete?.addEventListener("click", () => {
      overlayElements.splice(idx, 1);
      renderElementsList();
      saveFormState();
      updateLivePreview();
    });

    const btnJump = card.querySelector(".btn-elem-preview-jump");
    btnJump?.addEventListener("click", () => {
      if (timelinePlayer) {
        if (elem.target === "intro") {
          timelinePlayer.seekTo(elem.start_time);
        } else if (elem.target === "clip" && elem.clip_index !== null) {
          const segs = timelinePlayer.segments || [];
          const itSeg = segs.find(s => s.type === "item" && s.itemIndex === elem.clip_index);
          if (itSeg) {
            timelinePlayer.seekTo(itSeg.start + elem.start_time);
          } else {
            timelinePlayer.seekTo(elem.start_time);
          }
        } else {
          timelinePlayer.seekTo(elem.start_time);
        }
      }
    });

    container.appendChild(card);
  });
}

function renderPreviewElements(currentTime, activeSegment) {
  const container = document.getElementById("preview-elements-container");
  if (!container) return;

  if (!overlayElements.length) {
    container.innerHTML = "";
    return;
  }

  const activeNodes = [];
  const currentSegType = activeSegment ? activeSegment.type : "item";
  const currentItemIdx = activeSegment && activeSegment.itemIndex !== undefined ? activeSegment.itemIndex : 0;
  const segStart = activeSegment && activeSegment.start !== undefined ? activeSegment.start : 0;
  const segOffset = Math.max(0, currentTime - segStart);

  overlayElements.forEach(elem => {
    let isActive = false;
    let t = segOffset;

    if (elem.target === "intro") {
      if (currentSegType === "intro") {
        isActive = t >= elem.start_time && t <= elem.end_time;
      }
    } else if (elem.target === "clip") {
      if (currentSegType === "item") {
        if (elem.clip_index == null || elem.clip_index === currentItemIdx) {
          isActive = t >= elem.start_time && t <= elem.end_time;
        }
      }
    } else if (elem.target === "global") {
      isActive = currentTime >= elem.start_time && currentTime <= elem.end_time;
    }

    if (!isActive) return;

    const posX = elem.pos_x !== undefined ? elem.pos_x : 50;
    const posY = elem.pos_y !== undefined ? elem.pos_y : 50;
    const scale = elem.scale !== undefined ? elem.scale : 1.0;

    let contentHtml = "";
    if (elem.type === "text") {
      const fontSz = Math.round((elem.font_size || 42) * (scale * 0.45));
      const bgBoxStyle = elem.bg_color ? `background: ${elem.bg_color}; padding: 4px 10px;` : "";
      contentHtml = `<div class="preview-element-text" style="font-size: ${fontSz}px; color: ${elem.color || '#ffffff'}; ${bgBoxStyle}">${escapeHtml(elem.content)}</div>`;
    } else if (elem.type === "image" || elem.type === "sticker") {
      const widthPx = Math.round(80 * scale);
      contentHtml = `<img src="${escapeHtml(elem.content)}" class="preview-element-img" style="width: ${widthPx}px;" alt="element">`;
    } else {
      // Emoji
      const emojiSz = Math.round(44 * scale);
      contentHtml = `<div style="font-size: ${emojiSz}px; line-height: 1; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.8));">${escapeHtml(elem.content)}</div>`;
    }

    activeNodes.push(`
      <div class="preview-element-item" style="left: ${posX}%; top: ${posY}%;">
        ${contentHtml}
      </div>
    `);
  });

  container.innerHTML = activeNodes.join("");
}

function initElementsModal() {
  const modal = document.getElementById("modal-elements");
  const btnClose = document.getElementById("btn-close-elements-modal");
  const btnAddSticker = document.getElementById("btn-add-element-sticker");
  const btnAddText = document.getElementById("btn-add-element-text");
  const btnAddUpload = document.getElementById("btn-add-element-upload");
  const fileUpload = document.getElementById("file-element-upload");

  const tabBtnBuiltin = document.getElementById("tab-btn-builtin");
  const tabBtnVecteezy = document.getElementById("tab-btn-vecteezy");
  const tabBtnCustom = document.getElementById("tab-btn-custom");

  const tabContentBuiltin = document.getElementById("tab-content-builtin");
  const tabContentVecteezy = document.getElementById("tab-content-vecteezy");
  const tabContentCustom = document.getElementById("tab-content-custom");

  const builtinGrid = document.getElementById("builtin-sticker-grid");

  // Populate built-in emoji stickers
  if (builtinGrid) {
    builtinGrid.innerHTML = "";

    // Section heading: emojis
    const emojiHeading = document.createElement("div");
    emojiHeading.style.cssText = "font-size:11px;font-weight:600;color:var(--color-subtext);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;grid-column:1/-1;";
    emojiHeading.textContent = "Quick Emojis";
    builtinGrid.appendChild(emojiHeading);

    BUILTIN_STICKERS.forEach(s => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sticker-item-btn";
      btn.innerHTML = `
        <span class="sticker-item-emoji">${s.emoji}</span>
        <span class="sticker-item-label">${s.label}</span>
      `;
      btn.addEventListener("click", () => {
        const currentItemIdx = previewItemSelect ? parseInt(previewItemSelect.value, 10) || 0 : 0;
        overlayElements.push({
          id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: "emoji",
          content: s.emoji,
          target: "clip",
          clip_index: currentItemIdx,
          start_time: 0.5,
          end_time: 3.5,
          pos_x: 50,
          pos_y: 50,
          scale: 1.0,
        });
        renderElementsList();
        saveFormState();
        updateLivePreview();
        if (modal) modal.style.display = "none";
      });
      builtinGrid.appendChild(btn);
    });

    // Load pre-downloaded Vecteezy stickers from backend
    fetch("/api/elements/list").then(r => r.json()).then(data => {
      const items = data.items || [];
      if (!items.length) return;
      const imgHeading = document.createElement("div");
      imgHeading.style.cssText = "font-size:11px;font-weight:600;color:var(--color-subtext);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px;grid-column:1/-1;";
      imgHeading.textContent = "🌟 Downloaded Stickers (License-Free)";
      builtinGrid.appendChild(imgHeading);

      items.forEach(item => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sticker-item-btn";
        btn.style.cssText = "flex-direction:column; width:72px; height:72px; padding:4px;";
        btn.innerHTML = `
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" style="width:48px;height:48px;object-fit:contain;border-radius:6px;">
          <span class="sticker-item-label" style="font-size:9px;margin-top:2px;">${escapeHtml(item.label)}</span>
        `;
        btn.addEventListener("click", () => {
          const currentItemIdx = previewItemSelect ? parseInt(previewItemSelect.value, 10) || 0 : 0;
          overlayElements.push({
            id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            type: "image",
            content: item.url,
            target: "clip",
            clip_index: currentItemIdx,
            start_time: 0.5,
            end_time: 3.5,
            pos_x: 50,
            pos_y: 50,
            scale: 1.0,
          });
          renderElementsList();
          saveFormState();
          updateLivePreview();
          if (modal) modal.style.display = "none";
        });
        builtinGrid.appendChild(btn);
      });
    }).catch(() => {}); // silently fail if API unavailable
  }

  // Tab switching
  const switchTab = (tab) => {
    [tabBtnBuiltin, tabBtnVecteezy, tabBtnCustom].forEach(b => b?.classList.remove("active"));
    [tabContentBuiltin, tabContentVecteezy, tabContentCustom].forEach(c => {
      if (c) c.style.display = "none";
    });
    if (tab === "builtin") {
      tabBtnBuiltin?.classList.add("active");
      if (tabContentBuiltin) tabContentBuiltin.style.display = "block";
    } else if (tab === "vecteezy") {
      tabBtnVecteezy?.classList.add("active");
      if (tabContentVecteezy) tabContentVecteezy.style.display = "block";
      const vGrid = document.getElementById("vecteezy-results-grid");
      if (vGrid && !vGrid.children.length) {
        runVecteezySearch();
      }
    } else if (tab === "custom") {
      tabBtnCustom?.classList.add("active");
      if (tabContentCustom) tabContentCustom.style.display = "block";
    }
  };

  tabBtnBuiltin?.addEventListener("click", () => switchTab("builtin"));
  tabBtnVecteezy?.addEventListener("click", () => switchTab("vecteezy"));
  tabBtnCustom?.addEventListener("click", () => switchTab("custom"));

  btnAddSticker?.addEventListener("click", () => {
    if (modal) modal.style.display = "flex";
    switchTab("builtin");
  });

  btnClose?.addEventListener("click", () => {
    if (modal) modal.style.display = "none";
  });

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  // + Text button
  btnAddText?.addEventListener("click", () => {
    const currentItemIdx = previewItemSelect ? parseInt(previewItemSelect.value, 10) || 0 : 0;
    overlayElements.push({
      id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: "text",
      content: "AMAZING SAVE!",
      target: "clip",
      clip_index: currentItemIdx,
      start_time: 0.5,
      end_time: 3.5,
      pos_x: 50,
      pos_y: 30,
      scale: 1.0,
      font_size: 44,
      color: "#ffffff",
      bg_color: "rgba(0,0,0,0.65)",
    });
    renderElementsList();
    saveFormState();
    updateLivePreview();
  });

  // Upload PNG button
  btnAddUpload?.addEventListener("click", () => {
    fileUpload?.click();
  });

  fileUpload?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload-element", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        const currentItemIdx = previewItemSelect ? parseInt(previewItemSelect.value, 10) || 0 : 0;
        overlayElements.push({
          id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: "image",
          content: data.url,
          target: "clip",
          clip_index: currentItemIdx,
          start_time: 0.5,
          end_time: 3.5,
          pos_x: 50,
          pos_y: 50,
          scale: 1.0,
        });
        renderElementsList();
        saveFormState();
        updateLivePreview();
      }
    } catch (err) {
      alert("Failed to upload image element: " + err.message);
    }
  });

  // Custom URL button
  const btnCustomUrl = document.getElementById("btn-add-custom-url-element");
  btnCustomUrl?.addEventListener("click", () => {
    const urlInput = document.getElementById("custom-element-url");
    const urlVal = (urlInput?.value || "").trim();
    if (!urlVal) return;
    const currentItemIdx = previewItemSelect ? parseInt(previewItemSelect.value, 10) || 0 : 0;
    overlayElements.push({
      id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: "image",
      content: urlVal,
      target: "clip",
      clip_index: currentItemIdx,
      start_time: 0.5,
      end_time: 3.5,
      pos_x: 50,
      pos_y: 50,
      scale: 1.0,
    });
    if (urlInput) urlInput.value = "";
    renderElementsList();
    saveFormState();
    updateLivePreview();
    if (modal) modal.style.display = "none";
  });

  // Credentials drawer toggle
  const btnToggleCreds = document.getElementById("btn-toggle-vecteezy-creds");
  const credsDrawer = document.getElementById("vecteezy-creds-drawer");
  btnToggleCreds?.addEventListener("click", () => {
    if (credsDrawer) {
      credsDrawer.style.display = credsDrawer.style.display === "none" ? "block" : "none";
    }
  });

  // Vecteezy search button & enter key
  const btnSearchVecteezy = document.getElementById("btn-run-vecteezy-search");
  const queryInput = document.getElementById("vecteezy-search-query");
  btnSearchVecteezy?.addEventListener("click", () => runVecteezySearch());
  queryInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runVecteezySearch();
    }
  });
}

async function runVecteezySearch() {
  const queryInput = document.getElementById("vecteezy-search-query");
  const typeSelect = document.getElementById("vecteezy-content-type");
  const accInput = document.getElementById("vecteezy-account-id-input");
  const keyInput = document.getElementById("vecteezy-api-key-input");
  const resultsGrid = document.getElementById("vecteezy-results-grid");
  const statusEl = document.getElementById("vecteezy-results-status");

  const term = (queryInput?.value || "fire").trim();
  const cType = typeSelect?.value || "png";
  const accId = (accInput?.value || "").trim();
  const apiKey = (keyInput?.value || "").trim();

  if (statusEl) statusEl.textContent = `Searching Vecteezy for "${term}" (${cType})...`;
  if (resultsGrid) resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #888;">Loading Vecteezy assets...</div>';

  try {
    const url = `/api/vecteezy/search?term=${encodeURIComponent(term)}&content_type=${cType}&account_id=${encodeURIComponent(accId)}&api_key=${encodeURIComponent(apiKey)}&per_page=24`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const resources = data.resources || [];
    if (statusEl) statusEl.textContent = `Found ${data.total_resources || resources.length} resources on Vecteezy:`;

    if (!resources.length) {
      if (resultsGrid) resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #888;">No resources found for this search term. Try "fire", "trophy", "star", or "arrow".</div>';
      return;
    }

    if (resultsGrid) {
      resultsGrid.innerHTML = "";
      resources.forEach(r => {
        const card = document.createElement("div");
        card.className = "vecteezy-card";
        const thumbUrl = r.thumbnail_url || r.preview_url || "";
        card.innerHTML = `
          <div class="vecteezy-card-thumb-box">
            <img src="${escapeHtml(thumbUrl)}" loading="lazy" alt="asset">
          </div>
          <div class="vecteezy-card-body">
            <div class="vecteezy-card-title" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</div>
            <button type="button" class="btn-ghost-sm btn-download-asset" style="font-size: 10px; padding: 3px 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);">
              + Add to Video
            </button>
          </div>
        `;

        const btnAdd = card.querySelector(".btn-download-asset");
        btnAdd?.addEventListener("click", async () => {
          btnAdd.disabled = true;
          btnAdd.textContent = "Downloading...";
          try {
            const dlRes = await fetch("/api/vecteezy/download", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resource_id: r.id, account_id: accId, api_key: apiKey }),
            });
            if (!dlRes.ok) {
              const err = await dlRes.json();
              throw new Error(err.detail || `Download error ${dlRes.status}`);
            }
            const dlData = await dlRes.json();
            const currentItemIdx = previewItemSelect ? parseInt(previewItemSelect.value, 10) || 0 : 0;
            overlayElements.push({
              id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              type: "image",
              content: dlData.url || thumbUrl,
              target: "clip",
              clip_index: currentItemIdx,
              start_time: 0.5,
              end_time: 3.5,
              pos_x: 50,
              pos_y: 50,
              scale: 1.0,
            });
            renderElementsList();
            saveFormState();
            updateLivePreview();
            const modal = document.getElementById("modal-elements");
            if (modal) modal.style.display = "none";
          } catch (err) {
            alert("Failed to download Vecteezy resource: " + err.message);
            btnAdd.disabled = false;
            btnAdd.textContent = "+ Add to Video";
          }
        });

        resultsGrid.appendChild(card);
      });
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
    if (resultsGrid) resultsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #ff6b6b;">${escapeHtml(err.message)}</div>`;
  }
}

// Initialize Elements Module
initElementsModal();
renderElementsList();

// ─── Auto-load Vecteezy credentials from backend config + localStorage ────
(async function loadVecteezyCredentials() {
  const accInput = document.getElementById("vecteezy-account-id-input");
  const keyInput = document.getElementById("vecteezy-api-key-input");
  if (!accInput || !keyInput) return;

  // Restore from localStorage first (user's previously entered values take priority)
  const savedAcc = localStorage.getItem("vecteezy_account_id");
  const savedKey = localStorage.getItem("vecteezy_api_key");
  if (savedAcc) accInput.value = savedAcc;
  if (savedKey) keyInput.value = savedKey;

  // If still blank, fetch from server .env
  if (!accInput.value || !keyInput.value) {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.vecteezy_account_id && !accInput.value) {
          accInput.value = cfg.vecteezy_account_id;
          localStorage.setItem("vecteezy_account_id", cfg.vecteezy_account_id);
        }
        if (cfg.vecteezy_api_key && !keyInput.value) {
          keyInput.value = cfg.vecteezy_api_key;
          localStorage.setItem("vecteezy_api_key", cfg.vecteezy_api_key);
        }
      }
    } catch (_) { /* server unavailable, ignore */ }
  }

  // Save to localStorage whenever user edits them
  accInput.addEventListener("change", () => localStorage.setItem("vecteezy_account_id", accInput.value));
  keyInput.addEventListener("change", () => localStorage.setItem("vecteezy_api_key", keyInput.value));
})();

// Expose on window for automated test suite
window.addItem = addItem;
window.getItemsData = getItemsData;
window.recalcRanks = recalcRanks;
window.shuffleItems = shuffleItems;
window.getFormConfig = getFormConfig;
window.startJob = startJob;
window.pollJob = pollJob;
window.cancelCurrentJob = cancelCurrentJob;
window.saveFormState = saveFormState;
window.loadFormState = loadFormState;
window.getTitleWordsData = getTitleWordsData;
window.renderWordColorChips = renderWordColorChips;
window.updateLivePreview = updateLivePreview;
window.fitPreviewToStage = fitPreviewToStage;
window.timelinePlayer = timelinePlayer;
window.preDownloadSource = preDownloadSource;
window.loadRecentVideos = loadRecentVideos;
window.parseBulkRankings = parseBulkRankings;
window.processBulkAdd = processBulkAdd;
window.randomizeItemPlacements = randomizeItemPlacements;
window.randomizeWithFinale = randomizeWithFinale;
window.renderPreviewRankLadder = renderPreviewRankLadder;
window.getLiveColorGradingFilter = getLiveColorGradingFilter;
window.setPreviewMute = setPreviewMute;
window.updateAllItemStatuses = updateAllItemStatuses;
window.updateItemRowStatus = updateItemRowStatus;
window.overlayElements = overlayElements;
window.renderElementsList = renderElementsList;
window.renderPreviewElements = renderPreviewElements;
window.runVecteezySearch = runVecteezySearch;



