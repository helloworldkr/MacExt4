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

const btnSaveSearchResults = document.getElementById("btnSaveSearchResults");
const btnSaveSearchLabel = document.getElementById("btnSaveSearchLabel");
const btnSaveSearchProgress = document.getElementById("btnSaveSearchProgress");
const btnInFileSaveText = document.getElementById("btnInFileSaveText");

// Saved Searches in App Elements
const btnSaveSearchInApp = document.getElementById("btnSaveSearchInApp");
const btnSaveSearchInAppLabel = document.getElementById("btnSaveSearchInAppLabel");
const btnSaveSearchProgressInApp = document.getElementById("btnSaveSearchProgressInApp");
const btnOpenSavedSearches = document.getElementById("btnOpenSavedSearches");
const savedSearchesCountBadge = document.getElementById("savedSearchesCountBadge");

const savedSearchesModal = document.getElementById("savedSearchesModal");
const savedSearchesModalCount = document.getElementById("savedSearchesModalCount");
const btnCloseSavedSearchesModal = document.getElementById("btnCloseSavedSearchesModal");
const btnClearAllSavedSearches = document.getElementById("btnClearAllSavedSearches");
const savedSearchesFilterInput = document.getElementById("savedSearchesFilterInput");
const btnClearSavedFilter = document.getElementById("btnClearSavedFilter");
const savedSearchesList = document.getElementById("savedSearchesList");

const savedSearchBanner = document.getElementById("savedSearchBanner");
const savedBannerQuery = document.getElementById("savedBannerQuery");
const savedBannerDetails = document.getElementById("savedBannerDetails");
const btnSavedBannerRerun = document.getElementById("btnSavedBannerRerun");
const btnSavedBannerExport = document.getElementById("btnSavedBannerExport");
const btnCloseSavedBanner = document.getElementById("btnCloseSavedBanner");

// Disk Index & Search Optimization Elements
const btnIndexDisk = document.getElementById("btnIndexDisk");
const indexDot = document.getElementById("indexDot");
const indexStatusText = document.getElementById("indexStatusText");
const indexTag = document.getElementById("indexTag");
const indexProgressPanel = document.getElementById("indexProgressPanel");
const indexSpinner = document.getElementById("indexSpinner");
const indexProgressTitle = document.getElementById("indexProgressTitle");
const indexProgressSub = document.getElementById("indexProgressSub");
const indexSpeedBadge = document.getElementById("indexSpeedBadge");
const indexSizeBadge = document.getElementById("indexSizeBadge");
const indexTimeBadge = document.getElementById("indexTimeBadge");
const btnStopIndexing = document.getElementById("btnStopIndexing");
const indexProgressBar = document.getElementById("indexProgressBar");
const indexCountText = document.getElementById("indexCountText");
const indexCurrentDir = document.getElementById("indexCurrentDir");

// Search Filter Elements
const btnToggleSearchFilters = document.getElementById("btnToggleSearchFilters");
const filterCountBadge = document.getElementById("filterCountBadge");
const filterChevron = document.getElementById("filterChevron");
const searchFiltersDrawer = document.getElementById("searchFiltersDrawer");
const btnResetFilters = document.getElementById("btnResetFilters");
const activeFilterSummary = document.getElementById("activeFilterSummary");
const filterIncludeExts = document.getElementById("filterIncludeExts");
const btnClearIncludeExts = document.getElementById("btnClearIncludeExts");
const filterExcludeExts = document.getElementById("filterExcludeExts");
const btnClearExcludeExts = document.getElementById("btnClearExcludeExts");
const filterItemType = document.getElementById("filterItemType");
const filterSizePreset = document.getElementById("filterSizePreset");
const customSizeWrap = document.getElementById("customSizeWrap");
const filterMinSize = document.getElementById("filterMinSize");
const filterMaxSize = document.getElementById("filterMaxSize");
const filterSizeUnit = document.getElementById("filterSizeUnit");
const filterDateModified = document.getElementById("filterDateModified");
const filterCaseSensitive = document.getElementById("filterCaseSensitive");
const filterWholeWord = document.getElementById("filterWholeWord");
const filterRegex = document.getElementById("filterRegex");
const activeFiltersBanner = document.getElementById("activeFiltersBanner");
const activeFilterTags = document.getElementById("activeFilterTags");
const btnEditFiltersFromBanner = document.getElementById("btnEditFiltersFromBanner");
const btnClearFiltersFromBanner = document.getElementById("btnClearFiltersFromBanner");

// Search Filters State
const searchFilters = {
  preset: "all",
  includeExts: "",
  excludeExts: "",
  itemType: "all",
  sizePreset: "any",
  minSize: "",
  maxSize: "",
  sizeUnit: "MB",
  dateModified: "any",
  caseSensitive: false,
  wholeWord: false,
  regex: false
};

const CATEGORY_PRESETS = {
  all: { include: "", exclude: "" },
  code: { include: "py, js, ts, jsx, tsx, c, cpp, h, hpp, go, rs, java, kt, rb, php, sh, bash, zsh, html, css, scss, sql, json, yaml, yml, toml, xml", exclude: "" },
  configs: { include: "conf, config, cfg, ini, json, yaml, yml, toml, xml, env, cnf, properties", exclude: "" },
  logs: { include: "log, txt, md, csv, out, err, trace, journal", exclude: "" },
  docs: { include: "pdf, doc, docx, odt, rtf, rst, tex, man", exclude: "" },
  images: { include: "png, jpg, jpeg, gif, svg, webp, bmp, ico", exclude: "" },
  archives: { include: "zip, tar, gz, xz, bz2, 7z, rar, deb, rpm, pkg, zst", exclude: "" }
};

let currentSearchResults = [];
let currentSearchQuery = "";
let currentSearchMode = "";
let currentSearchPath = "/";

let searchAbortController = null;
let isSearchActive = false;
let streamResultsCount = 0;

