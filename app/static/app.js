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
