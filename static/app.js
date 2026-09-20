/**
 * Linux SSD Explorer — Frontend Application Logic
 */

let currentPath = "/";
let currentEntries = [];
let discoveredDisks = [];
let sortColumn = "name";
let sortAsc = true;
let currentPreviewPath = null;

// DOM Elements
const diskSelect = document.getElementById("diskSelect");
const partSelect = document.getElementById("partSelect");
const btnMount = document.getElementById("btnMount");
const btnRescan = document.getElementById("btnRescan");
const btnDemoDisk = document.getElementById("btnDemoDisk");
const permBanner = document.getElementById("permBanner");
const permDesc = document.getElementById("permDesc");
const permCmd = document.getElementById("permCmd");
const btnCopyPerm = document.getElementById("btnCopyPerm");
const btnClosePerm = document.getElementById("btnClosePerm");
const permBadge = document.getElementById("permBadge");
const btnElevateTouchId = document.getElementById("btnElevateTouchId");
const btnOpenFda = document.getElementById("btnOpenFda");

const volName = document.getElementById("volName");
const volUuid = document.getElementById("volUuid");
const usageText = document.getElementById("usageText");
const usageBar = document.getElementById("usageBar");
const blockSize = document.getElementById("blockSize");
const fsStatus = document.getElementById("fsStatus");

const btnNavUp = document.getElementById("btnNavUp");
const btnNavRoot = document.getElementById("btnNavRoot");
const breadcrumbBar = document.getElementById("breadcrumbBar");
const searchInput = document.getElementById("searchInput");
const btnClearSearch = document.getElementById("btnClearSearch");
const chkDeepSearch = document.getElementById("chkDeepSearch");
const chkContentSearch = document.getElementById("chkContentSearch");
const btnDownloadFolderZip = document.getElementById("btnDownloadFolderZip");

const fileTable = document.getElementById("fileTable");
const fileTableBody = document.getElementById("fileTableBody");

const previewModal = document.getElementById("previewModal");
const modalFileName = document.getElementById("modalFileName");
const modalFilePath = document.getElementById("modalFilePath");
const btnModalDownload = document.getElementById("btnModalDownload");
const btnModalClose = document.getElementById("btnModalClose");
const codeView = document.getElementById("codeView");
const hexTableBody = document.getElementById("hexTableBody");
const imagePreview = document.getElementById("imagePreview");
const metaGrid = document.getElementById("metaGrid");
const btnCopyContent = document.getElementById("btnCopyContent");
const textEncodingInfo = document.getElementById("textEncodingInfo");

const inFileSearchBar = document.getElementById("inFileSearchBar");
const inFileSearchInput = document.getElementById("inFileSearchInput");
const inFileMatchCount = document.getElementById("inFileMatchCount");
const btnInFilePrev = document.getElementById("btnInFilePrev");
const btnInFileNext = document.getElementById("btnInFileNext");
const btnInFileCase = document.getElementById("btnInFileCase");
const btnInFileClear = document.getElementById("btnInFileClear");

let rawFileContent = "";
let inFileMatches = [];
let activeInFileMatchIndex = -1;
let inFileCaseSensitive = false;

// Search Progress Panel Elements
const searchProgressPanel = document.getElementById("searchProgressPanel");
const searchProgressTitle = document.getElementById("searchProgressTitle");
const searchProgressSub = document.getElementById("searchProgressSub");
const searchSpinner = document.getElementById("searchSpinner");
const searchSpeedBadge = document.getElementById("searchSpeedBadge");
const searchTimeBadge = document.getElementById("searchTimeBadge");
const btnStopSearch = document.getElementById("btnStopSearch");
const searchProgressBar = document.getElementById("searchProgressBar");
const searchScannedCount = document.getElementById("searchScannedCount");
const searchPercentText = document.getElementById("searchPercentText");
const searchCurrentFile = document.getElementById("searchCurrentFile");
const searchFoundCount = document.getElementById("searchFoundCount");

let searchAbortController = null;
let isSearchActive = false;
let streamResultsCount = 0;

// Icons SVG helper
function getFileIcon(type, name) {
  if (type === "directory") {
    return `<svg class="item-icon icon-dir" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>`;
  }
  if (type === "symlink") {
    return `<svg class="item-icon icon-link" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>`;
  }
  const ext = name.split(".").pop().toLowerCase();
  if (["py", "js", "ts", "json", "sh", "c", "cpp", "h", "html", "css", "yaml", "yml", "xml", "conf"].includes(ext)) {
    return `<svg class="item-icon icon-code" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>`;
  }
  return `<svg class="item-icon icon-file" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <polyline points="13 2 13 9 20 9"/>
  </svg>`;
}

// Format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Fetch permission status
async function loadPermissions() {
  try {
    const res = await fetch("/api/permissions");
    const data = await res.json();
    if (permBadge) {
      if (data.is_root) {
        permBadge.textContent = "⚡ Privileged Mode (Root Active)";
        permBadge.style.background = "rgba(16, 185, 129, 0.2)";
        permBadge.style.color = "#34d399";
        permBadge.style.border = "1px solid rgba(16, 185, 129, 0.4)";
        permBadge.title = "Full hardware access to /dev/disk* block devices enabled.";
        if (permBanner) permBanner.classList.add("hidden");
      } else {
        permBadge.textContent = "🔒 Standard Mode (Click to Elevate)";
        permBadge.style.background = "rgba(245, 158, 11, 0.2)";
        permBadge.style.color = "#fbbf24";
        permBadge.style.border = "1px solid rgba(245, 158, 11, 0.4)";
        permBadge.title = "Click to grant administrator/Touch ID access to physical block devices.";
        permBadge.onclick = () => {
          if (permBanner) permBanner.classList.toggle("hidden");
        };
      }
    }
    return data;
  } catch (e) {
    console.warn("Could not load permissions:", e);
  }
}