let savedSearchesData = [];
let activeSavedSearch = null;
let isIndexingActive = false;
let indexingAbortController = null;

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
  await checkIndexStatus();
  await fetchSavedSearches();
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
      await checkIndexStatus();
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
    currentSearchResults = [];
    currentSearchQuery = "";
    currentSearchMode = "";
    updateSaveSearchButton();
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

  // Advanced Search Filters Drawer Toggle
  if (btnToggleSearchFilters && searchFiltersDrawer) {
    btnToggleSearchFilters.addEventListener("click", () => {
      const isHidden = searchFiltersDrawer.classList.toggle("hidden");
      if (filterChevron) {
        filterChevron.textContent = isHidden ? "▾" : "▴";
      }
    });
  }

  // Reset Filters Button
  if (btnResetFilters) {
    btnResetFilters.addEventListener("click", () => {
      resetSearchFilters(true);
    });
  }

  // Preset Pills
  document.querySelectorAll(".preset-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const preset = pill.dataset.preset;
      if (preset) applyCategoryPreset(preset);
    });
  });

  // Include Extensions
  if (filterIncludeExts) {
    filterIncludeExts.addEventListener("input", () => {
      searchFilters.includeExts = filterIncludeExts.value;
      searchFilters.preset = "custom";
      syncPresetPills();
      updateFilterBadgeAndSummary(true);
    });
    filterIncludeExts.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeSearch();
      }
    });
  }
  if (btnClearIncludeExts) {
    btnClearIncludeExts.addEventListener("click", () => {
      searchFilters.includeExts = "";
      searchFilters.preset = "all";
      if (filterIncludeExts) filterIncludeExts.value = "";
      syncPresetPills();
      updateFilterBadgeAndSummary(true);
    });
  }

  // Exclude Extensions
  if (filterExcludeExts) {
    filterExcludeExts.addEventListener("input", () => {
      searchFilters.excludeExts = filterExcludeExts.value;
      updateFilterBadgeAndSummary(true);
    });
    filterExcludeExts.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeSearch();
      }
    });
  }
  if (btnClearExcludeExts) {
    btnClearExcludeExts.addEventListener("click", () => {
      searchFilters.excludeExts = "";
      if (filterExcludeExts) filterExcludeExts.value = "";
      updateFilterBadgeAndSummary(true);
    });
  }

  // Item Type Filter
  if (filterItemType) {
    filterItemType.addEventListener("change", () => {
      searchFilters.itemType = filterItemType.value;
      updateFilterBadgeAndSummary(true);
    });
  }

  // Size Preset & Custom Bounds
  if (filterSizePreset) {
    filterSizePreset.addEventListener("change", () => {
      searchFilters.sizePreset = filterSizePreset.value;
      updateFilterBadgeAndSummary(true);
    });
  }
  if (filterMinSize) {
    filterMinSize.addEventListener("input", () => {
      searchFilters.minSize = filterMinSize.value;
      updateFilterBadgeAndSummary(true);
    });
  }
  if (filterMaxSize) {
    filterMaxSize.addEventListener("input", () => {
      searchFilters.maxSize = filterMaxSize.value;
      updateFilterBadgeAndSummary(true);
    });
  }
  if (filterSizeUnit) {
    filterSizeUnit.addEventListener("change", () => {
      searchFilters.sizeUnit = filterSizeUnit.value;
      updateFilterBadgeAndSummary(true);
    });
  }

  // Date Modified Filter
  if (filterDateModified) {
    filterDateModified.addEventListener("change", () => {
      searchFilters.dateModified = filterDateModified.value;
      updateFilterBadgeAndSummary(true);
    });
  }

  // Match Options (Case, Word, Regex)
  if (filterCaseSensitive) {
    filterCaseSensitive.addEventListener("change", () => {
      searchFilters.caseSensitive = filterCaseSensitive.checked;
      updateFilterBadgeAndSummary(true);
    });
  }
  if (filterWholeWord) {
    filterWholeWord.addEventListener("change", () => {
      searchFilters.wholeWord = filterWholeWord.checked;
      updateFilterBadgeAndSummary(true);
    });
  }
  if (filterRegex) {
    filterRegex.addEventListener("change", () => {
      searchFilters.regex = filterRegex.checked;
      updateFilterBadgeAndSummary(true);
    });
  }

  // Active Filters Banner Buttons
  if (btnEditFiltersFromBanner) {
    btnEditFiltersFromBanner.addEventListener("click", () => {
      if (searchFiltersDrawer) {
        searchFiltersDrawer.classList.remove("hidden");
        if (filterChevron) filterChevron.textContent = "▴";
        searchFiltersDrawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
  if (btnClearFiltersFromBanner) {
    btnClearFiltersFromBanner.addEventListener("click", () => {
      resetSearchFilters(true);
    });
  }

  // Save Search in App Actions
  if (btnSaveSearchInApp) {
    btnSaveSearchInApp.addEventListener("click", saveCurrentSearchResultsInApp);
  }
  if (btnSaveSearchProgressInApp) {
    btnSaveSearchProgressInApp.addEventListener("click", saveCurrentSearchResultsInApp);
  }

  // Export Results as Text File
  if (btnSaveSearchResults) {
    btnSaveSearchResults.addEventListener("click", saveSearchResultsAsText);
  }
  if (btnSaveSearchProgress) {
    btnSaveSearchProgress.addEventListener("click", saveSearchResultsAsText);
  }

  if (btnInFileSaveText) {
    btnInFileSaveText.addEventListener("click", saveInFileSearchResultsAsText);
  }

  // Saved Searches Modal & Banner
  if (btnOpenSavedSearches) {
    btnOpenSavedSearches.addEventListener("click", openSavedSearchesModal);
  }
  if (btnCloseSavedSearchesModal) {
    btnCloseSavedSearchesModal.addEventListener("click", closeSavedSearchesModal);
  }
  if (savedSearchesModal) {
    savedSearchesModal.addEventListener("click", (e) => {
      if (e.target === savedSearchesModal) closeSavedSearchesModal();
    });
  }
  if (btnClearAllSavedSearches) {
    btnClearAllSavedSearches.addEventListener("click", clearAllSavedSearches);
  }
  if (savedSearchesFilterInput) {
    savedSearchesFilterInput.addEventListener("input", () => {
      const q = savedSearchesFilterInput.value.trim();
      if (btnClearSavedFilter) {
        if (q) btnClearSavedFilter.classList.remove("hidden");
        else btnClearSavedFilter.classList.add("hidden");
      }
      renderSavedSearchesList(q);
    });
  }
  if (btnClearSavedFilter) {
    btnClearSavedFilter.addEventListener("click", () => {
      savedSearchesFilterInput.value = "";
      btnClearSavedFilter.classList.add("hidden");
      renderSavedSearchesList("");
    });
  }
  if (btnCloseSavedBanner) {
    btnCloseSavedBanner.addEventListener("click", exitSavedSearchView);
  }
  if (btnSavedBannerRerun) {
    btnSavedBannerRerun.addEventListener("click", () => {
      if (activeSavedSearch) rerunSavedSearch(activeSavedSearch.id);
    });
  }
  if (btnSavedBannerExport) {
    btnSavedBannerExport.addEventListener("click", () => {
      if (activeSavedSearch) exportSavedSearchText(activeSavedSearch.id);
    });
  }

  // Disk Index & Search Acceleration
  if (btnIndexDisk) {
    btnIndexDisk.addEventListener("click", () => {
      if (isIndexingActive) {
        stopIndexingDisk();
      } else {
        startIndexingDisk();
      }
    });
  }
  if (btnStopIndexing) {
    btnStopIndexing.addEventListener("click", stopIndexingDisk);
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

// -----------------------------------------------------------------------------
// Advanced Search Filters Engine
// -----------------------------------------------------------------------------

function applyCategoryPreset(presetName) {
  const cfg = CATEGORY_PRESETS[presetName] || CATEGORY_PRESETS.all;
  searchFilters.preset = presetName;
  searchFilters.includeExts = cfg.include;
  if (filterIncludeExts) {
    filterIncludeExts.value = cfg.include;
  }
  syncPresetPills();
  updateFilterBadgeAndSummary(true);
}

function syncPresetPills() {
  document.querySelectorAll(".preset-pill").forEach(pill => {
    pill.classList.toggle("active", pill.dataset.preset === searchFilters.preset);
  });
}

function resetSearchFilters(triggerSearch = true) {
  searchFilters.preset = "all";
  searchFilters.includeExts = "";
  searchFilters.excludeExts = "";
  searchFilters.itemType = "all";
  searchFilters.sizePreset = "any";
  searchFilters.minSize = "";
  searchFilters.maxSize = "";
  searchFilters.sizeUnit = "MB";
  searchFilters.dateModified = "any";
  searchFilters.caseSensitive = false;
  searchFilters.wholeWord = false;
  searchFilters.regex = false;

  if (filterIncludeExts) filterIncludeExts.value = "";
  if (filterExcludeExts) filterExcludeExts.value = "";
  if (filterItemType) filterItemType.value = "all";
  if (filterSizePreset) filterSizePreset.value = "any";
  if (filterMinSize) filterMinSize.value = "";
  if (filterMaxSize) filterMaxSize.value = "";
  if (filterSizeUnit) filterSizeUnit.value = "MB";
  if (filterDateModified) filterDateModified.value = "any";
  if (filterCaseSensitive) filterCaseSensitive.checked = false;
  if (filterWholeWord) filterWholeWord.checked = false;
  if (filterRegex) filterRegex.checked = false;

  syncPresetPills();
  updateFilterBadgeAndSummary(triggerSearch);
}

function restoreSearchFilters(f) {
  if (!f) return;
  searchFilters.preset = f.preset || "all";
  searchFilters.includeExts = f.includeExts || "";
  searchFilters.excludeExts = f.excludeExts || "";
  searchFilters.itemType = f.itemType || "all";
  searchFilters.sizePreset = f.sizePreset || "any";
  searchFilters.minSize = f.minSize || "";
  searchFilters.maxSize = f.maxSize || "";
  searchFilters.sizeUnit = f.sizeUnit || "MB";
  searchFilters.dateModified = f.dateModified || "any";
  searchFilters.caseSensitive = !!f.caseSensitive;
  searchFilters.wholeWord = !!f.wholeWord;
  searchFilters.regex = !!f.regex;

  if (filterIncludeExts) filterIncludeExts.value = searchFilters.includeExts;
  if (filterExcludeExts) filterExcludeExts.value = searchFilters.excludeExts;
  if (filterItemType) filterItemType.value = searchFilters.itemType;
  if (filterSizePreset) filterSizePreset.value = searchFilters.sizePreset;
  if (filterMinSize) filterMinSize.value = searchFilters.minSize;
  if (filterMaxSize) filterMaxSize.value = searchFilters.maxSize;
  if (filterSizeUnit) filterSizeUnit.value = searchFilters.sizeUnit;
  if (filterDateModified) filterDateModified.value = searchFilters.dateModified;
  if (filterCaseSensitive) filterCaseSensitive.checked = searchFilters.caseSensitive;
  if (filterWholeWord) filterWholeWord.checked = searchFilters.wholeWord;
  if (filterRegex) filterRegex.checked = searchFilters.regex;

  syncPresetPills();
  updateFilterBadgeAndSummary(false);
}

function getCalculatedByteBounds() {
  const p = searchFilters.sizePreset;
  if (p === "tiny") {
    return { minSize: null, maxSize: 100 * 1024 };
  }
  if (p === "small") {
    return { minSize: 100 * 1024, maxSize: 10 * 1024 * 1024 };
  }
  if (p === "medium") {
    return { minSize: 10 * 1024 * 1024, maxSize: 100 * 1024 * 1024 };
  }
  if (p === "large") {
    return { minSize: 100 * 1024 * 1024, maxSize: null };
  }
  if (p === "custom") {
    const multMap = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824 };
    const mult = multMap[searchFilters.sizeUnit] || 1048576;
    const minVal = parseFloat(searchFilters.minSize);
    const maxVal = parseFloat(searchFilters.maxSize);
    return {
      minSize: (!isNaN(minVal) && minVal >= 0) ? Math.round(minVal * mult) : null,
      maxSize: (!isNaN(maxVal) && maxVal >= 0) ? Math.round(maxVal * mult) : null
    };
  }
  return { minSize: null, maxSize: null };
}

function getMtimeCutoff(filterVal) {
  const now = Date.now() / 1000;
  if (filterVal === "24h") return now - 86400;
  if (filterVal === "7d") return now - 7 * 86400;
  if (filterVal === "30d") return now - 30 * 86400;
  if (filterVal === "1y") return now - 365 * 86400;
  return null;
}

function countActiveFilters() {
  let count = 0;
  if (searchFilters.includeExts && searchFilters.includeExts.trim()) count++;
  if (searchFilters.excludeExts && searchFilters.excludeExts.trim()) count++;
  if (searchFilters.itemType && searchFilters.itemType !== "all") count++;
  if (searchFilters.sizePreset && searchFilters.sizePreset !== "any") count++;
  if (searchFilters.dateModified && searchFilters.dateModified !== "any") count++;
  if (searchFilters.caseSensitive) count++;
  if (searchFilters.wholeWord) count++;
  if (searchFilters.regex) count++;
  return count;
}

function updateFilterBadgeAndSummary(triggerSearch = true) {
  const count = countActiveFilters();

  // 1. Toggle Button Badge
  if (filterCountBadge) {
    if (count > 0) {
      filterCountBadge.textContent = count;
      filterCountBadge.classList.remove("hidden");
      if (btnToggleSearchFilters) btnToggleSearchFilters.classList.add("active");
    } else {
      filterCountBadge.textContent = "0";
      filterCountBadge.classList.add("hidden");
      if (btnToggleSearchFilters) btnToggleSearchFilters.classList.remove("active");
    }
  }

  // 2. Clear buttons on input fields
  if (btnClearIncludeExts) {
    btnClearIncludeExts.classList.toggle("hidden", !searchFilters.includeExts);
  }
  if (btnClearExcludeExts) {
    btnClearExcludeExts.classList.toggle("hidden", !searchFilters.excludeExts);
  }

  // 3. Custom size inputs visibility
  if (customSizeWrap) {
    customSizeWrap.classList.toggle("hidden", searchFilters.sizePreset !== "custom");
  }

  // 4. Header Summary Text
  if (activeFilterSummary) {
    if (count === 0) {
      activeFilterSummary.textContent = "No filters applied";
    } else {
      const parts = [];
      if (searchFilters.preset && searchFilters.preset !== "all" && searchFilters.preset !== "custom") {
        parts.push(`Preset: ${searchFilters.preset}`);
      } else if (searchFilters.includeExts && searchFilters.includeExts.trim()) {
        parts.push(`+exts: ${searchFilters.includeExts.trim()}`);
      }
      if (searchFilters.excludeExts && searchFilters.excludeExts.trim()) {
        parts.push(`-exts: ${searchFilters.excludeExts.trim()}`);
      }
      if (searchFilters.itemType && searchFilters.itemType !== "all") {
        parts.push(`type: ${searchFilters.itemType}`);
      }
      if (searchFilters.sizePreset && searchFilters.sizePreset !== "any") {
        parts.push(`size: ${searchFilters.sizePreset}`);
      }
      if (searchFilters.dateModified && searchFilters.dateModified !== "any") {
        parts.push(`date: ${searchFilters.dateModified}`);
      }
      if (searchFilters.caseSensitive) parts.push("Aa Case");
      if (searchFilters.wholeWord) parts.push("[w] Word");
      if (searchFilters.regex) parts.push(".* RegEx");
      activeFilterSummary.textContent = `${count} active: ${parts.join(" · ")}`;
    }
  }

  // 5. Active Filters Banner and Pills
  if (activeFiltersBanner && activeFilterTags) {
    if (count > 0) {
      activeFilterTags.innerHTML = "";

      const addTag = (label, onRemove) => {
        const tag = document.createElement("span");
        tag.className = "filter-tag-pill";
        tag.innerHTML = `<span>${escapeHtml(label)}</span><span class="remove-tag" title="Remove filter">&times;</span>`;
        tag.querySelector(".remove-tag").addEventListener("click", (e) => {
          e.stopPropagation();
          onRemove();
        });
        activeFilterTags.appendChild(tag);
      };

      if (searchFilters.includeExts && searchFilters.includeExts.trim()) {
        addTag(`+${searchFilters.includeExts.trim()}`, () => {
          searchFilters.includeExts = "";
          searchFilters.preset = "all";
          if (filterIncludeExts) filterIncludeExts.value = "";
          syncPresetPills();
          updateFilterBadgeAndSummary(true);
        });
      }

      if (searchFilters.excludeExts && searchFilters.excludeExts.trim()) {
        addTag(`-${searchFilters.excludeExts.trim()}`, () => {
          searchFilters.excludeExts = "";
          if (filterExcludeExts) filterExcludeExts.value = "";
          updateFilterBadgeAndSummary(true);
        });
      }

      if (searchFilters.itemType && searchFilters.itemType !== "all") {
        addTag(`type: ${searchFilters.itemType}`, () => {
          searchFilters.itemType = "all";
          if (filterItemType) filterItemType.value = "all";
          updateFilterBadgeAndSummary(true);
        });
      }

      if (searchFilters.sizePreset && searchFilters.sizePreset !== "any") {
        let sizeLabel = searchFilters.sizePreset;
        if (searchFilters.sizePreset === "tiny") sizeLabel = "< 100 KB";
        else if (searchFilters.sizePreset === "small") sizeLabel = "100 KB - 10 MB";
        else if (searchFilters.sizePreset === "medium") sizeLabel = "10 MB - 100 MB";
        else if (searchFilters.sizePreset === "large") sizeLabel = "> 100 MB";
        else if (searchFilters.sizePreset === "custom") {
          sizeLabel = `${searchFilters.minSize || "0"} - ${searchFilters.maxSize || "∞"} ${searchFilters.sizeUnit}`;
        }
        addTag(`size: ${sizeLabel}`, () => {
          searchFilters.sizePreset = "any";
          searchFilters.minSize = "";
          searchFilters.maxSize = "";
          if (filterSizePreset) filterSizePreset.value = "any";
          if (filterMinSize) filterMinSize.value = "";
          if (filterMaxSize) filterMaxSize.value = "";
          updateFilterBadgeAndSummary(true);
        });
      }

      if (searchFilters.dateModified && searchFilters.dateModified !== "any") {
        addTag(`date: ${searchFilters.dateModified}`, () => {
          searchFilters.dateModified = "any";
          if (filterDateModified) filterDateModified.value = "any";
          updateFilterBadgeAndSummary(true);
        });
      }

      if (searchFilters.caseSensitive) {
        addTag("Aa Case", () => {
          searchFilters.caseSensitive = false;
          if (filterCaseSensitive) filterCaseSensitive.checked = false;
          updateFilterBadgeAndSummary(true);
        });
      }

      if (searchFilters.wholeWord) {
        addTag("[w] Word", () => {
          searchFilters.wholeWord = false;
          if (filterWholeWord) filterWholeWord.checked = false;
          updateFilterBadgeAndSummary(true);
        });
      }

      if (searchFilters.regex) {
        addTag(".* Regex", () => {
          searchFilters.regex = false;
          if (filterRegex) filterRegex.checked = false;
          updateFilterBadgeAndSummary(true);
        });
      }

      activeFiltersBanner.classList.remove("hidden");
    } else {
      activeFiltersBanner.classList.add("hidden");
    }
  }

  if (triggerSearch) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      executeSearch();
    }, 200);
  }
}

function buildSearchQueryUrl(baseUrl, isGrep, query) {
  const params = new URLSearchParams();
  params.set("q", query || "");
  params.set("path", currentPath || "/");
  if (isGrep) {
    params.set("recursive", chkDeepSearch ? chkDeepSearch.checked : false);
  }

  if (searchFilters.includeExts && searchFilters.includeExts.trim()) {
    params.set("include_exts", searchFilters.includeExts.trim());
  }
  if (searchFilters.excludeExts && searchFilters.excludeExts.trim()) {
    params.set("exclude_exts", searchFilters.excludeExts.trim());
  }
  if (searchFilters.itemType && searchFilters.itemType !== "all") {
    params.set("type_filter", searchFilters.itemType);
  }

  const bounds = getCalculatedByteBounds();
  if (bounds.minSize !== null) params.set("min_size", bounds.minSize);
  if (bounds.maxSize !== null) params.set("max_size", bounds.maxSize);

  if (searchFilters.dateModified && searchFilters.dateModified !== "any") {
    params.set("date_filter", searchFilters.dateModified);
  }

  if (searchFilters.caseSensitive) params.set("case_sensitive", "true");
  if (searchFilters.wholeWord) params.set("whole_word", "true");
  if (searchFilters.regex) params.set("use_regex", "true");

  return `${baseUrl}?${params.toString()}`;
}

function filterMatchesEntry(entry, query) {
  // Query name match
  if (query) {
    let nameMatches = false;
    if (searchFilters.regex) {
      try {
        const regex = new RegExp(query, searchFilters.caseSensitive ? "" : "i");
        nameMatches = regex.test(entry.name);
      } catch (e) {
        nameMatches = false;
      }
    } else if (searchFilters.wholeWord) {
      const pattern = `\\b${query.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`;
      const regex = new RegExp(pattern, searchFilters.caseSensitive ? "" : "i");
      nameMatches = regex.test(entry.name);
    } else if (searchFilters.caseSensitive) {
      nameMatches = entry.name.includes(query);
    } else {
      nameMatches = entry.name.toLowerCase().includes(query.toLowerCase());
    }
    if (!nameMatches) return false;
  }

  // Item Type Filter
  if (searchFilters.itemType && searchFilters.itemType !== "all") {
    if (searchFilters.itemType === "file" && entry.type !== "file") return false;
    if (searchFilters.itemType === "directory" && entry.type !== "directory") return false;
    if (searchFilters.itemType === "symlink" && entry.type !== "symlink") return false;
  }

  // Extension Inclusion / Exclusion (applies to files primarily)
  const dotIdx = entry.name.lastIndexOf(".");
  const ext = dotIdx >= 0 ? entry.name.slice(dotIdx + 1).toLowerCase() : "";

  if (searchFilters.includeExts && searchFilters.includeExts.trim()) {
    const incList = searchFilters.includeExts
      .split(/[\s,]+/)
      .map(x => x.trim().replace(/^\./, "").toLowerCase())
      .filter(Boolean);
    if (incList.length > 0) {
      if (entry.type === "directory") {
        return false;
      }
      if (!incList.includes(ext)) {
        return false;
      }
    }
  }

  if (searchFilters.excludeExts && searchFilters.excludeExts.trim()) {
    const excList = searchFilters.excludeExts
      .split(/[\s,]+/)
      .map(x => x.trim().replace(/^\./, "").toLowerCase())
      .filter(Boolean);
    if (excList.length > 0) {
      const nameLower = entry.name.toLowerCase();
      if (excList.includes(ext) || excList.includes(nameLower)) {
        return false;
      }
    }
  }

  // Size Bounds (applies to files)
  if (entry.type === "file") {
    const bounds = getCalculatedByteBounds();
    const size = typeof entry.size === "number" ? entry.size : 0;
    if (bounds.minSize !== null && size < bounds.minSize) return false;
    if (bounds.maxSize !== null && size > bounds.maxSize) return false;
  }

  // Date Modified Filter
  if (searchFilters.dateModified && searchFilters.dateModified !== "any" && entry.mtime) {
    const cutoff = getMtimeCutoff(searchFilters.dateModified);
    if (cutoff) {
      const entryTime = new Date(entry.mtime).getTime() / 1000;
      if (!isNaN(entryTime) && entryTime < cutoff) return false;
    }
  }

  return true;
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
    await checkIndexStatus();
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
  if (!isSearchActive && (!searchInput || !searchInput.value.trim())) {
    currentSearchResults = [];
    currentSearchQuery = "";
    currentSearchMode = "";
    updateSaveSearchButton();
  }
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
  const rawQuery = searchInput.value.trim();
  const hasFilters = countActiveFilters() > 0;
  let entries = [...currentEntries];

  if (rawQuery || hasFilters) {
    entries = entries.filter(e => filterMatchesEntry(e, rawQuery));
    currentSearchResults = entries;
    currentSearchQuery = rawQuery;
    currentSearchMode = "filter";
    currentSearchPath = currentPath;
  } else {
    currentSearchResults = [];
    currentSearchQuery = "";
    currentSearchMode = "";
  }
  updateSaveSearchButton();

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
  updateSaveSearchButton();
}

// Streaming Search
let searchDebounceTimer = null;

async function startStreamingSearch(url, isGrep, query) {
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();
  const signal = searchAbortController.signal;

  currentSearchResults = [];
  currentSearchQuery = query;
  currentSearchMode = isGrep ? "grep" : "filename";
  currentSearchPath = currentPath;
  updateSaveSearchButton();

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
    currentSearchResults.push(match);
    updateSaveSearchButton();
    if (searchFoundCount) searchFoundCount.textContent = `${streamResultsCount}`;

    if (isGrep) {
      appendGrepRow(match, query);
    } else {
      appendFileRow(match);
    }

  } else if (event.type === "done") {
    stopSearch("done");
    updateSaveSearchButton();
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
  const hasFilters = countActiveFilters() > 0;
  btnClearSearch.classList.toggle("hidden", !query);

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }

  if (!query && !hasFilters) {
    stopSearch("stopped");
    showSearchProgress(false);
    currentSearchResults = [];
    currentSearchQuery = "";
    currentSearchMode = "";
    updateSaveSearchButton();
    renderTable(currentEntries);
    return;
  }

  const isGrep = chkContentSearch && chkContentSearch.checked;
  const isDeep = chkDeepSearch && chkDeepSearch.checked;

  if (immediate || (!isGrep && !isDeep)) {
    executeSearch();
  } else {
    if (isGrep && searchProgressPanel) {
      showSearchProgress(true, true, query || "[Filtered Files]");
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
  const hasFilters = countActiveFilters() > 0;
  if (!query && !hasFilters) {
    stopSearch("stopped");
    showSearchProgress(false);
    currentSearchResults = [];
    currentSearchQuery = "";
    currentSearchMode = "";
    updateSaveSearchButton();
    renderTable(currentEntries);
    return;
  }

  // Inside Files (Grep) Search
  if (chkContentSearch && chkContentSearch.checked) {
    const isRecursive = chkDeepSearch ? chkDeepSearch.checked : false;
    const url = buildSearchQueryUrl("/api/grep/stream", true, query);
    startStreamingSearch(
      url,
      true,
      query || "[Filtered Files]"
    );
    return;
  }

  // Filename Deep Search
  if (chkDeepSearch.checked) {
    const url = buildSearchQueryUrl("/api/search/stream", false, query);
    startStreamingSearch(
      url,
      false,
      query || "[Filtered Files]"
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
    if (btnInFileSaveText) btnInFileSaveText.classList.add("hidden");
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
    if (btnInFileSaveText) btnInFileSaveText.classList.add("hidden");
    return;
  }

  if (btnInFileSaveText) {
    btnInFileSaveText.classList.remove("hidden");
    btnInFileSaveText.title = `Save ${matches.length} search matches as text file`;
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
  if (btnInFileSaveText) btnInFileSaveText.classList.add("hidden");
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// -----------------------------------------------------------------------------
// Save Search Results as Text Feature
// -----------------------------------------------------------------------------

function updateSaveSearchButton() {
  const count = currentSearchResults.length;

  // Export Results as (.txt)
  if (btnSaveSearchResults) {
    if (count > 0) {
      btnSaveSearchResults.classList.remove("hidden");
      btnSaveSearchResults.disabled = false;
      btnSaveSearchResults.title = `Export ${count} search result${count === 1 ? '' : 's'} as formatted text file`;
      if (btnSaveSearchLabel) {
        btnSaveSearchLabel.innerHTML = `Export (.txt) <span class="badge-count">${count}</span>`;
      }
    } else {
      btnSaveSearchResults.classList.add("hidden");
      btnSaveSearchResults.disabled = true;
      if (btnSaveSearchLabel) {
        btnSaveSearchLabel.textContent = "Export (.txt)";
      }
    }
  }

  // Save Search in App
  if (btnSaveSearchInApp) {
    if (count > 0) {
      btnSaveSearchInApp.classList.remove("hidden");
      btnSaveSearchInApp.disabled = false;
      btnSaveSearchInApp.title = `Save ${count} search result${count === 1 ? '' : 's'} inside the app for instant review`;
      if (btnSaveSearchInAppLabel) {
        btnSaveSearchInAppLabel.innerHTML = `Save in App <span class="badge-count">${count}</span>`;
      }
    } else {
      btnSaveSearchInApp.classList.add("hidden");
      btnSaveSearchInApp.disabled = true;
      if (btnSaveSearchInAppLabel) {
        btnSaveSearchInAppLabel.textContent = "Save in App";
      }
    }
  }

  // Progress Panel Save buttons
  if (btnSaveSearchProgress) {
    if (count > 0) {
      btnSaveSearchProgress.classList.remove("hidden");
      btnSaveSearchProgress.disabled = false;
      btnSaveSearchProgress.title = `Export ${count} search result${count === 1 ? '' : 's'} as text file`;
      btnSaveSearchProgress.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        Export (.txt) (${count})
      `;
    } else {
      btnSaveSearchProgress.classList.add("hidden");
      btnSaveSearchProgress.disabled = true;
    }
  }

  if (btnSaveSearchProgressInApp) {
    if (count > 0) {
      btnSaveSearchProgressInApp.classList.remove("hidden");
      btnSaveSearchProgressInApp.disabled = false;
      btnSaveSearchProgressInApp.title = `Save ${count} search result${count === 1 ? '' : 's'} inside the app`;
      btnSaveSearchProgressInApp.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        Save in App (${count})
      `;
    } else {
      btnSaveSearchProgressInApp.classList.add("hidden");
      btnSaveSearchProgressInApp.disabled = true;
    }
  }
}


function formatSearchResultsText(results, query, mode, path, volumeName) {
  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const divider = "=".repeat(80);
  const subDivider = "-".repeat(80);

  let modeDesc = "Filename Filter (Current Folder)";
  if (mode === "grep") {
    modeDesc = "Inside Files Content Search (Grep)";
  } else if (mode === "filename") {
    modeDesc = "Recursive Filename Search";
  }

  let totalOccurrences = 0;
  if (mode === "grep") {
    results.forEach(r => {
      totalOccurrences += (r.match_count || (r.matches ? r.matches.length : 0));
    });
  }

  const lines = [
    divider,
    "LINUX SSD EXPLORER - SEARCH RESULTS REPORT",
    divider,
    `Volume / Disk : ${volumeName || "Linux Ext4"}`,
    `Search Query  : "${query}"`,
    `Search Mode   : ${modeDesc}`,
    `Search Scope  : ${path || "/"}`,
    `Generated At  : ${dateStr}`,
    `Total Matches : ${results.length} file(s)${mode === "grep" ? ` with ${totalOccurrences} total occurrence(s)` : ""}`
  ];

  const activeCount = countActiveFilters();
  if (activeCount > 0 && activeFilterSummary) {
    lines.push(`Active Filters : ${activeFilterSummary.textContent}`);
  }

  lines.push(divider, "");

  results.forEach((item, idx) => {
    lines.push(`[${idx + 1}] ${item.path || item.name}`);
    lines.push(`    Type        : ${item.type ? (item.type.charAt(0).toUpperCase() + item.type.slice(1)) : "File"}`);
    lines.push(`    Size        : ${item.size_human || "0 B"} (${(item.size !== undefined ? item.size : 0).toLocaleString()} bytes)`);
    lines.push(`    Permissions : ${item.mode || "-rw-r--r--"} (UID: ${item.uid !== undefined ? item.uid : 0}, GID: ${item.gid !== undefined ? item.gid : 0})`);
    if (item.inode) {
      lines.push(`    Inode       : ${item.inode}`);
    }
    if (item.mtime) {
      lines.push(`    Modified    : ${item.mtime}`);
    }
    if (item.target) {
      lines.push(`    Symlink To  : ${item.target}`);
    }

    if (mode === "grep" && item.matches && item.matches.length > 0) {
      lines.push(`    Matches     : ${item.matches.length} occurrence(s)`);
      lines.push(`    ${subDivider}`);
      item.matches.forEach(m => {
        lines.push(`      Line ${String(m.line).padEnd(5)}: ${m.snippet}`);
      });
      lines.push(`    ${subDivider}`);
    }

    lines.push("");
  });

  lines.push(divider);
  lines.push(`End of Report (${results.length} items) - Linux SSD Explorer`);
  lines.push(divider);

  return lines.join("\n");
}

function formatInFileSearchResultsText(filePath, query, isCaseSensitive, matches, rawContent) {
  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const divider = "=".repeat(80);

  const rawLines = rawContent.split("\n");
  const matchingLines = [];
  let charCount = 0;
  let currentMatchIdx = 0;

  for (let lineNum = 0; lineNum < rawLines.length && currentMatchIdx < matches.length; lineNum++) {
    const lineLen = rawLines[lineNum].length + 1; // +1 for newline
    const lineEnd = charCount + lineLen;

    let countOnLine = 0;
    while (currentMatchIdx < matches.length && matches[currentMatchIdx].start < lineEnd) {
      countOnLine++;
      currentMatchIdx++;
    }

    if (countOnLine > 0) {
      matchingLines.push({
        lineNum: lineNum + 1,
        text: rawLines[lineNum],
        occurrences: countOnLine
      });
    }

    charCount = lineEnd;
  }

  const out = [
    divider,
    "LINUX SSD EXPLORER - IN-FILE SEARCH REPORT",
    divider,
    `File Path      : ${filePath}`,
    `Search Query   : "${query}"`,
    `Case Sensitive : ${isCaseSensitive ? "Yes" : "No"}`,
    `Generated At   : ${dateStr}`,
    `Total Matches  : ${matches.length} occurrence(s) across ${matchingLines.length} line(s)`,
    divider,
    ""
  ];

  matchingLines.forEach(item => {
    out.push(`Line ${String(item.lineNum).padEnd(6)}: ${item.text}`);
  });

  out.push("");
  out.push(divider);
  out.push(`End of Matches (${matches.length} occurrences) - Linux SSD Explorer`);
  out.push(divider);

  return out.join("\n");
}

async function downloadOrSaveText(filename, textContent) {
  let downloaded = false;

  // 1. Try modern Blob download
  try {
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
    downloaded = true;
  } catch (err) {
    console.warn("Client blob download failed:", err);
  }

  // 2. Server fallback endpoint
  if (!downloaded) {
    try {
      const res = await fetch("/api/download-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content: textContent })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 300);
        downloaded = true;
      }
    } catch (e) {
      console.error("Server fallback download failed:", e);
    }
  }

  showToast(`Saved search results to <strong>${escapeHtml(filename)}</strong>`, "Copy Text", () => {
    navigator.clipboard.writeText(textContent).then(() => {
      showToast("✓ Copied search results to clipboard!");
    }).catch(() => {
      showToast("Unable to copy to clipboard");
    });
  });
}

async function saveSearchResultsAsText() {
  if (!currentSearchResults || currentSearchResults.length === 0) {
    showToast("No search results to save.");
    return;
  }

  const query = currentSearchQuery || searchInput.value.trim() || "results";
  const mode = currentSearchMode || (chkContentSearch && chkContentSearch.checked ? "grep" : (chkDeepSearch && chkDeepSearch.checked ? "filename" : "filter"));
  const path = currentSearchPath || currentPath || "/";
  const volumeName = (volName && volName.textContent) ? volName.textContent : "Linux Ext4";

  const reportText = formatSearchResultsText(currentSearchResults, query, mode, path, volumeName);

  const safeQ = query.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 25) || "results";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `search_${mode}_${safeQ}_${timestamp}.txt`;

  await downloadOrSaveText(filename, reportText);
}

async function saveInFileSearchResultsAsText() {
  if (!inFileMatches || inFileMatches.length === 0 || !rawFileContent) {
    showToast("No in-file search matches to save.");
    return;
  }

  const query = inFileSearchInput.value || "";
  const filePath = currentPreviewPath || (modalFileName ? modalFileName.textContent : "file.txt");
  const reportText = formatInFileSearchResultsText(
    filePath,
    query,
    inFileCaseSensitive,
    inFileMatches,
    rawFileContent
  );

  const safeFile = (modalFileName ? modalFileName.textContent : "file").replace(/[^a-zA-Z0-9_.-]/g, "_");
  const safeQ = query.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20) || "match";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `matches_${safeFile}_${safeQ}_${timestamp}.txt`;

  await downloadOrSaveText(filename, reportText);
}

// -----------------------------------------------------------------------------
// Saved Searches in App Feature
// -----------------------------------------------------------------------------

async function fetchSavedSearches() {
  try {
    const res = await fetch("/api/saved-searches");
    if (!res.ok) return;
    const data = await res.json();
    savedSearchesData = Array.isArray(data) ? data : [];

    // Update toolbar badge
    if (savedSearchesCountBadge) {
      if (savedSearchesData.length > 0) {
        savedSearchesCountBadge.textContent = savedSearchesData.length;
        savedSearchesCountBadge.classList.remove("hidden");
      } else {
        savedSearchesCountBadge.classList.add("hidden");
      }
    }

    // Update modal header count
    if (savedSearchesModalCount) {
      savedSearchesModalCount.textContent = savedSearchesData.length;
    }

    if (btnClearAllSavedSearches) {
      if (savedSearchesData.length > 0) {
        btnClearAllSavedSearches.classList.remove("hidden");
      } else {
        btnClearAllSavedSearches.classList.add("hidden");
      }
    }
  } catch (err) {
    console.warn("Failed to fetch saved searches:", err);
  }
}

async function saveCurrentSearchResultsInApp() {
  if (!currentSearchResults || currentSearchResults.length === 0) {
    showToast("No search results to save.");
    return;
  }

  const query = currentSearchQuery || searchInput.value.trim() || "results";
  const mode = currentSearchMode || (chkContentSearch && chkContentSearch.checked ? "grep" : (chkDeepSearch && chkDeepSearch.checked ? "filename" : "filter"));
  const path = currentSearchPath || currentPath || "/";
  const volumeName = (volName && volName.textContent) ? volName.textContent : "Linux Ext4";
  const volumeId = activeDriveId || (diskSelect ? diskSelect.value : "default");

  try {
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query,
        results: currentSearchResults,
        mode: mode,
        root_path: path,
        volume_name: volumeName,
        volume_id: volumeId,
        filters: { ...searchFilters }
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to save search");
    }

    await fetchSavedSearches();

    showToast(`✓ Saved <strong>${currentSearchResults.length} results</strong> for "${escapeHtml(query)}" in app!`, "View Saved", () => {
      openSavedSearchesModal();
    });
  } catch (err) {
    console.error("Save search in app failed:", err);
    showToast(`Failed to save search: ${escapeHtml(err.message)}`);
  }
}

function openSavedSearchesModal() {
  fetchSavedSearches().then(() => {
    if (savedSearchesFilterInput) savedSearchesFilterInput.value = "";
    if (btnClearSavedFilter) btnClearSavedFilter.classList.add("hidden");
    renderSavedSearchesList("");
    if (savedSearchesModal) savedSearchesModal.classList.remove("hidden");
  });
}

function closeSavedSearchesModal() {
  if (savedSearchesModal) savedSearchesModal.classList.add("hidden");
}

function renderSavedSearchesList(filterText = "") {
  if (!savedSearchesList) return;
  savedSearchesList.innerHTML = "";

  const qLower = (filterText || "").toLowerCase().trim();
  const filtered = savedSearchesData.filter(item => {
    if (!qLower) return true;
    return (
      (item.query || "").toLowerCase().includes(qLower) ||
      (item.name || "").toLowerCase().includes(qLower) ||
      (item.root_path || "").toLowerCase().includes(qLower) ||
      (item.volume_name || "").toLowerCase().includes(qLower)
    );
  });

  if (filtered.length === 0) {
    savedSearchesList.innerHTML = `
      <div class="saved-empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3>${savedSearchesData.length === 0 ? "No Saved Searches Yet" : "No Matching Searches"}</h3>
        <p>${savedSearchesData.length === 0 ? "Run any filename or inside-files search and click <strong>Save in App</strong> to keep results handy here for instant review anytime." : "No saved searches matched your filter."}</p>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "saved-search-card";

    const isGrep = item.mode === "grep";
    const modeBadge = `<span class="saved-card-badge ${isGrep ? 'grep' : ''}">${isGrep ? 'Inside Files (Grep)' : 'Filename'}</span>`;
    const hasFilters = item.filters && Object.keys(item.filters).some(k => {
      const v = item.filters[k];
      if (k === "preset") return v && v !== "all";
      if (k === "itemType") return v && v !== "all";
      if (k === "sizePreset") return v && v !== "any";
      if (k === "dateModified") return v && v !== "any";
      return Boolean(v);
    });
    const filterBadge = hasFilters ? `<span class="saved-card-badge" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.4);">🎯 Filtered</span>` : "";
    const samples = (item.sample_matches && item.sample_matches.length > 0)
      ? `<div class="saved-card-samples" title="${escapeHtml(item.sample_matches.join(', '))}">Sample matches: ${escapeHtml(item.sample_matches.join(' · '))}</div>`
      : "";

    card.innerHTML = `
      <div class="saved-card-header">
        <div class="saved-card-title-group">
          <span class="saved-card-title">"${escapeHtml(item.query || item.name)}"</span>
          ${modeBadge}
          ${filterBadge}
          <span class="badge-count">${item.matches_count} ${item.matches_count === 1 ? 'match' : 'matches'}</span>
        </div>
      </div>
      <div class="saved-card-meta">
        <span class="saved-card-meta-item">📁 Scope: <code>${escapeHtml(item.root_path || '/')}</code></span>
        <span class="saved-card-meta-item">💾 Disk: <strong>${escapeHtml(item.volume_name || 'Linux Ext4')}</strong></span>
        <span class="saved-card-meta-item">🕒 ${escapeHtml(item.timestamp || '')}</span>
      </div>
      ${samples}
      <div class="saved-card-actions">
        <button class="btn btn-xs btn-primary-outline btn-load-saved" title="View these saved search results in the file explorer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          View in App
        </button>
        <button class="btn btn-xs btn-secondary btn-rerun-saved" title="Execute this search live on current drive">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Re-run Live
        </button>
        <button class="btn btn-xs btn-secondary btn-export-saved" title="Export this saved search report as .txt file">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Export (.txt)
        </button>
        <button class="btn btn-xs btn-danger-outline btn-delete-saved" title="Delete this saved search">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </button>
      </div>
    `;

    card.querySelector(".btn-load-saved").addEventListener("click", () => loadSavedSearchIntoExplorer(item.id));
    card.querySelector(".btn-rerun-saved").addEventListener("click", () => rerunSavedSearch(item.id));
    card.querySelector(".btn-export-saved").addEventListener("click", () => exportSavedSearchText(item.id));
    card.querySelector(".btn-delete-saved").addEventListener("click", () => deleteSavedSearch(item.id));

    savedSearchesList.appendChild(card);
  });
}

