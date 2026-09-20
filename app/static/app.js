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
}

function addItem(title = "", source = "", start = 0, end = 8) {
  const row = createItemRow(1, title, source, start, end);
  itemsContainer.appendChild(row);
  recalcRanks();
}

function getItemsData() {
  const rows = itemsContainer.querySelectorAll(".item-row");
  const items = [];
  rows.forEach(row => {
    const rank = parseInt(row.querySelector(".item-rank").value, 10) || 0;
    const title = row.querySelector(".item-title").value.trim();
    const source = row.querySelector(".item-source").value.trim();
    const start = parseFloat(row.querySelector(".item-start").value) || 0;
    const endVal = row.querySelector(".item-end").value.trim();
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

if (btnAddItem) {
  btnAddItem.addEventListener("click", () => {
    addItem();
  });
}

// Default initial items
if (itemsContainer && itemsContainer.children.length === 0) {
  addItem("Clip 2", "", 0, 8);
  addItem("Clip 1", "", 0, 8);
}

// Expose on window for testing
window.addItem = addItem;
window.getItemsData = getItemsData;
window.recalcRanks = recalcRanks;
window.getFormConfig = getFormConfig;