// Initialize Application
async function initApp() {
  setupEventListeners();
  await loadPermissions();
  await loadDisks();
  await loadFsStatus();
  await loadDirectory("/");
}

// Setup Event Listeners
function setupEventListeners() {
  diskSelect.addEventListener("change", onDiskChange);
  btnMount.addEventListener("click", onMountClick);
  btnRescan.addEventListener("click", async () => {
    btnRescan.disabled = true;
    await loadDisks();
    await loadPermissions();
    btnRescan.disabled = false;
  });

  if (btnElevateTouchId) {
    btnElevateTouchId.addEventListener("click", async () => {
      btnElevateTouchId.disabled = true;
      btnElevateTouchId.innerText = "Authorizing...";
      try {
        const diskIndex = parseInt(diskSelect.value);
        const disk = (!isNaN(diskIndex) && discoveredDisks[diskIndex]) ? discoveredDisks[diskIndex] : null;
        const targetDev = disk ? disk.device_path : "/dev/disk4";

        const res = await fetch("/api/elevate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_path: targetDev })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Authorization failed");

        permBanner.classList.add("hidden");
        // Reload disks and mount the Linux partition
        await loadDisks();
        await onMountClick();
      } catch (e) {
        alert("Elevation notice: " + e.message);
      } finally {
        btnElevateTouchId.disabled = false;
        btnElevateTouchId.innerText = "⚡ Unlock Hardware Access (Touch ID)";
      }
    });
  }

  if (btnOpenFda) {
    btnOpenFda.addEventListener("click", async () => {
      try {
        await fetch("/api/open-fda", { method: "POST" });
      } catch (e) {
        alert("Error opening Settings: " + e.message);
      }
    });
  }

  btnDemoDisk.addEventListener("click", async () => {
    btnDemoDisk.disabled = true;
    btnDemoDisk.innerText = "Creating...";
    try {
      const res = await fetch("/api/create-sample", { method: "POST" });
      const data = await res.json();
      await loadDisks();
      await loadFsStatus();
      await loadDirectory("/");
    } catch (e) {
      alert("Error creating demo disk: " + e.message);
    } finally {
      btnDemoDisk.disabled = false;
      btnDemoDisk.innerText = "Demo Disk";
    }
  });

  btnCopyPerm.addEventListener("click", () => {
    navigator.clipboard.writeText(permCmd.innerText);
    btnCopyPerm.innerText = "Copied!";
    setTimeout(() => btnCopyPerm.innerText = "Copy", 2000);
  });

  btnClosePerm.addEventListener("click", () => {
    permBanner.classList.add("hidden");
  });

  btnNavUp.addEventListener("click", navigateUp);
  btnNavRoot.addEventListener("click", () => loadDirectory("/"));

  searchInput.addEventListener("input", () => onSearchInput(false));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
      executeSearch();
    }
  });

  btnClearSearch.addEventListener("click", () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    searchInput.value = "";
    btnClearSearch.classList.add("hidden");
    stopSearch("stopped");
    showSearchProgress(false);
    renderTable(currentEntries);
  });

  chkDeepSearch.addEventListener("change", () => onSearchInput(true));

  if (chkContentSearch) {
    chkContentSearch.addEventListener("change", () => {
      if (chkContentSearch.checked) {
        searchInput.placeholder = "Search inside file text contents (grep)...";
      } else {
        searchInput.placeholder = "Filter or search files...";
      }
      onSearchInput();
    });
  }

  if (btnStopSearch) {
    btnStopSearch.addEventListener("click", () => {
      stopSearch("stopped");
    });
  }

  btnDownloadFolderZip.addEventListener("click", () => {
    window.location.href = `/api/download-zip?path=${encodeURIComponent(currentPath)}`;
  });

  // Modal actions
  btnModalClose.addEventListener("click", closeModal);
  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) closeModal();
  });

  btnModalDownload.addEventListener("click", () => {
    if (currentPreviewPath) {
      window.location.href = `/api/download?path=${encodeURIComponent(currentPreviewPath)}`;
    }
  });

  btnCopyContent.addEventListener("click", () => {
    navigator.clipboard.writeText(rawFileContent || codeView.innerText);
    btnCopyContent.innerText = "Copied!";
    setTimeout(() => btnCopyContent.innerText = "Copy Text", 2000);
  });

  // In-File Search Bar Events
  if (inFileSearchInput) {
    inFileSearchInput.addEventListener("input", () => {
      activeInFileMatchIndex = 0;
      performInFileSearch(true);
    });
    inFileSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateInFileMatch(e.shiftKey ? "prev" : "next");
      } else if (e.key === "Escape") {
        inFileSearchInput.value = "";
        performInFileSearch(false);
        inFileSearchInput.blur();
      }
    });
  }

  if (btnInFilePrev) {
    btnInFilePrev.addEventListener("click", () => navigateInFileMatch("prev"));
  }
  if (btnInFileNext) {
    btnInFileNext.addEventListener("click", () => navigateInFileMatch("next"));
  }
  if (btnInFileCase) {
    btnInFileCase.addEventListener("click", () => {
      inFileCaseSensitive = !inFileCaseSensitive;
      btnInFileCase.classList.toggle("active", inFileCaseSensitive);
      performInFileSearch(true);
    });
  }
  if (btnInFileClear) {
    btnInFileClear.addEventListener("click", () => {
      inFileSearchInput.value = "";
      performInFileSearch(false);
    });
  }

  // Keyboard shortcut: Cmd+F or Ctrl+F to trigger find inside file
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      if (!previewModal.classList.contains("hidden")) {
        e.preventDefault();
        const tabBtn = document.getElementById("tabBtnText");
        if (tabBtn) tabBtn.click();
        if (inFileSearchInput) {
          inFileSearchInput.focus();
          inFileSearchInput.select();
        }
      }
    } else if (e.key === "Escape") {
      if (!previewModal.classList.contains("hidden")) {
        closeModal();
      }
    }
  });

  // Modal Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // Table Column Sort
  document.querySelectorAll(".file-table th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortAsc = !sortAsc;
      } else {
        sortColumn = col;
        sortAsc = true;
      }
      sortAndRenderEntries();
    });
  });
}