async function loadSavedSearchIntoExplorer(searchId) {
  try {
    const res = await fetch(`/api/saved-searches/${searchId}`);
    if (!res.ok) throw new Error("Could not load saved search");
    const item = await res.json();

    activeSavedSearch = item;
    currentSearchResults = item.results || [];
    currentSearchQuery = item.query || "";
    currentSearchMode = item.mode || "filename";
    currentSearchPath = item.root_path || "/";

    if (item.filters) {
      restoreSearchFilters(item.filters);
    }

    // Setup active banner
    if (savedSearchBanner) {
      if (savedBannerQuery) savedBannerQuery.textContent = `"${item.query || item.name}"`;
      if (savedBannerDetails) {
        savedBannerDetails.textContent = `${currentSearchResults.length} items · ${item.mode === 'grep' ? 'Inside Files' : 'Filename'} · ${item.volume_name || 'Linux Ext4'}`;
      }
      savedSearchBanner.classList.remove("hidden");
    }

    // Hide any active search progress
    showSearchProgress(false);

    // Populate search bar input for context
    searchInput.value = item.query || "";
    btnClearSearch.classList.remove("hidden");
    if (chkContentSearch) chkContentSearch.checked = (item.mode === "grep");
    if (chkDeepSearch) chkDeepSearch.checked = true;

    updateSaveSearchButton();
    renderSearchResults(currentSearchResults, currentSearchQuery, currentSearchMode);

    closeSavedSearchesModal();
    showToast(`Loaded saved results for <strong>${escapeHtml(item.query)}</strong> (${currentSearchResults.length} items)`);
  } catch (err) {
    console.error("Load saved search failed:", err);
    showToast(`Failed to load saved search: ${escapeHtml(err.message)}`);
  }
}

