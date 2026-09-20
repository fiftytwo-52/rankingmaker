// Minimal frontend JavaScript for Ranking Video Maker

const itemsContainer = document.getElementById("items-container");
const btnAddItem = document.getElementById("btn-add-item");

function createItemRow(rank = 1, title = "", source = "", start = 0, end = 8) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.style = "border-bottom: 1px dashed #ccc; padding: 10px 0; display: flex; flex-direction: column; gap: 8px;";

  row.innerHTML = `
    <div style="display: flex; gap: 10px; align-items: center;">
      <label style="width: 100px;">Rank: <input type="number" class="item-rank" value="${rank}" style="width: 50px;"></label>
      <input type="text" class="item-title" placeholder="Item Title" value="${title}" style="flex: 1;">
      <button type="button" class="btn-remove-item" style="color: #c00;">Remove</button>
    </div>
    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
      <input type="text" class="item-source" placeholder="Video URL or Uploaded ID" value="${source}" style="flex: 2; min-width: 200px;">
      <input type="file" class="item-file-input" style="display: none;" accept="video/*">
      <button type="button" class="btn-upload-clip">Upload Clip</button>
      <label>Start (s): <input type="number" class="item-start" value="${start}" step="0.5" style="width: 60px;"></label>
      <label>End (s): <input type="number" class="item-end" value="${end}" step="0.5" style="width: 60px;"></label>
    </div>
  `;

  // Wire remove button
  row.querySelector(".btn-remove-item").addEventListener("click", () => {
    row.remove();
    recalcRanks();
    saveFormState();
  });

  // Wire clip upload
  const fileInput = row.querySelector(".item-file-input");
  const uploadBtn = row.querySelector(".btn-upload-clip");
  const sourceInput = row.querySelector(".item-source");

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
      sourceInput.value = data.id;
      uploadBtn.textContent = "Uploaded!";
      saveFormState();
      setTimeout(() => { uploadBtn.textContent = "Upload Clip"; }, 2000);
    } catch (e) {
      alert("Error uploading clip: " + e.message);
      uploadBtn.textContent = "Upload Clip";
    }
  });

  return row;
}

function recalcRanks() {
  const rows = itemsContainer.querySelectorAll(".item-row");
  const total = rows.length;
  rows.forEach((row, index) => {
    const rankInput = row.querySelector(".item-rank");
    if (rankInput) {
      rankInput.value = total - index; // descending N, N-1, ... 1
    }
  });
  if (typeof updateLivePreview === "function") updateLivePreview();
}

function addItem(title = "", source = "", start = 0, end = 8) {
  const row = createItemRow(1, title, source, start, end);
  itemsContainer.appendChild(row);
  recalcRanks();
}

function getItemsData() {
  const rows = itemsContainer ? itemsContainer.querySelectorAll(".item-row") : [];
  const items = [];
  rows.forEach(row => {
    const rank = parseInt(row.querySelector(".item-rank")?.value, 10) || 0;
    const title = String(row.querySelector(".item-title")?.value || "").trim();
    const source = String(row.querySelector(".item-source")?.value || "").trim();
    const start = parseFloat(row.querySelector(".item-start")?.value) || 0;
    const endVal = String(row.querySelector(".item-end")?.value || "").trim();
    const end = endVal !== "" ? parseFloat(endVal) : null;
    items.push({ rank, title, source, start, end });
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
      bgImageId.value = data.id;
      bgImageFilename.textContent = data.filename;
      btnUploadBgImage.textContent = "Change Image";
      if (typeof updateLivePreview === "function") updateLivePreview();
      saveFormState();
    } catch (e) {
      alert("Failed to upload background image: " + e.message);
      btnUploadBgImage.textContent = "Choose Background Image";
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
      bgmId.value = data.id;
      bgmFilename.textContent = data.filename;
      btnUploadBgm.textContent = "Change Audio";
      saveFormState();
    } catch (e) {
      alert("Failed to upload music: " + e.message);
      btnUploadBgm.textContent = "Choose Audio Track";
    }
  });
}