// Fetch Disks
async function loadDisks() {
  try {
    const res = await fetch("/api/disks");
    const data = await res.json();
    discoveredDisks = data.disks || [];

    diskSelect.innerHTML = "";
    let autoSelectIndex = -1;

    discoveredDisks.forEach((d, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      const tag = d.is_ext4 ? "★ [EXT4] " : "";
      const readable = d.is_readable ? "" : " (Permission Required)";
      opt.textContent = `${tag}${d.identifier} (${formatBytes(d.size)}) ${d.content_type}${readable}`;
      diskSelect.appendChild(opt);

      // Prefer currently active device from backend
      if (data.active_device && (d.device_path === data.active_device || d.identifier === data.active_device)) {
        autoSelectIndex = idx;
      } else if (autoSelectIndex === -1 && d.is_ext4 && d.is_readable) {
        autoSelectIndex = idx;
      }
    });

    if (autoSelectIndex === -1 && discoveredDisks.length > 0) {
      const ext4Idx = discoveredDisks.findIndex(d => d.is_ext4);
      autoSelectIndex = ext4Idx >= 0 ? ext4Idx : 0;
    }

    if (autoSelectIndex >= 0) {
      diskSelect.selectedIndex = autoSelectIndex;
    }
    onDiskChange();
  } catch (e) {
    console.error("Failed to load disks:", e);
  }
}

// When selected disk changes
function onDiskChange() {
  const diskIndex = parseInt(diskSelect.value);
  if (isNaN(diskIndex) || !discoveredDisks[diskIndex]) return;

  const disk = discoveredDisks[diskIndex];
  partSelect.innerHTML = "";

  const partitions = disk.partitions || [];
  if (partitions.length > 0) {
    let ext4Idx = -1;
    partitions.forEach((p, pIdx) => {
      const opt = document.createElement("option");
      opt.value = pIdx;
      const isExt = p.is_ext4 || p.content_type === "Linux Filesystem" || p.is_linux_candidate;
      const pExt = isExt ? "★ [EXT4] " : "";
      const pSize = p.size ? ` (${formatBytes(p.size)})` : "";
      opt.textContent = `${pExt}${p.name}${pSize}`;
      partSelect.appendChild(opt);
      if (ext4Idx === -1 && isExt) {
        ext4Idx = pIdx;
      }
    });
    if (ext4Idx >= 0) {
      partSelect.selectedIndex = ext4Idx;
    }
  } else {
    const opt = document.createElement("option");
    opt.value = -1;
    opt.textContent = "Whole Device / Auto (Offset 0)";
    partSelect.appendChild(opt);
  }

  // If disk is not readable due to permissions, show permission banner
  if (!disk.is_readable && disk.type === "physical") {
    permDesc.textContent = `macOS requires administrator access to read raw block device ${disk.device_path}. Click "Unlock Hardware Access" below or run with sudo.`;
    permCmd.textContent = `sudo chmod o+r /dev/${disk.identifier}* /dev/r${disk.identifier}*`;
    permBanner.classList.remove("hidden");
  } else {
    permBanner.classList.add("hidden");
  }
}

// Mount selected device
async function onMountClick() {
  const diskIndex = parseInt(diskSelect.value);
  if (isNaN(diskIndex) || !discoveredDisks[diskIndex]) return;

  const disk = discoveredDisks[diskIndex];
  const partIdx = parseInt(partSelect.value);
  const partitions = disk.partitions || [];
  const selectedPart = (!isNaN(partIdx) && partIdx >= 0 && partitions[partIdx]) ? partitions[partIdx] : null;

  const targetDevice = selectedPart?.device_path || disk.device_path;
  const targetOffset = selectedPart?.offset || 0;
  const isTargetExt4 = disk.is_ext4 || (selectedPart && (selectedPart.is_ext4 || selectedPart.content_type === "Linux Filesystem" || selectedPart.is_linux_candidate));

  if (!isTargetExt4 && disk.type === "physical") {
    const proceed = confirm(
      `Notice: "${selectedPart?.name || disk.identifier}" does not appear to be an ext2/3/4 Linux filesystem.\n\n` +
      `Opening macOS APFS or non-ext4 drives will fail.\n\n` +
      `Do you still want to attempt mounting it?`
    );
    if (!proceed) return;
  }

  btnMount.disabled = true;
  btnMount.innerText = "Opening...";

  try {
    const res = await fetch("/api/mount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_path: targetDevice, offset: targetOffset })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Failed to mount disk");
    }

    permBanner.classList.add("hidden");
    await loadFsStatus();
    await loadDirectory("/");
  } catch (e) {
    if (e.message.includes("Permission denied") || e.message.includes("403")) {
      permDesc.textContent = `macOS requires administrator access to read ${targetDevice}. Click "Unlock Hardware Access" below to grant read permission with Touch ID.`;
      permCmd.textContent = `sudo chmod o+r /dev/${disk.identifier}* /dev/r${disk.identifier}*`;
      permBanner.classList.remove("hidden");
    } else {
      alert("Mount notice: " + e.message);
    }
  } finally {
    btnMount.disabled = false;
    btnMount.innerText = "Open Disk";
  }
}