function exitSavedSearchView() {
  if (savedSearchBanner) savedSearchBanner.classList.add("hidden");
  activeSavedSearch = null;
  currentSearchResults = [];
  currentSearchQuery = "";
  currentSearchMode = "";
  searchInput.value = "";
  btnClearSearch.classList.add("hidden");
  updateSaveSearchButton();
  loadDirectory(currentPath || "/");
}

async function rerunSavedSearch(searchId) {
  try {
    const res = await fetch(`/api/saved-searches/${searchId}`);
    if (!res.ok) throw new Error("Could not load saved search");
    const item = await res.json();

    if (savedSearchBanner) savedSearchBanner.classList.add("hidden");
    activeSavedSearch = null;
    closeSavedSearchesModal();

    if (item.filters) {
      restoreSearchFilters(item.filters);
    }

    searchInput.value = item.query || "";
    btnClearSearch.classList.remove("hidden");
    if (chkContentSearch) chkContentSearch.checked = (item.mode === "grep");
    if (chkDeepSearch) chkDeepSearch.checked = true;

    executeSearch();
  } catch (err) {
    console.error("Rerun saved search failed:", err);
    showToast(`Failed to rerun search: ${escapeHtml(err.message)}`);
  }
}

async function exportSavedSearchText(searchId) {
  try {
    const res = await fetch(`/api/saved-searches/${searchId}`);
    if (!res.ok) throw new Error("Could not load saved search");
    const item = await res.json();

    const reportText = formatSearchResultsText(
      item.results || [],
      item.query || "results",
      item.mode || "filename",
      item.root_path || "/",
      item.volume_name || "Linux Ext4"
    );

    const safeQ = (item.query || "results").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 25);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `saved_search_${item.mode}_${safeQ}_${timestamp}.txt`;

    await downloadOrSaveText(filename, reportText);
  } catch (err) {
    console.error("Export saved search failed:", err);
    showToast(`Failed to export: ${escapeHtml(err.message)}`);
  }
}