function getFormConfig() {
  const [width, height] = (document.getElementById("resolution-preset").value || "1920x1080")
    .split("x")
    .map(n => parseInt(n, 10));

  return {
    title: (document.getElementById("video-title").value || "TOP RANKING").trim(),
    title_words: getTitleWordsData(),
    width: width || 1920,
    height: height || 1080,
    accent: (document.getElementById("accent-color").value || "yellow").trim(),
    bg_color: (document.getElementById("bg-color").value || "0x141414").trim(),
    bg_image: bgImageId && bgImageId.value ? bgImageId.value : null,
    bgm: bgmId && bgmId.value ? bgmId.value : null,
    bgm_volume: parseFloat(document.getElementById("bgm-volume")?.value || 0.25),
    clip_volume: parseFloat(document.getElementById("clip-volume")?.value || 1.0),
    intro_seconds: 3.0,
    clip_seconds: 8.0,
    font: null,
    items: getItemsData(),
  };
}

// Job execution & polling
let currentJobId = null;
let pollTimer = null;

const btnGenerate = document.getElementById("btn-generate");
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
    alert("Please add at least 1 item to generate a video.");
    return;
  }

  // Validate items
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

  // UI state setup
  btnGenerate.disabled = true;
  jobStatusSection.style.display = "block";
  jobStatusBadge.textContent = "QUEUED";
  jobStatusBadge.style.color = "#007bff";
  jobProgressBar.value = 0;
  jobProgressText.textContent = "Submitting job...";
  jobErrorMsg.style.display = "none";
  jobResultSection.style.display = "none";
  videoPreview.pause();
  videoPreview.removeAttribute("src");

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
    jobProgressText.textContent = "Job started. Rendering...";

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => pollJob(currentJobId), 1000);
    pollJob(currentJobId);
  } catch (e) {
    btnGenerate.disabled = false;
    jobStatusBadge.textContent = "FAILED";
    jobStatusBadge.style.color = "#dc3545";
    jobErrorMsg.textContent = e.message;
    jobErrorMsg.style.display = "block";
  }
}

async function pollJob(jobId) {
  try {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return;

    const data = await res.json();
    jobStatusBadge.textContent = data.status.toUpperCase();
    jobProgressBar.value = data.progress || 0;
    jobProgressText.textContent = `[${data.progress}%] ${data.message || ""}`;

    if (data.status === "running") {
      jobStatusBadge.style.color = "#ffc107";
    } else if (data.status === "done") {
      clearInterval(pollTimer);
      btnGenerate.disabled = false;
      jobStatusBadge.style.color = "#28a745";
      jobProgressText.textContent = "Finished! Video ready to preview and download.";

      const downloadUrl = `/api/jobs/${jobId}/download`;
      downloadLink.href = downloadUrl;
      videoPreview.src = downloadUrl;
      jobResultSection.style.display = "block";
    } else if (data.status === "failed") {
      clearInterval(pollTimer);
      btnGenerate.disabled = false;
      jobStatusBadge.style.color = "#dc3545";
      jobErrorMsg.textContent = data.error || data.message || "Unknown error occurred";
      jobErrorMsg.style.display = "block";
    } else if (data.status === "cancelled") {
      clearInterval(pollTimer);
      btnGenerate.disabled = false;
      jobStatusBadge.style.color = "#6c757d";
      jobProgressText.textContent = "Job was cancelled.";
    }
  } catch (e) {
    console.error("Polling error:", e);
  }
}

async function cancelCurrentJob() {
  if (!currentJobId) return;
  btnCancelJob.disabled = true;
  try {
    await fetch(`/api/jobs/${currentJobId}/cancel`, { method: "POST" });
  } finally {
    btnCancelJob.disabled = false;
  }
}

const btnDeleteJob = document.getElementById("btn-delete-job");
if (btnDeleteJob) {
  btnDeleteJob.addEventListener("click", async () => {
    if (!currentJobId) return;
    if (!confirm("Are you sure you want to delete this job and its files?")) return;
    try {
      await fetch(`/api/jobs/${currentJobId}`, { method: "DELETE" });
      jobStatusSection.style.display = "none";
      jobResultSection.style.display = "none";
      videoPreview.pause();
      videoPreview.removeAttribute("src");
      currentJobId = null;
    } catch (e) {
      alert("Failed to delete job: " + e.message);
    }
  });
}

if (btnGenerate) {
  btnGenerate.addEventListener("click", startJob);
}

if (btnAddItem) {
  btnAddItem.addEventListener("click", () => {
    addItem();
    saveFormState();
  });
}

if (btnCancelJob) {
  btnCancelJob.addEventListener("click", cancelCurrentJob);
}