// Load demo disk helper
window.mountDemoDisk = async function() {
  const demoDisk = discoveredDisks.find(d => d.identifier.includes("sample_linux_disk"));
  if (demoDisk) {
    const demoIdx = discoveredDisks.indexOf(demoDisk);
    diskSelect.selectedIndex = demoIdx;
    onDiskChange();
    await onMountClick();
  } else {
    btnDemoDisk.click();
  }
};

// Fetch Volume & Superblock Status
async function loadFsStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (data.mounted && data.info) {
      const info = data.info;
      volName.textContent = info.volume_name || "Linux Ext4";
      volUuid.textContent = info.uuid || "—";
      blockSize.textContent = `${info.block_size || 1024} B`;
      usageText.textContent = `${info.used_human || "0 B"} / ${info.total_human || "0 B"}`;
      usageBar.style.width = `${info.percent_used || 0}%`;
      fsStatus.innerHTML = `<span class="status-indicator"></span> ${info.filesystem_state || "Online"}`;
    }
  } catch (e) {
    console.error("Status error:", e);
  }
}

// Load directory contents
async function loadDirectory(path) {
  currentPath = path;
  updateBreadcrumbs(path);
  fileTableBody.innerHTML = `<tr class="empty-row"><td colspan="7">Loading ${path}...</td></tr>`;

  try {
    const res = await fetch(`/api/ls?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Error loading directory");
    }

    currentEntries = data.entries || [];
    renderTable(currentEntries);
  } catch (e) {
    fileTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7" style="padding: 2.5rem 1rem; text-align: center;">
          <div style="color: #ef4444; font-weight: 600; font-size: 1.05rem; margin-bottom: 0.5rem;">
            ⚠️ ${escapeHtml(e.message)}
          </div>
          <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.25rem;">
            The active disk is not an ext2/ext3/ext4 Linux filesystem. Please select an ext4 partition or load the demo image.
          </div>
          <button class="btn btn-primary" onclick="mountDemoDisk()" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 0.5rem;">
            <span>★</span> Load Demo Linux SSD Image
          </button>
        </td>
      </tr>`;
  }
}

// Update Breadcrumbs
function updateBreadcrumbs(path) {
  breadcrumbBar.innerHTML = "";
  const parts = path.split("/").filter(Boolean);

  const rootCrumb = document.createElement("span");
  rootCrumb.className = "crumb" + (parts.length === 0 ? " active" : "");
  rootCrumb.textContent = "/ (root)";
  rootCrumb.addEventListener("click", () => loadDirectory("/"));
  breadcrumbBar.appendChild(rootCrumb);

  let accumulated = "";
  parts.forEach((p, idx) => {
    accumulated += "/" + p;
    const thisPath = accumulated;

    const sep = document.createElement("span");
    sep.className = "crumb-sep";
    sep.textContent = "/";
    breadcrumbBar.appendChild(sep);

    const crumb = document.createElement("span");
    const isLast = idx === parts.length - 1;
    crumb.className = "crumb" + (isLast ? " active" : "");
    crumb.textContent = p;
    if (!isLast) {
      crumb.addEventListener("click", () => loadDirectory(thisPath));
    }
    breadcrumbBar.appendChild(crumb);
  });
}

// Navigate up one directory level
function navigateUp() {
  if (currentPath === "/" || !currentPath) return;
  const parts = currentPath.split("/").filter(Boolean);
  parts.pop();
  const parent = "/" + parts.join("/");
  loadDirectory(parent);
}

// Sort & Render
function sortAndRenderEntries() {
  const query = searchInput.value.trim().toLowerCase();
  let entries = [...currentEntries];

  if (query) {
    entries = entries.filter(e => e.name.toLowerCase().includes(query));
  }

  entries.sort((a, b) => {
    // Folders always first
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (b.type === "directory" && a.type !== "directory") return 1;

    let valA = a[sortColumn];
    let valB = b[sortColumn];

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  renderTable(entries);
}

// Render Table Rows
function renderTable(entries) {
  if (!entries || entries.length === 0) {
    fileTableBody.innerHTML = `<tr class="empty-row"><td colspan="7">No files or directories found.</td></tr>`;
    return;
  }

  fileTableBody.innerHTML = "";
  entries.forEach(item => {
    const tr = document.createElement("tr");
    tr.className = "file-row";

    const nameCell = document.createElement("td");
    nameCell.className = "file-name-cell";
    nameCell.innerHTML = `${getFileIcon(item.type, item.name)} <span>${item.name}${item.target ? ` <span style="color: #a78bfa;">&rarr; ${item.target}</span>` : ""}</span>`;

    const sizeCell = document.createElement("td");
    sizeCell.className = "col-size";
    sizeCell.textContent = item.size_human;

    const modeCell = document.createElement("td");
    modeCell.className = "col-mode";
    modeCell.textContent = item.mode;

    const ownerCell = document.createElement("td");
    ownerCell.className = "col-owner";
    ownerCell.textContent = `${item.uid}:${item.gid}`;

    const inodeCell = document.createElement("td");
    inodeCell.className = "col-inode";
    inodeCell.textContent = item.inode;

    const mtimeCell = document.createElement("td");
    mtimeCell.className = "col-mtime";
    mtimeCell.textContent = item.mtime || "—";

    const actionsCell = document.createElement("td");
    actionsCell.className = "col-actions";
    const actGroup = document.createElement("div");
    actGroup.className = "action-btns";

    if (item.type === "file") {
      const btnPrev = document.createElement("button");
      btnPrev.className = "btn-tbl-action";
      btnPrev.title = "Preview";
      btnPrev.textContent = "View";
      btnPrev.addEventListener("click", (e) => {
        e.stopPropagation();
        openPreview(item.path);
      });
      actGroup.appendChild(btnPrev);

      const btnDl = document.createElement("button");
      btnDl.className = "btn-tbl-action";
      btnDl.title = "Download";
      btnDl.textContent = "Get";
      btnDl.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `/api/download?path=${encodeURIComponent(item.path)}`;
      });
      actGroup.appendChild(btnDl);
    } else if (item.type === "directory") {
      const btnZip = document.createElement("button");
      btnZip.className = "btn-tbl-action";
      btnZip.title = "Download ZIP";
      btnZip.textContent = ".ZIP";
      btnZip.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `/api/download-zip?path=${encodeURIComponent(item.path)}`;
      });
      actGroup.appendChild(btnZip);
    }

    actionsCell.appendChild(actGroup);

    tr.appendChild(nameCell);
    tr.appendChild(sizeCell);
    tr.appendChild(modeCell);
    tr.appendChild(ownerCell);
    tr.appendChild(inodeCell);
    tr.appendChild(mtimeCell);
    tr.appendChild(actionsCell);

    // Row click
    tr.addEventListener("click", () => {
      if (item.type === "directory") {
        loadDirectory(item.path);
      } else if (item.type === "file") {
        openPreview(item.path);
      }
    });

    fileTableBody.appendChild(tr);
  });
}