async function deleteSavedSearch(searchId) {
  try {
    const res = await fetch(`/api/saved-searches/${searchId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete saved search");
    await fetchSavedSearches();
    const filterText = savedSearchesFilterInput ? savedSearchesFilterInput.value : "";
    renderSavedSearchesList(filterText);
    showToast("✓ Deleted saved search.");
  } catch (err) {
    console.error("Delete saved search failed:", err);
    showToast(`Failed to delete: ${escapeHtml(err.message)}`);
  }
}

async function clearAllSavedSearches() {
  if (!confirm("Are you sure you want to delete all saved searches from the app?")) return;
  try {
    const res = await fetch("/api/saved-searches", { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to clear saved searches");
    await fetchSavedSearches();
    renderSavedSearchesList("");
    showToast("✓ All saved searches cleared.");
  } catch (err) {
    console.error("Clear saved searches failed:", err);
    showToast(`Failed to clear: ${escapeHtml(err.message)}`);
  }
}

// -----------------------------------------------------------------------------
// Disk Index & Search Acceleration Feature
// -----------------------------------------------------------------------------

async function checkIndexStatus() {
  try {
    const res = await fetch("/api/index/status");
    if (!res.ok) return;
    const data = await res.json();

    if (!btnIndexDisk) return;

    if (data.indexed && data.stats) {
      const stats = data.stats;
      if (stats.is_complete) {
        if (indexDot) {
          indexDot.className = "index-dot";
        }
        if (indexStatusText) {
          indexStatusText.textContent = "⚡ Instant Search";
        }
        if (indexTag) {
          indexTag.textContent = stats.size_human || "Ready";
        }
        btnIndexDisk.title = `Index is active! ${stats.indexed_files.toLocaleString()} files indexed (${stats.size_human}). Searches execute in <5ms without touching disk. Click to re-index.`;
      } else {
        if (indexDot) {
          indexDot.className = "index-dot unindexed";
        }
        if (indexStatusText) {
          indexStatusText.textContent = "⚡ Fast Index Disk";
        }
        if (indexTag) {
          indexTag.textContent = stats.indexed_files > 0 ? `${stats.indexed_files} cached` : "Optimize";
        }
        btnIndexDisk.title = "Click to index disk metadata. Accelerates all future searches to <5ms with minimal space (~50B/file).";
      }
    }
  } catch (err) {
    console.warn("Failed to check index status:", err);
  }
}

async function startIndexingDisk() {
  if (isIndexingActive) return;
  isIndexingActive = true;
  indexingAbortController = new AbortController();

  if (indexDot) indexDot.className = "index-dot indexing";
  if (indexStatusText) indexStatusText.textContent = "Indexing Disk...";
  if (indexTag) indexTag.textContent = "Working";

  if (indexProgressPanel) indexProgressPanel.classList.remove("hidden");
  if (indexProgressBar) indexProgressBar.style.width = "10%";
  if (indexCountText) indexCountText.textContent = "0";
  if (indexCurrentDir) indexCurrentDir.textContent = "/";
  if (indexSpeedBadge) indexSpeedBadge.textContent = "0 files/s";
  if (indexSizeBadge) indexSizeBadge.textContent = "0 KB";
  if (indexTimeBadge) indexTimeBadge.textContent = "0.0s";

  try {
    const response = await fetch("/api/index/stream?path=/", {
      signal: indexingAbortController.signal
    });

    if (!response.ok) {
      throw new Error(`Indexing failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const ev = JSON.parse(jsonStr);

            if (ev.type === "progress") {
              if (indexCountText) indexCountText.textContent = ev.scanned.toLocaleString();
              if (indexSpeedBadge) indexSpeedBadge.textContent = `${Math.round(ev.speed)} files/s`;
              if (indexTimeBadge) indexTimeBadge.textContent = `${ev.elapsed.toFixed(1)}s`;
              if (indexSizeBadge && ev.db_size) indexSizeBadge.textContent = ev.db_size;
              if (indexCurrentDir && ev.current_dir) indexCurrentDir.textContent = ev.current_dir;
              if (indexProgressBar) {
                // Smooth progressive width based on scanned files
                const pct = Math.min(95, Math.max(15, Math.log10(ev.scanned + 1) * 22));
                indexProgressBar.style.width = `${pct}%`;
              }
            } else if (ev.type === "done") {
              if (indexProgressBar) indexProgressBar.style.width = "100%";
              if (indexCountText) indexCountText.textContent = ev.scanned.toLocaleString();
              if (indexSpeedBadge) indexSpeedBadge.textContent = `${Math.round(ev.speed)} files/s`;
              if (indexTimeBadge) indexTimeBadge.textContent = `${ev.elapsed.toFixed(1)}s`;
              if (indexSizeBadge && ev.stats) indexSizeBadge.textContent = ev.stats.size_human;

              showToast(`⚡ Disk Indexed! <strong>${ev.scanned.toLocaleString()} files</strong> ready for instant &lt;5ms searches (${ev.stats?.size_human || ""})`);

              setTimeout(() => {
                if (indexProgressPanel) indexProgressPanel.classList.add("hidden");
              }, 2500);

              await checkIndexStatus();
            } else if (ev.type === "error") {
              throw new Error(ev.error || "Indexing error");
            }
          } catch (pe) {
            // Ignore parse errors on partial frames
          }
        }
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Indexing failed:", err);
      showToast(`Disk indexing error: ${escapeHtml(err.message)}`);
    }
  } finally {
    isIndexingActive = false;
    indexingAbortController = null;
    await checkIndexStatus();
  }
}