// Color helper
function colorNameToHex(c) {
  const NAMED = {
    white: "#ffffff", black: "#000000", red: "#ff0000",
    green: "#008000", lime: "#00ff00", blue: "#0000ff",
    yellow: "#ffff00", cyan: "#00ffff", magenta: "#ff00ff",
    gold: "#ffd700", orange: "#ffa500", pink: "#ffc0cb",
    purple: "#800080", silver: "#c0c0c0", gray: "#808080"
  };
  const str = String(c || "yellow").trim().toLowerCase();
  if (NAMED[str]) return NAMED[str];
  let hex = str.replace(/^#/, "");
  if (hex.startsWith("0x") || hex.startsWith("0X")) hex = hex.slice(2);
  if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
  if (hex.length === 6) return "#" + hex;
  return "#ffff00";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Word-by-word title colors
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
  const title = videoTitleInput.value.trim();
  const words = title ? title.split(/\s+/).filter(Boolean) : [];

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

  const defaultHex = colorNameToHex(accentColorInput?.value || "yellow");
  titleWordsContainer.innerHTML = "";

  words.forEach(w => {
    const chip = document.createElement("div");
    chip.className = "word-chip";
    chip.dataset.word = w;
    chip.style = "display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; background: #e9ecef; border: 1px solid #ced4da; border-radius: 4px;";

    const colorVal = existingMap.has(w) ? colorNameToHex(existingMap.get(w)) : defaultHex;

    chip.innerHTML = `
      <span style="font-weight: 600; font-size: 13px;">${escapeHtml(w)}</span>
      <input type="color" class="word-color-input" value="${colorVal}" style="width: 26px; height: 22px; padding: 0; border: none; cursor: pointer; border-radius: 2px;">
    `;

    const colorInput = chip.querySelector(".word-color-input");
    colorInput.addEventListener("input", () => {
      updateLivePreview();
      saveFormState();
    });
    colorInput.addEventListener("change", () => {
      updateLivePreview();
      saveFormState();
    });

    titleWordsContainer.appendChild(chip);
  });

  updateLivePreview();
}

if (btnResetWordColors) {
  btnResetWordColors.addEventListener("click", () => {
    const defaultHex = colorNameToHex(accentColorInput?.value || "yellow");
    titleWordsContainer?.querySelectorAll(".word-color-input").forEach(inp => {
      inp.value = defaultHex;
    });
    updateLivePreview();
    saveFormState();
  });
}

// Live preview screen
const previewScreen = document.getElementById("preview-screen");
const previewIntroContent = document.getElementById("preview-intro-content");
const previewItemContent = document.getElementById("preview-item-content");
const previewIntroTitle = document.getElementById("preview-intro-title");
const previewItemTopTitle = document.getElementById("preview-item-top-title");
const previewClipTitle = document.getElementById("preview-clip-title");
const previewClipSource = document.getElementById("preview-clip-source");
const previewItemLabel = document.getElementById("preview-item-label");
const previewItemSelectorWrapper = document.getElementById("preview-item-selector-wrapper");
const previewItemSelect = document.getElementById("preview-item-select");
const resolutionSelect = document.getElementById("resolution-preset");
const bgColorInput = document.getElementById("bg-color");

function updateLivePreview() {
  if (!previewScreen) return;

  const res = resolutionSelect?.value || "1920x1080";
  if (res === "1080x1920") {
    previewScreen.style.aspectRatio = "9 / 16";
    previewScreen.style.maxWidth = "280px";
  } else {
    previewScreen.style.aspectRatio = "16 / 9";
    previewScreen.style.maxWidth = "540px";
  }

  const rawBg = (bgColorInput?.value || "0x141414").trim();
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

  const wordsData = getTitleWordsData();
  const defaultColor = colorNameToHex(accentColorInput?.value || "yellow");
  let titleHtml = "";

  if (wordsData && wordsData.length > 0) {
    titleHtml = wordsData
      .map(w => `<span style="color: ${w.color};">${escapeHtml(w.word)}</span>`)
      .join(" ");
  } else {
    const rawTitle = (videoTitleInput?.value || "TOP RANKING").trim();
    titleHtml = `<span style="color: ${defaultColor};">${escapeHtml(rawTitle)}</span>`;
  }

  const mode = document.querySelector('input[name="preview-mode"]:checked')?.value || "intro";

  if (mode === "intro") {
    if (previewIntroContent) previewIntroContent.style.display = "flex";
    if (previewItemContent) previewItemContent.style.display = "none";
    if (previewItemSelectorWrapper) previewItemSelectorWrapper.style.display = "none";
    if (previewIntroTitle) previewIntroTitle.innerHTML = titleHtml;
  } else {
    if (previewIntroContent) previewIntroContent.style.display = "none";
    if (previewItemContent) previewItemContent.style.display = "block";
    if (previewItemSelectorWrapper) previewItemSelectorWrapper.style.display = "inline-flex";
    if (previewItemTopTitle) previewItemTopTitle.innerHTML = titleHtml;

    const items = getItemsData();
    if (previewItemSelect) {
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

    const selectedIdx = previewItemSelect ? (parseInt(previewItemSelect.value, 10) || 0) : 0;
    const item = items[selectedIdx] || { rank: 1, title: "Item Title", source: "" };

    if (previewClipTitle) {
      previewClipTitle.textContent = item.title ? item.title : "Clip Video Area";
    }
    if (previewClipSource) {
      previewClipSource.textContent = item.source ? item.source : "(80% x 60% box)";
    }
    if (previewItemLabel) {
      previewItemLabel.textContent = `#${item.rank}  ${item.title || "Item Title"}`;
    }
  }
}

// Preview event wiring
document.querySelectorAll('input[name="preview-mode"]').forEach(r => {
  r.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
});

if (previewItemSelect) {
  previewItemSelect.addEventListener("change", updateLivePreview);
}

if (videoTitleInput) {
  videoTitleInput.addEventListener("input", () => {
    renderWordColorChips();
    updateLivePreview();
    saveFormState();
  });
}

if (accentColorInput) {
  accentColorInput.addEventListener("input", () => {
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

if (bgColorInput) {
  bgColorInput.addEventListener("input", () => {
    updateLivePreview();
    saveFormState();
  });
}

const STORAGE_KEY = "ranking_video_form_state";

function saveFormState() {
  try {
    const state = {
      title: document.getElementById("video-title")?.value || "",
      title_words: getTitleWordsData(),
      preview_mode: document.querySelector('input[name="preview-mode"]:checked')?.value || "intro",
      resolution: document.getElementById("resolution-preset")?.value || "1920x1080",
      accent: document.getElementById("accent-color")?.value || "yellow",
      bg_color: document.getElementById("bg-color")?.value || "0x141414",
      bg_image_id: bgImageId?.value || "",
      bg_image_name: bgImageFilename?.textContent || "",
      bgm_id: bgmId?.value || "",
      bgm_name: bgmFilename?.textContent || "",
      bgm_volume: document.getElementById("bgm-volume")?.value || "0.25",
      clip_volume: document.getElementById("clip-volume")?.value || "1.0",
      items: getItemsData(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    if (state.accent && document.getElementById("accent-color")) {
      document.getElementById("accent-color").value = state.accent;
    }
    if (state.bg_color && document.getElementById("bg-color")) {
      document.getElementById("bg-color").value = state.bg_color;
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

    if (Array.isArray(state.items) && state.items.length > 0 && itemsContainer) {
      itemsContainer.innerHTML = "";
      state.items.forEach(it => {
        addItem(it.title || "", it.source || "", it.start || 0, it.end !== null ? it.end : 8);
      });
      // Restore explicit ranks if custom
      const rows = itemsContainer.querySelectorAll(".item-row");
      rows.forEach((row, idx) => {
        if (state.items[idx]?.rank !== undefined) {
          row.querySelector(".item-rank").value = state.items[idx].rank;
        }
      });
    }

    renderWordColorChips(state.title_words || null);
    updateLivePreview();
    return true;
  } catch (e) {
    console.warn("Could not load form state from localStorage:", e);
  }
  return false;
}

// Auto-save on form edits
const videoForm = document.getElementById("video-form");
if (videoForm) {
  videoForm.addEventListener("input", () => {
    updateLivePreview();
    saveFormState();
  });
  videoForm.addEventListener("change", () => {
    updateLivePreview();
    saveFormState();
  });
}

// Initial state load
const loaded = loadFormState();
if (!loaded) {
  if (itemsContainer && itemsContainer.children.length === 0) {
    addItem("Clip 2", "", 0, 8);
    addItem("Clip 1", "", 0, 8);
  }
  renderWordColorChips();
  updateLivePreview();
}

// Expose on window for testing
window.addItem = addItem;
window.getItemsData = getItemsData;
window.recalcRanks = recalcRanks;
window.getFormConfig = getFormConfig;
window.startJob = startJob;
window.pollJob = pollJob;
window.cancelCurrentJob = cancelCurrentJob;
window.saveFormState = saveFormState;
window.loadFormState = loadFormState;
window.getTitleWordsData = getTitleWordsData;
window.renderWordColorChips = renderWordColorChips;
window.updateLivePreview = updateLivePreview;