// Search Progress Functions
function showSearchProgress(show, isGrep = false, query = "") {
  if (!searchProgressPanel) return;
  if (!show) {
    searchProgressPanel.classList.add("hidden");
    isSearchActive = false;
    return;
  }

  isSearchActive = true;
  searchProgressPanel.classList.remove("hidden");
  if (searchSpinner) searchSpinner.classList.remove("hidden");
  if (btnStopSearch) {
    btnStopSearch.disabled = false;
    btnStopSearch.classList.remove("hidden");
  }
  if (searchProgressTitle) {
    searchProgressTitle.textContent = isGrep
      ? `Searching file contents for "${query}"...`
      : `Searching filenames for "${query}"...`;
  }
  if (searchProgressSub) searchProgressSub.textContent = "Scanning files on Linux partition...";
  if (searchProgressBar) {
    searchProgressBar.style.width = "0%";
    searchProgressBar.style.background = "linear-gradient(90deg, #38bdf8, #818cf8, #c084fc)";
  }
  if (searchScannedCount) searchScannedCount.textContent = "0 / 0";
  if (searchPercentText) searchPercentText.textContent = "(0%)";
  if (searchCurrentFile) searchCurrentFile.textContent = "Initializing scan...";
  if (searchFoundCount) searchFoundCount.textContent = "0";
  if (searchSpeedBadge) searchSpeedBadge.textContent = "0 files/s";
  if (searchTimeBadge) searchTimeBadge.textContent = "0.0s";
}

function stopSearch(reason = "stopped") {
  if (searchAbortController) {
    searchAbortController.abort();
    searchAbortController = null;
  }
  isSearchActive = false;
  if (searchSpinner) searchSpinner.classList.add("hidden");
  if (btnStopSearch) btnStopSearch.classList.add("hidden");
  if (searchProgressSub) {
    if (reason === "stopped") {
      searchProgressSub.textContent = `Search stopped. Found ${streamResultsCount} match${streamResultsCount === 1 ? '' : 'es'}.`;
    } else if (reason === "error") {
      searchProgressSub.textContent = "Search encountered an error.";
    }
  }
}

// Streaming Search
let searchDebounceTimer = null;