function stopIndexingDisk() {
  if (indexingAbortController) {
    indexingAbortController.abort();
    indexingAbortController = null;
  }
  isIndexingActive = false;
  if (indexProgressPanel) indexProgressPanel.classList.add("hidden");
  checkIndexStatus();
  showToast("Indexing stopped. Preserved current progress.");
}


function showToast(messageHtml, actionLabel = null, onAction = null, duration = 5000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  const icon = document.createElement("div");
  icon.className = "toast-icon";
  icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>`;

  const msg = document.createElement("div");
  msg.className = "toast-msg";
  msg.innerHTML = messageHtml;

  toast.appendChild(icon);
  toast.appendChild(msg);

  if (actionLabel && onAction) {
    const actBtn = document.createElement("button");
    actBtn.className = "toast-action-btn";
    actBtn.textContent = actionLabel;
    actBtn.addEventListener("click", () => {
      onAction();
      actBtn.textContent = "Copied!";
      actBtn.style.background = "#10b981";
      actBtn.style.color = "#fff";
      actBtn.style.borderColor = "#10b981";
    });
    toast.appendChild(actBtn);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close-btn";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => dismiss());
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  let timer = setTimeout(() => dismiss(), duration);

  function dismiss() {
    clearTimeout(timer);
    toast.classList.add("toast-hiding");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }
}

// Start application
window.addEventListener("DOMContentLoaded", initApp);
