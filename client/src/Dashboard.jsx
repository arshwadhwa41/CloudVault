import "./index.css";
import { useRef, useState, useEffect, useMemo } from "react";
import API from "./services/api";
import { getFileThumbnail } from "./utils/thumbnailHelper";


function DashBoard({ user: initialUser, onLogout }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Theme State: Light mode default
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [user, setUser] = useState(initialUser || null);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [aiLensQuery, setAiLensQuery] = useState("");
  
  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareExpiryDays, setShareExpiryDays] = useState("7");
  const [generatedShareUrl, setGeneratedShareUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Single File Delete Confirmation Modal
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Selection & Bulk Actions State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [showBulkConfirmDelete, setShowBulkConfirmDelete] = useState(false);

  const [storageData, setStorageData] = useState({
    used: initialUser?.storageUsed || 0,
    quota: initialUser?.storageQuota || 524288000, // 500 MB in Bytes
  });

  // Dynamic Bytes Calculation from Loaded Files Array
  const calculatedUsedBytes = files.reduce(
    (acc, curr) => acc + Number(curr.size || 0),
    0,
  );

  // Standardized Storage Metrics
  const actualUsedBytes = Math.max(0, storageData.used || calculatedUsedBytes);
  const usedStorageMB = Math.max(0, actualUsedBytes / (1024 * 1024)).toFixed(2);
  const totalStorageMB = Math.max(
    1,
    Math.round((storageData.quota || 524288000) / (1024 * 1024)),
  );

  const availableStorageMB = Math.max(
    0,
    totalStorageMB - parseFloat(usedStorageMB),
  ).toFixed(1);

  const storagePercentage = Math.min(
    Math.max(0, (parseFloat(usedStorageMB) / totalStorageMB) * 100),
    100,
  );

  const isStorageWarningTriggered = storagePercentage >= 90;

  // Active User Profile Calculations
  const activeUser = user || initialUser;
  const displayName = activeUser?.name || "User";
  const displayEmail = activeUser?.email || "";
  const firstName = displayName.trim() ? displayName.split(" ")[0] : "User";
  const avatarLetter = firstName.charAt(0).toUpperCase();

  // Fetch Files and Storage Metrics
  const fetchDashboardData = async () => {
    try {
      const [filesRes, storageRes, meRes] = await Promise.all([
        API.get("/files"),
        API.get("/users/me/storage").catch(() => null),
        API.get("/auth/me").catch(() => null),
      ]);

      let loadedFiles = [];
      if (filesRes.data?.data?.files) {
        loadedFiles = filesRes.data.data.files;
      } else if (Array.isArray(filesRes.data)) {
        loadedFiles = filesRes.data;
      }
      setFiles(loadedFiles);

      const fileSumBytes = loadedFiles.reduce(
        (acc, f) => acc + Number(f.size || 0),
        0,
      );

      if (storageRes?.data?.data && storageRes.data.data.storageUsed >= 0) {
        setStorageData({
          used: Number(storageRes.data.data.storageUsed),
          quota: Number(storageRes.data.data.storageQuota) || 524288000,
        });
      } else {
        setStorageData((prev) => ({
          ...prev,
          used: fileSumBytes,
        }));
      }

      if (meRes?.data?.data?.user) {
        setUser(meRes.data.data.user);
      }
    } catch (error) {
      console.error("Data loading error:", error);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const allowedExtensions = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "pdf",
      "doc",
      "docx",
      "txt",
      "csv",
      "xlsx",
      "mp4",
      "mkv",
      "mov",
      "webm",
      "mp3",
      "wav",
      "zip",
      "rar",
      "7z",
    ];

    const validFiles = [];

    for (const file of selectedFiles) {
      const fileName = file.name;
      const fileExtension = fileName
        .substring(fileName.lastIndexOf(".") + 1)
        .toLowerCase();

      if (file.size === 0) {
        alert(`Error: "${fileName}" is empty (0 bytes). Skipping file.`);
        continue;
      }

      if (!allowedExtensions.includes(fileExtension)) {
        alert(
          `The .${fileExtension} file format is not supported. Skipping "${fileName}".`,
        );
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }

    try {
      setUploading(true);
      setUploadError("");

      for (const file of validFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "fileExtension",
          file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase(),
        );
        await API.post("/files/upload", formData);
      }

      await fetchDashboardData();
    } catch (error) {
      console.error("Upload Error:", error);
      setUploadError(
        error.response?.data?.message || error.message || "File upload failed.",
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDirectDownload = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName || "downloaded-file";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download Error:", err);
      window.open(fileUrl, "_blank");
    }
  };

  const confirmAndDeleteFile = async () => {
    if (!previewFile) return;
    const fileId = previewFile._id || previewFile.id;

    try {
      setDeleting(true);
      await API.delete(`/files/${fileId}`);

      setShowConfirmDelete(false);
      setPreviewFile(null);
      await fetchDashboardData();
    } catch (error) {
      console.error("Delete Error:", error);
    } finally {
      setDeleting(false);
    }
  };

  const toggleFileSelection = (id) => {
    setSelectedFileIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id],
    );
  };

  const handleCardClick = (file) => {
    const id = file._id || file.id;
    if (isSelectionMode) {
      toggleFileSelection(id);
    } else {
      setPreviewFile(file);
    }
  };

  const selectedFilesList = files.filter((f) =>
    selectedFileIds.includes(f._id || f.id),
  );
  const selectedTotalBytes = selectedFilesList.reduce(
    (sum, f) => sum + (f.size || 0),
    0,
  );
  const selectedTotalMB = (selectedTotalBytes / (1024 * 1024)).toFixed(2);

  const executeBulkDelete = async () => {
    try {
      setDeleting(true);
      await Promise.all(
        selectedFileIds.map((id) => API.delete(`/files/${id}`)),
      );
      setSelectedFileIds([]);
      setIsSelectionMode(false);
      setShowBulkConfirmDelete(false);
      await fetchDashboardData();
    } catch (error) {
      console.error("Bulk Delete Error:", error);
    } finally {
      setDeleting(false);
    }
  };

  const isImageFile = (url = "", name = "") =>
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name || url);
  const isVideoFile = (url = "", name = "") =>
    /\.(mp4|webm|ogg|mov|mkv)$/i.test(name || url);
  const isAudioFile = (url = "", name = "") =>
    /\.(mp3|wav|ogg|m4a)$/i.test(name || url);
  const isPdfFile = (url = "", name = "") => /\.(pdf)$/i.test(name || url);
  const isDocFile = (url = "", name = "") =>
    /\.(pdf|doc|docx|txt|csv|xlsx)$/i.test(name || url);
  const isArchiveFile = (url = "", name = "") =>
    /\.(zip|rar|7z|gz)$/i.test(name || url);

  // Dynamic Filtering Logic
  // =============================================================
  // DYNAMIC FILTERING LOGIC
  // =============================================================
  // IMPORTANT:
  // Purana filename + category filtering preserve kiya gaya hai.
  //
  // Naya AI Lens:
  // - Gemini ke generated `tags` array ko search karega.
  // - Natural language / partial words dono work karenge.
  // - AI Lens active hone par sirf image files show hongi.
  // - Agar match nahi mila to existing "No matching files found"
  //   state automatically show ho jayega.
  // =============================================================
  const filteredFiles = useMemo(() => {
    const normalizedAiQuery = aiLensQuery.trim().toLowerCase();
    const normalizedFileSearch = searchQuery.trim().toLowerCase();

    return files.filter((file) => {
      const fileName = (file.originalName || file.filename || "").toLowerCase();

      // -----------------------------------------------------------
      // 1. Existing filename search
      // -----------------------------------------------------------
      const matchesNormalSearch =
        !normalizedFileSearch || fileName.includes(normalizedFileSearch);

      if (!matchesNormalSearch) {
        return false;
      }

      // -----------------------------------------------------------
      // 2. AI IMAGE LENSE SEARCH
      // -----------------------------------------------------------
      // Gemini helper se normally tags array save ho raha hai:
      //
      // tags: [
      //   "red car",
      //   "honda",
      //   "sedan",
      //   "parking lot"
      // ]
      //
      // User agar "red car" ya "honda" search karega to matching
      // image card visible rahega.
      // -----------------------------------------------------------
      if (normalizedAiQuery) {
        const isImage = isImageFile(
          file.fileUrl || file.path,
          file.originalName || file.filename || "",
        );

        // AI Lens ka purpose visual/image search hai,
        // isliye query active hone par non-image files hide hongi.
        if (!isImage) {
          return false;
        }

        const fileTags = Array.isArray(file.tags) ? file.tags : [];

        // Tags ko normalize karke ek searchable string banate hain.
        const searchableTags = fileTags
          .map((tag) =>
            String(tag || "")
              .toLowerCase()
              .trim(),
          )
          .filter(Boolean);

        // Filename ko bhi include kar rahe hain.
        // Isse AI Lens kisi image ke filename ko bhi fallback
        // ke taur par search kar sakta hai.
        const searchableContent = [fileName, ...searchableTags];

        // Query ke words ko alag kar dete hain.
        // Example:
        // "red honda car"
        // -> ["red", "honda", "car"]
        const queryWords = normalizedAiQuery.split(/\s+/).filter(Boolean);

        // Har important word ko tags/filename ke andar search karo.
        const matchesAiSearch = queryWords.every((word) =>
          searchableContent.some((content) => content.includes(word)),
        );

        if (!matchesAiSearch) {
          return false;
        }
      }

      // -----------------------------------------------------------
      // 3. Existing Category Filter
      // -----------------------------------------------------------
      if (selectedCategory === "all") {
        return true;
      }

      if (selectedCategory === "images") {
        return isImageFile(file.fileUrl || file.path, fileName);
      }

      if (selectedCategory === "documents") {
        return isDocFile(file.fileUrl || file.path, fileName);
      }

      if (selectedCategory === "videos") {
        return isVideoFile(file.fileUrl || file.path, fileName);
      }

      if (selectedCategory === "audio") {
        return isAudioFile(file.fileUrl || file.path, fileName);
      }

      if (selectedCategory === "archives") {
        return isArchiveFile(file.fileUrl || file.path, fileName);
      }

      return true;
    });
  }, [files, searchQuery, selectedCategory, aiLensQuery]);

  // Share Link Generator Helper
  const handleGenerateShareLink = () => {
    if (!previewFile) return;
    const fileId = previewFile._id || previewFile.id;
    const expiryTimestamp =
      Date.now() + parseInt(shareExpiryDays, 10) * 86400000;
    const generatedToken = btoa(`${fileId}:${expiryTimestamp}`);
    const publicUrl = `${window.location.origin}/share/${fileId}?token=${generatedToken}&expires=${expiryTimestamp}`;

    setGeneratedShareUrl(publicUrl);
    setShowShareModal(true);
  };

  const handleCopyShareLink = () => {
    if (!generatedShareUrl) return;
    navigator.clipboard.writeText(generatedShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      className={`gemini-app-container ${isDarkMode ? "dark-theme" : "light-theme"}`}
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <div className="mesh-gradient-bg">
        <div className="gradient-blob blob-1"></div>
        <div className="gradient-blob blob-2"></div>
        <div className="gradient-blob blob-3"></div>
        <div className="gradient-blob blob-4"></div>
      </div>

      <main className="dashboard-wrapper">
        {/* Storage Quota Alert Banner */}
        {isStorageWarningTriggered && (
          <div className="storage-warning-banner" role="alert">
            <div className="warning-banner-content">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>
                <strong>Storage Capacity Warning:</strong> Your storage is over
                90% full ({usedStorageMB} MB / {totalStorageMB} MB used). Please
                delete unnecessary files to free up space.
              </span>
            </div>
          </div>
        )}

        <header className="gemini-header">
          <div className="brand-badge">
            <span className="brand-text">Cloud Vault</span>
          </div>

          <div className="header-user-profile">
            <div className="user-avatar-pill">
              <div className="avatar-circle">{avatarLetter}</div>
              <div className="user-details-mini">
                <span className="user-name-label">{displayName}</span>
                {displayEmail && (
                  <span className="user-email-label">{displayEmail}</span>
                )}
              </div>
            </div>

            <button
              className="theme-toggle-pill-btn"
              type="button"
              onClick={toggleTheme}
              title="Toggle Light/Dark Theme"
            >
              {isDarkMode ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            <button
              className="gemini-logout-btn"
              type="button"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <section className="gemini-hero">
          <div className="hero-text">
            <p className="gemini-chip">WORKSPACE</p>
            <h1>
              Welcome back,{" "}
              <span className="gemini-gradient-text">{firstName}</span>
            </h1>
            <br></br>
            <section className="ai-image-lens-section">
              <div className="ai-image-lens-box">
                {/* Gemini sparkle / AI icon */}
                <div className="ai-image-lens-icon" aria-hidden="true">
                  <svg
                    width="44"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3l1.45 4.55L18 9l-4.55 1.45L12 15l-1.45-4.55L6 9l4.55-1.45L12 3Z" />
                    <path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
                  </svg>
                </div>

                {/* Search input */}
                <input
                  type="text"
                  value={aiLensQuery}
                  onChange={(e) => setAiLensQuery(e.target.value)}
                  className="ai-image-lens-input"
                  placeholder="Search Image with Description"
                  aria-label="AI Image Lense search"
                />

                {/* Clear AI search button */}
                {aiLensQuery && (
                  <button
                    type="button"
                    className="ai-image-lens-clear"
                    onClick={() => setAiLensQuery("")}
                    aria-label="Clear AI image search"
                  >
                    ×
                  </button>
                )}

                {/* AI indicator */}
                <div className="ai-image-lens-badge">
                  <span className="ai-lens-pulse"></span>
                  AI
                </div>
              </div>

              {/* Small helper text */}
              <p className="ai-image-lens-hint">
                Describe what you're looking for and Gemini will search your
                visual vault.
              </p>
            </section>

            <p className="hero-subtext">
              Manage your assets, track remaining quota, and organize files
              securely.
            </p>
            {uploadError && <p className="upload-error-msg">{uploadError}</p>}
          </div>

          <button
            className="gemini-btn-primary"
            type="button"
            onClick={handleUploadClick}
            disabled={uploading}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading ? "Uploading..." : "Upload Files"}
          </button>
        </section>
        <section className="gemini-stats-grid">
          <div className="gemini-card storage-card-glass">
            <div className="card-header-flex">
              <span className="card-tag">Storage Engine</span>
            </div>

            <div className="storage-metric-row">
              <h2>{usedStorageMB} MB</h2>
              <span className="total-capacity">/ {totalStorageMB} MB</span>
            </div>

            <div className="gemini-progress-track">
              <div
                className={`gemini-progress-fill ${isStorageWarningTriggered ? "warning-fill" : ""}`}
                style={{ width: `${storagePercentage}%` }}
              />
            </div>

            <p className="card-footnote">{availableStorageMB} MB available</p>
          </div>

          <div className="gemini-card">
            <div className="card-header-flex">
              <span className="card-tag">Total Assets</span>
            </div>
            <h2 className="stat-number">{files.length}</h2>
            <p className="card-footnote">Total items stored in vault.</p>
          </div>

          <div className="gemini-card">
            <div className="card-header-flex">
              <span className="card-tag">Status</span>
            </div>
            <div className="status-indicator-wrapper">
              <span className="status-dot-pulse"></span>
              <span className="status-label">Active & Protected</span>
            </div>
            <p className="card-footnote">
              Encrypted cloud session operational.
            </p>
          </div>
        </section>

        <section className="gemini-library-section">
          <div className="library-header">
            <div>
              <p className="gemini-chip">FILE VAULT</p>
              <h3>Your Storage Library</h3>
            </div>

            <button
              className={`select-multiple-btn ${isSelectionMode ? "active-cancel" : ""}`}
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedFileIds([]);
              }}
            >
              {isSelectionMode ? "Cancel Selection" : "Select Multiple Files"}
            </button>
          </div>

          {/* Global Search & Format Filters Section */}
          <div className="vault-toolbar-container">
            <div className="vault-search-box">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search files by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="vault-search-input"
              />
              {searchQuery && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="vault-category-tabs">
              {[
                { id: "all", label: "All Assets" },
                { id: "images", label: "Images" },
                { id: "documents", label: "Documents" },
                { id: "videos", label: "Videos" },
                { id: "audio", label: "Audio" },
                { id: "archives", label: "Archives" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`category-tab-btn ${selectedCategory === tab.id ? "active-tab" : ""}`}
                  onClick={() => setSelectedCategory(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loadingFiles ? (
            <div className="loading-assets-text">Loading assets...</div>
          ) : filteredFiles.length === 0 ? (
            <div
              className="gemini-empty-state"
              style={{
                minHeight: "280px",
                width: "100%",
                padding: "3rem 1.5rem",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <div className="empty-icon-glow">+</div>
              <h4>
                {files.length === 0
                  ? "Your vault is completely empty"
                  : "No matching files found"}
              </h4>
              <p>
                {files.length === 0
                  ? "Upload files to sync them with your Cloud Vault workspace."
                  : "Try adjusting your search term or category filters."}
              </p>
              {files.length === 0 && (
                <button
                  className="gemini-btn-primary empty-upload-btn"
                  type="button"
                  onClick={handleUploadClick}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload first file"}
                </button>
              )}
            </div>
          ) : (
            <div className="vault-files-grid">
              {filteredFiles.map((file) => {
                const id = file._id || file.id;
                const fileName =
                  file.originalName || file.filename || "Untitled File";
                const fileUrl = file.fileUrl || file.path || "";
                const isSelected = selectedFileIds.includes(id);
                const thumbnail = getFileThumbnail(file);

                return (
                  <div
                    key={id}
                    onClick={() => handleCardClick(file)}
                    className={`vault-file-card ${isSelected ? "selected-translucent-blue" : ""}`}
                  >
                    {isSelectionMode && (
                      <div className="card-radio-overlay">
                        <input
                          type="radio"
                          checked={isSelected}
                          onChange={() => toggleFileSelection(id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

                    <div className="card-thumbnail-wrapper">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={fileName}
                          className="card-thumbnail-img"
                        />
                      ) : isVideoFile(fileUrl, fileName) ? (
                        <div className="thumbnail-fallback video-fallback">
                          <svg
                            width="45"
                            height="45"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect
                              x="1"
                              y="5"
                              width="15"
                              height="14"
                              rx="2"
                              ry="2"
                            />
                          </svg>
                          <p>VIDEO</p>
                        </div>
                      ) : isPdfFile(fileUrl, fileName) ? (
                        <div className="thumbnail-fallback pdf-fallback">
                          <svg
                            width="45"
                            height="45"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <p>PDF DOCUMENT</p>
                        </div>
                      ) : (
                        <div className="thumbnail-fallback file-fallback">
                          <svg
                            width="45"
                            height="45"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                          </svg>
                          <p>FILE</p>
                        </div>
                      )}
                    </div>

                    <div className="card-info-area">
                      <h4 className="file-card-name" title={fileName}>
                        {fileName}
                      </h4>

                      <div className="file-card-details">
                        <span>
                          {((file.size || 0) / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        <span>
                          {new Date(
                            file.uploadDate || file.createdAt || Date.now(),
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {isSelectionMode && selectedFileIds.length > 0 && (
          <div className="sticky-bottom-action-bar">
            <div className="sticky-bar-text">
              Selected <strong>{selectedFileIds.length}</strong> items (
              {selectedTotalMB} MB)
            </div>
            <button
              className="sticky-delete-all-btn"
              onClick={() => setShowBulkConfirmDelete(true)}
            >
              Delete All Selected
            </button>
          </div>
        )}

        {/* Media Preview Lightbox Modal */}
        {previewFile && (
          <div
            className="modal-lightbox-backdrop"
            onClick={() => {
              if (!showConfirmDelete && !showShareModal) setPreviewFile(null);
            }}
          >
            <div
              className="modal-adaptive-shell"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header-bar">
                <h3 title={previewFile.originalName || previewFile.filename}>
                  {previewFile.originalName || previewFile.filename}
                </h3>
                <button
                  className="modal-close-x"
                  onClick={() => setPreviewFile(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-media-fit-box">
                {isImageFile(
                  previewFile.fileUrl || previewFile.path,
                  previewFile.originalName,
                ) ? (
                  <img
                    src={previewFile.fileUrl || previewFile.path}
                    alt="Preview"
                    className="modal-fit-content"
                  />
                ) : isVideoFile(
                    previewFile.fileUrl || previewFile.path,
                    previewFile.originalName,
                  ) ? (
                  <video controls autoPlay className="modal-fit-content">
                    <source src={previewFile.fileUrl || previewFile.path} />
                    Your browser does not support video playback.
                  </video>
                ) : isPdfFile(
                    previewFile.fileUrl || previewFile.path,
                    previewFile.originalName,
                  ) ? (
                  <object
                    data={`${previewFile.fileUrl || previewFile.path}#toolbar=0&navpanes=0`}
                    type="application/pdf"
                    className="modal-fit-doc"
                  >
                    <div className="modal-fallback-text">
                      <p>PDF viewer unavailable in browser.</p>
                      <button
                        className="modal-blue-download-btn"
                        onClick={() =>
                          handleDirectDownload(
                            previewFile.fileUrl || previewFile.path,
                            previewFile.originalName,
                          )
                        }
                      >
                        Click to view / download PDF
                      </button>
                    </div>
                  </object>
                ) : (
                  <div className="modal-fallback-text">
                    <p>Direct preview is not available for this file type.</p>
                  </div>
                )}
              </div>

              <div className="modal-footer-bar">
                <span className="modal-size-text">
                  Size: {((previewFile.size || 0) / (1024 * 1024)).toFixed(2)}{" "}
                  MB
                </span>

                <div className="modal-buttons-group">
                  <button
                    className="modal-share-btn"
                    onClick={handleGenerateShareLink}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Share Link
                  </button>

                  <button
                    className="modal-red-delete-btn"
                    onClick={() => setShowConfirmDelete(true)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete File
                  </button>

                  <button
                    className="modal-blue-download-btn"
                    onClick={() =>
                      handleDirectDownload(
                        previewFile.fileUrl || previewFile.path,
                        previewFile.originalName || previewFile.filename,
                      )
                    }
                  >
                    Download Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share Link Modal */}
        {showShareModal && (
          <div className="modal-lightbox-backdrop backdrop-high-z">
            <div className="share-modal-box">
              <div className="modal-header-bar">
                <h4>Generate Public Share Link</h4>
                <button
                  className="modal-close-x"
                  onClick={() => setShowShareModal(false)}
                >
                  ✕
                </button>
              </div>

              <p className="share-modal-description">
                Anyone with this link can view and download this file directly
                without logging in.
              </p>

              <div className="share-expiry-picker">
                <label>Link Expiry Duration:</label>
                <select
                  value={shareExpiryDays}
                  onChange={(e) => {
                    setShareExpiryDays(e.target.value);
                    const fileId = previewFile._id || previewFile.id;
                    const expiryTimestamp =
                      Date.now() + parseInt(e.target.value, 10) * 86400000;
                    const generatedToken = btoa(`${fileId}:${expiryTimestamp}`);
                    setGeneratedShareUrl(
                      `${window.location.origin}/share/${fileId}?token=${generatedToken}&expires=${expiryTimestamp}`,
                    );
                  }}
                  className="expiry-dropdown"
                >
                  <option value="1">1 Day</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </div>

              <div className="share-url-box">
                <input
                  type="text"
                  readOnly
                  value={generatedShareUrl}
                  className="share-url-input"
                />
                <button className="copy-link-btn" onClick={handleCopyShareLink}>
                  {copiedLink ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showConfirmDelete && (
          <div className="modal-lightbox-backdrop backdrop-high-z">
            <div className="confirm-alert-box">
              <div className="confirm-alert-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              <h4>Delete this file?</h4>
              <p>
                This action cannot be undone. This file will be permanently
                removed from your Cloud Vault.
              </p>

              <div className="confirm-btn-row">
                <button
                  className="confirm-cancel-btn"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="confirm-delete-btn"
                  onClick={confirmAndDeleteFile}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkConfirmDelete && (
          <div className="modal-lightbox-backdrop backdrop-high-z">
            <div className="confirm-alert-box">
              <div className="confirm-alert-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              <h4>Delete Selected Files?</h4>
              <p>
                Are you sure {selectedFileIds.length} files and{" "}
                {selectedTotalMB} MB amount of storage is going to be deleted?
              </p>

              <div className="confirm-btn-row">
                <button
                  className="confirm-cancel-btn"
                  onClick={() => setShowBulkConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="confirm-delete-btn"
                  onClick={executeBulkDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete All"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default DashBoard;