async function startStreamingSearch(url, isGrep, query) {
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();
  const signal = searchAbortController.signal;

  showSearchProgress(true, isGrep, query);
  streamResultsCount = 0;
  fileTableBody.innerHTML = `<tr class="empty-row"><td colspan="7">Scanning filesystem for "${escapeHtml(query)}"...</td></tr>`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Search error (${response.status})`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              handleSearchEvent(event, isGrep, query);
            } catch (e) {
              console.error("Failed to parse search event", e, line);
            }
          }
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      stopSearch("stopped");
    } else {
      stopSearch("error");
      fileTableBody.innerHTML = `<tr class="empty-row"><td colspan="7" style="color: #ef4444;">Search failed: ${err.message}</td></tr>`;
    }
  }
}

function handleSearchEvent(event, isGrep, query) {
  if (event.type === "start") {
    if (searchCurrentFile) {
      searchCurrentFile.textContent = event.current_file || "Reading directory...";
    }
    if (searchProgressSub) {
      searchProgressSub.textContent = isGrep ? "Scanning file text contents..." : "Scanning filenames...";
    }
    if (event.total) {
      if (searchScannedCount) searchScannedCount.textContent = `0 / ${event.total.toLocaleString()}`;
      if (searchPercentText) searchPercentText.textContent = "(0%)";
    } else {
      if (searchScannedCount) searchScannedCount.textContent = "0 files scanned";
      if (searchPercentText) searchPercentText.textContent = "";
    }
  } else if (event.type === "progress") {
    const total = event.total;
    if (total && total > 0) {
      const pct = Math.min(100, Math.round((event.scanned / total) * 100));
      if (searchProgressBar) searchProgressBar.style.width = `${pct}%`;
      if (searchPercentText) searchPercentText.textContent = `(${pct}%)`;
      if (searchScannedCount) searchScannedCount.textContent = `${event.scanned.toLocaleString()} / ${total.toLocaleString()}`;
    } else {
      if (searchScannedCount) searchScannedCount.textContent = `${event.scanned.toLocaleString()} files`;
      if (searchProgressBar) {
        searchProgressBar.style.width = "100%";
        searchProgressBar.style.background = "linear-gradient(90deg, #38bdf8, #c084fc)";
      }
      if (searchPercentText) searchPercentText.textContent = "";
    }

    if (event.current_file && searchCurrentFile) {
      searchCurrentFile.textContent = event.current_file;
      searchCurrentFile.title = event.current_path || event.current_file;
    }
    if (event.speed && searchSpeedBadge) {
      searchSpeedBadge.textContent = `${event.speed} files/s`;
    }
    if (event.elapsed !== undefined && searchTimeBadge) {
      searchTimeBadge.textContent = `${event.elapsed}s`;
    }
    if (searchFoundCount) {
      searchFoundCount.textContent = `${event.matches_count || streamResultsCount}`;
    }

  } else if (event.type === "match") {
    const match = event.match;
    if (streamResultsCount === 0) {
      fileTableBody.innerHTML = "";
    }
    streamResultsCount++;
    if (searchFoundCount) searchFoundCount.textContent = `${streamResultsCount}`;

    if (isGrep) {
      appendGrepRow(match, query);
    } else {
      appendFileRow(match);
    }

  } else if (event.type === "done") {
    stopSearch("done");
    if (searchProgressBar) {
      searchProgressBar.style.width = "100%";
      searchProgressBar.style.background = "linear-gradient(90deg, #10b981, #06b6d4)";
    }
    if (searchProgressTitle) {
      searchProgressTitle.textContent = `Scan Complete!`;
    }
    if (searchProgressSub) {
      searchProgressSub.textContent = `Scanned ${event.scanned.toLocaleString()} files in ${event.elapsed}s (${event.speed || 0} files/s) • ${event.matches_count} matches found.`;
    }
    if (searchCurrentFile) searchCurrentFile.textContent = "Scan finished.";
    if (searchScannedCount) searchScannedCount.textContent = `${event.scanned.toLocaleString()} / ${(event.total || event.scanned).toLocaleString()}`;
    if (searchPercentText) searchPercentText.textContent = "(100%)";
    if (searchTimeBadge) searchTimeBadge.textContent = `${event.elapsed}s`;
    if (searchFoundCount) searchFoundCount.textContent = `${event.matches_count}`;

    if (streamResultsCount === 0) {
      fileTableBody.innerHTML = `<tr class="empty-row"><td colspan="7">No matching files containing "${escapeHtml(query)}" found.</td></tr>`;
    }
  } else if (event.type === "error") {
    stopSearch("error");
    if (searchProgressSub) searchProgressSub.textContent = `Error: ${event.error}`;
  }
}

function appendGrepRow(item, query) {
  const tr = document.createElement("tr");
  tr.className = "file-row";

  const nameCell = document.createElement("td");
  nameCell.className = "file-name-cell";

  let snippetsHtml = "";
  if (item.matches && item.matches.length > 0) {
    snippetsHtml = `
      <div class="grep-snippets-box">
        ${item.matches.map(m => {
          const escaped = escapeHtml(m.snippet);
          const safeQ = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const highlighted = escaped.replace(new RegExp(safeQ, "gi"), match => `<mark>${match}</mark>`);
          return `<div class="grep-snippet-item" data-path="${escapeHtml(item.path)}" data-query="${escapeHtml(query)}">
            <span class="grep-snippet-num">L${m.line}:</span>
            <span class="grep-snippet-text">${highlighted}</span>
          </div>`;
        }).join("")}
      </div>
    `;
  }

  nameCell.innerHTML = `
    <div>
      <div style="display: flex; align-items: center;">
        ${getFileIcon(item.type, item.name)}
        <span style="font-weight: 500;">${escapeHtml(item.name)}</span>
        <span class="grep-match-badge">${item.match_count} match${item.match_count > 1 ? 'es' : ''}</span>
      </div>
      ${snippetsHtml}
    </div>
  `;

  const sizeCell = document.createElement("td");
  sizeCell.className = "col-size";
  sizeCell.textContent = item.size_human;

  const modeCell = document.createElement("td");
  modeCell.className = "col-mode";
  modeCell.textContent = item.mode || "-rw-r--r--";

  const ownerCell = document.createElement("td");
  ownerCell.className = "col-owner";
  ownerCell.textContent = `${item.uid}:${item.gid}`;

  const inodeCell = document.createElement("td");
  inodeCell.className = "col-inode";
  inodeCell.textContent = item.inode || "—";

  const mtimeCell = document.createElement("td");
  mtimeCell.className = "col-mtime";
  mtimeCell.textContent = item.mtime || "—";

  const actionsCell = document.createElement("td");
  actionsCell.className = "col-actions";
  const actGroup = document.createElement("div");
  actGroup.className = "action-btns";

  const btnPrev = document.createElement("button");
  btnPrev.className = "btn-tbl-action";
  btnPrev.title = "Preview";
  btnPrev.textContent = "View";
  btnPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    openPreview(item.path, query);
  });
  actGroup.appendChild(btnPrev);

  const btnDl = document.createElement("button");
  btnDl.className = "btn-tbl-action";
  btnDl.title = "Download";
  btnDl.textContent = "Get";
  btnDl.addEventListener("click", (e) => {
    e.stopPropagation();
    window.location.href = `/api/download?path=${encodeURIComponent(item.path)}`;
  });
  actGroup.appendChild(btnDl);

  actionsCell.appendChild(actGroup);

  tr.appendChild(nameCell);
  tr.appendChild(sizeCell);
  tr.appendChild(modeCell);
  tr.appendChild(ownerCell);
  tr.appendChild(inodeCell);
  tr.appendChild(mtimeCell);
  tr.appendChild(actionsCell);

  tr.addEventListener("click", () => {
    openPreview(item.path, query);
  });

  fileTableBody.appendChild(tr);
}

function appendFileRow(item) {
  const tr = document.createElement("tr");
  tr.className = "file-row";

  const nameCell = document.createElement("td");
  nameCell.className = "file-name-cell";
  nameCell.innerHTML = `${getFileIcon(item.type, item.name)} <span>${escapeHtml(item.name)}${item.target ? ` <span style="color: #a78bfa;">&rarr; ${escapeHtml(item.target)}</span>` : ""}</span>`;

  const sizeCell = document.createElement("td");
  sizeCell.className = "col-size";
  sizeCell.textContent = item.size_human;

  const modeCell = document.createElement("td");
  modeCell.className = "col-mode";
  modeCell.textContent = item.mode || "-rw-r--r--";

  const ownerCell = document.createElement("td");
  ownerCell.className = "col-owner";
  ownerCell.textContent = `${item.uid}:${item.gid}`;

  const inodeCell = document.createElement("td");
  inodeCell.className = "col-inode";
  inodeCell.textContent = item.inode || "—";

  const mtimeCell = document.createElement("td");
  mtimeCell.className = "col-mtime";
  mtimeCell.textContent = item.mtime || "—";

  const actionsCell = document.createElement("td");
  actionsCell.className = "col-actions";
  const actGroup = document.createElement("div");
  actGroup.className = "action-btns";

  if (item.type === "file") {
    const btnPrev = document.createElement("button");
    btnPrev.className = "btn-tbl-action";
    btnPrev.title = "Preview";
    btnPrev.textContent = "View";
    btnPrev.addEventListener("click", (e) => {
      e.stopPropagation();
      openPreview(item.path);
    });
    actGroup.appendChild(btnPrev);

    const btnDl = document.createElement("button");
    btnDl.className = "btn-tbl-action";
    btnDl.title = "Download";
    btnDl.textContent = "Get";
    btnDl.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `/api/download?path=${encodeURIComponent(item.path)}`;
    });
    actGroup.appendChild(btnDl);
  } else if (item.type === "directory") {
    const btnZip = document.createElement("button");
    btnZip.className = "btn-tbl-action";
    btnZip.title = "Download ZIP";
    btnZip.textContent = ".ZIP";
    btnZip.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `/api/download-zip?path=${encodeURIComponent(item.path)}`;
    });
    actGroup.appendChild(btnZip);
  }

  actionsCell.appendChild(actGroup);

  tr.appendChild(nameCell);
  tr.appendChild(sizeCell);
  tr.appendChild(modeCell);
  tr.appendChild(ownerCell);
  tr.appendChild(inodeCell);
  tr.appendChild(mtimeCell);
  tr.appendChild(actionsCell);

  tr.addEventListener("click", () => {
    if (item.type === "directory") {
      loadDirectory(item.path);
    } else if (item.type === "file") {
      openPreview(item.path);
    }
  });

  fileTableBody.appendChild(tr);
}

// Search Handler
function onSearchInput(immediate = false) {
  const query = searchInput.value.trim();
  btnClearSearch.classList.toggle("hidden", !query);

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }

  if (!query) {
    stopSearch("stopped");
    showSearchProgress(false);
    renderTable(currentEntries);
    return;
  }

  const isGrep = chkContentSearch && chkContentSearch.checked;
  const isDeep = chkDeepSearch && chkDeepSearch.checked;

  if (immediate || (!isGrep && !isDeep)) {
    executeSearch();
  } else {
    if (isGrep && searchProgressPanel) {
      showSearchProgress(true, true, query);
      if (searchCurrentFile) searchCurrentFile.textContent = "Ready to search...";
      if (searchProgressSub) searchProgressSub.textContent = "Press Enter to start scanning immediately";
    }
    searchDebounceTimer = setTimeout(() => {
      executeSearch();
    }, isGrep ? 350 : 200);
  }
}

function executeSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    stopSearch("stopped");
    showSearchProgress(false);
    renderTable(currentEntries);
    return;
  }

  // Inside Files (Grep) Search
  if (chkContentSearch && chkContentSearch.checked) {
    const isRecursive = chkDeepSearch ? chkDeepSearch.checked : false;
    startStreamingSearch(
      `/api/grep/stream?q=${encodeURIComponent(query)}&path=${encodeURIComponent(currentPath)}&recursive=${isRecursive}`,
      true,
      query
    );
    return;
  }

  // Filename Deep Search
  if (chkDeepSearch.checked) {
    startStreamingSearch(
      `/api/search/stream?q=${encodeURIComponent(query)}&path=${encodeURIComponent(currentPath)}`,
      false,
      query
    );
  } else {
    stopSearch("stopped");
    showSearchProgress(false);
    sortAndRenderEntries();
  }
}

// In-File Search Engine
function performInFileSearch(autoScroll = true) {
  if (!inFileSearchInput) return;
  const query = inFileSearchInput.value;
  if (btnInFileClear) btnInFileClear.classList.toggle("hidden", !query);

  if (!query || !rawFileContent) {
    if (codeView && codeView.querySelector("code")) {
      codeView.querySelector("code").textContent = rawFileContent;
    }
    inFileMatches = [];
    activeInFileMatchIndex = -1;
    if (inFileMatchCount) inFileMatchCount.textContent = "0/0";
    return;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = inFileCaseSensitive ? "g" : "gi";
  let regex;
  try {
    regex = new RegExp(escaped, flags);
  } catch (e) {
    return;
  }

  const matches = [];
  let m;
  while ((m = regex.exec(rawFileContent)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
    if (matches.length >= 2500) break;
  }

  inFileMatches = matches;

  if (matches.length === 0) {
    if (codeView && codeView.querySelector("code")) {
      codeView.querySelector("code").textContent = rawFileContent;
    }
    activeInFileMatchIndex = -1;
    if (inFileMatchCount) inFileMatchCount.textContent = "0/0";
    return;
  }

  if (activeInFileMatchIndex < 0 || activeInFileMatchIndex >= matches.length) {
    activeInFileMatchIndex = 0;
  }

  if (inFileMatchCount) {
    inFileMatchCount.textContent = `${activeInFileMatchIndex + 1}/${matches.length}`;
  }

  let html = "";
  let lastPos = 0;
  for (let i = 0; i < matches.length; i++) {
    const matchObj = matches[i];
    html += escapeHtml(rawFileContent.slice(lastPos, matchObj.start));
    const activeClass = i === activeInFileMatchIndex ? " active" : "";
    const matchedText = escapeHtml(rawFileContent.slice(matchObj.start, matchObj.end));
    html += `<mark class="search-highlight${activeClass}" data-match-idx="${i}">${matchedText}</mark>`;
    lastPos = matchObj.end;
  }
  html += escapeHtml(rawFileContent.slice(lastPos));

  if (codeView && codeView.querySelector("code")) {
    codeView.querySelector("code").innerHTML = html;
  }

  if (autoScroll) {
    scrollToActiveMatch();
  }
}

function scrollToActiveMatch() {
  if (!codeView) return;
  const activeEl = codeView.querySelector("mark.search-highlight.active");
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function navigateInFileMatch(direction) {
  if (inFileMatches.length === 0) return;
  if (direction === "next") {
    activeInFileMatchIndex = (activeInFileMatchIndex + 1) % inFileMatches.length;
  } else {
    activeInFileMatchIndex = (activeInFileMatchIndex - 1 + inFileMatches.length) % inFileMatches.length;
  }

  const marks = codeView.querySelectorAll("mark.search-highlight");
  marks.forEach((el, idx) => {
    el.classList.toggle("active", idx === activeInFileMatchIndex);
  });

  if (inFileMatchCount) {
    inFileMatchCount.textContent = `${activeInFileMatchIndex + 1}/${inFileMatches.length}`;
  }

  scrollToActiveMatch();
}

// Preview Modal
async function openPreview(path, initialSearch = "") {
  currentPreviewPath = path;
  modalFileName.textContent = path.split("/").pop();
  modalFilePath.textContent = path;
  codeView.querySelector("code").textContent = "Loading file content...";
  hexTableBody.innerHTML = "";
  metaGrid.innerHTML = "";
  previewModal.classList.remove("hidden");

  try {
    const res = await fetch(`/api/preview?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to preview file");

    rawFileContent = data.content_text || "";

    // Populate Text Tab
    if (data.content_text !== null) {
      textEncodingInfo.textContent = `${data.mime_type} • ${data.size_human}${data.is_truncated ? " (Truncated preview)" : ""}`;
      document.getElementById("tabBtnText").click();

      if (initialSearch) {
        if (inFileSearchInput) inFileSearchInput.value = initialSearch;
        activeInFileMatchIndex = 0;
        performInFileSearch(true);
      } else if (inFileSearchInput && inFileSearchInput.value) {
        performInFileSearch(true);
      } else {
        codeView.querySelector("code").textContent = rawFileContent;
        if (inFileMatchCount) inFileMatchCount.textContent = "0/0";
      }
    } else {
      rawFileContent = "";
      codeView.querySelector("code").textContent = "[Binary File - View in Hex Viewer]";
      document.getElementById("tabBtnHex").click();
      if (inFileMatchCount) inFileMatchCount.textContent = "0/0";
    }

    // Populate Image Tab
    const tabBtnImage = document.getElementById("tabBtnImage");
    if (data.content_base64) {
      imagePreview.src = data.content_base64;
      tabBtnImage.classList.remove("hidden");
      tabBtnImage.click();
    } else {
      tabBtnImage.classList.add("hidden");
    }

    // Populate Hex Tab
    if (data.hex_dump && data.hex_dump.length > 0) {
      hexTableBody.innerHTML = data.hex_dump.map(line => `
        <tr>
          <td>${line.offset}</td>
          <td>${line.hex}</td>
          <td>${escapeHtml(line.ascii)}</td>
        </tr>
      `).join("");
    }

    // Populate Metadata Tab
    const meta = data.metadata || {};
    metaGrid.innerHTML = `
      <div class="meta-item"><div class="meta-item-label">Inode Number</div><div class="meta-item-val">${meta.inode || "—"}</div></div>
      <div class="meta-item"><div class="meta-item-label">Permissions</div><div class="meta-item-val">${meta.mode || "—"}</div></div>
      <div class="meta-item"><div class="meta-item-label">File Size</div><div class="meta-item-val">${data.size.toLocaleString()} bytes (${data.size_human})</div></div>
      <div class="meta-item"><div class="meta-item-label">Owner UID:GID</div><div class="meta-item-val">${meta.uid}:${meta.gid}</div></div>
      <div class="meta-item"><div class="meta-item-label">Modified Date</div><div class="meta-item-val">${meta.mtime || "—"}</div></div>
      <div class="meta-item"><div class="meta-item-label">Ext4 Inode Flags</div><div class="meta-item-val">${meta.flags || "0x0"}</div></div>
    `;

  } catch (e) {
    codeView.querySelector("code").textContent = `Error loading preview: ${e.message}`;
  }
}

function closeModal() {
  previewModal.classList.add("hidden");
  currentPreviewPath = null;
  rawFileContent = "";
  inFileMatches = [];
  activeInFileMatchIndex = -1;
  if (inFileSearchInput) inFileSearchInput.value = "";
  if (inFileMatchCount) inFileMatchCount.textContent = "0/0";
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Start application
window.addEventListener("DOMContentLoaded", initApp);
