import React, { useState, useEffect } from "react";
import axios from "axios";
import "./CompressionService.css";

const CompressionService = () => {
  // ------------------------------------------------------------
  // Query Parameters parsing and token synchronization
  // ------------------------------------------------------------
  const queryParams = new URLSearchParams(window.location.search);

  const rawFileUrl = queryParams.get("fileUrl");
  const rawFileName = queryParams.get("fileName");

  const cloudFileUrl =
    rawFileUrl && rawFileUrl !== "undefined" ? rawFileUrl : null;
  const cloudFileName =
    rawFileName && rawFileName !== "undefined" ? rawFileName : null;
  const urlToken = queryParams.get("token");

  // ------------------------------------------------------------
  // State Management Hooks
  // ------------------------------------------------------------
  const [selectedFile, setSelectedFile] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [compressedBlob, setCompressedBlob] = useState(null);

  // Theme state (Dark / Light Mode)
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Modal output preference options
  const [downloadLocal, setDownloadLocal] = useState(true);
  const [saveToCloud, setSaveToCloud] = useState(false);

  // Custom Success Notification States
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // ------------------------------------------------------------
  // Sync Authentication Token from URL to LocalStorage
  // ------------------------------------------------------------
  useEffect(() => {
    if (urlToken) {
      localStorage.setItem("token", urlToken);
      console.log(
        "Authentication token successfully synced from URL parameters.",
      );
    }
  }, [urlToken]);

  // ------------------------------------------------------------
  // Target Filename Resolution
  // ------------------------------------------------------------
  const hasCloudFile =
    cloudFileUrl && cloudFileUrl !== "undefined" && cloudFileUrl !== "null";
  const targetFileName =
    selectedFile?.name ||
    (hasCloudFile ? cloudFileName : null) ||
    "compressed-asset.jpg";

  // ------------------------------------------------------------
  // Local File Selection Handler
  // ------------------------------------------------------------
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // ------------------------------------------------------------
  // Cloudinary RAW URL Cleanup Logic
  // ------------------------------------------------------------
  const cleanCloudinaryRawUrl = (url) => {
    if (!url || !url.includes("/raw/upload/")) {
      return url;
    }

    try {
      const parsedUrl = new URL(url);
      const marker = "/raw/upload/";
      const markerIndex = parsedUrl.pathname.indexOf(marker);

      if (markerIndex === -1) {
        return url;
      }

      const prefix = parsedUrl.pathname.slice(0, markerIndex + marker.length);
      const afterUpload = parsedUrl.pathname.slice(markerIndex + marker.length);
      const parts = afterUpload.split("/").filter(Boolean);
      const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));

      if (versionIndex > 0) {
        parsedUrl.pathname = prefix + parts.slice(versionIndex).join("/");
        return parsedUrl.toString();
      }

      const knownTransformation =
        /^(pg_\d+|w_\d+|h_\d+|c_[a-z_]+)(,(pg_\d+|w_\d+|h_\d+|c_[a-z_]+))*$/;

      if (parts.length > 1 && knownTransformation.test(parts[0])) {
        parsedUrl.pathname = prefix + parts.slice(1).join("/");
        return parsedUrl.toString();
      }

      return url;
    } catch (error) {
      console.warn("Cloudinary URL cleanup failed:", error);
      return url;
    }
  };

  // ------------------------------------------------------------
  // Compression Handler Integration
  // ------------------------------------------------------------
  const handleCompress = async () => {
    if (!selectedFile && !cloudFileUrl) {
      alert("Please select a file available locally or from Cloud Vault.");
      return;
    }

    setIsCompressing(true);

    try {
      const formData = new FormData();

      if (selectedFile) {
        formData.append("file", selectedFile);
      } else if (cloudFileUrl) {
        const targetCloudUrl = cleanCloudinaryRawUrl(cloudFileUrl);
        const res = await fetch(targetCloudUrl);

        if (!res.ok) {
          throw new Error(
            `Cloud file download failed (${res.status} ${res.statusText})`,
          );
        }

        const blob = await res.blob();
        const ext = cloudFileName
          ? cloudFileName.includes(".")
            ? cloudFileName.split(".").pop()
            : "bin"
          : "bin";

        const uploadName = cloudFileName || `cloud-file.${ext}`;
        formData.append("file", blob, uploadName);
      }

      const COMPRESSION_API_URL =
        import.meta.env.VITE_COMPRESSION_API_URL ||
        "https://cloud-vault-compression-service.onrender.com";

      const response = await axios.post(
        `${COMPRESSION_API_URL}/api/micro/compress`,
        formData,
        {
          responseType: "blob",
        },
      );

      setCompressedBlob(response.data);
      setIsCompressing(false);
      setShowResultModal(true);
    } catch (err) {
      console.error("Compression Error:", err);
      setIsCompressing(false);
      alert(
        "Compression failed! Make sure microservice backend on port 5001 is running.",
      );
    }
  };

  // ------------------------------------------------------------
  // Final Modal Submit Handler (Local Download & Cloud Vault Sync)
  // ------------------------------------------------------------
  const handleModalSubmit = async () => {
    if (!compressedBlob) {
      throw new Error("Compressed file is missing.");
    }

    let localDownloaded = false;
    let cloudSaved = false;

    if (downloadLocal) {
      const url = window.URL.createObjectURL(compressedBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `compressed_${targetFileName}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      localDownloaded = true;
    }

    if (saveToCloud) {
      try {
        const token = localStorage.getItem("token") || urlToken;

        if (!token) {
          throw new Error("Authentication token missing. Please login again.");
        }

        if (!compressedBlob || compressedBlob.size === 0) {
          throw new Error("Compressed file is empty or missing.");
        }

        const uploadName = `compressed_${targetFileName || "compressed-file"}`;
        const cloudFormData = new FormData();
        cloudFormData.append("file", compressedBlob, uploadName);

        const MAIN_API_URL =
          import.meta.env.VITE_API_URL ||
          "https://cloud-vault-vpax.onrender.com";

        const uploadResponse = await axios.post(
          `${MAIN_API_URL}/api/files/upload`,
          cloudFormData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        console.log("Cloud Vault Upload Success:", uploadResponse.data);
        cloudSaved = true;
      } catch (err) {
        console.error("Cloud Vault Upload Error:", err);
        if (err.response) {
          throw new Error(
            `Cloud Vault upload failed. Status: ${err.response.status}`,
          );
        }
        if (err.request) {
          throw new Error(
            "Cloud Vault backend did not respond. Make sure main backend is running on port 5000.",
          );
        }
        throw new Error(err.message || "Cloud Vault upload failed.");
      }
    }

    let resultMessage = "";
    if (localDownloaded && cloudSaved) {
      resultMessage =
        "Compressed file downloaded locally and synchronized with Cloud Vault successfully.";
    } else if (localDownloaded) {
      resultMessage = "Compressed file downloaded locally successfully.";
    } else if (cloudSaved) {
      resultMessage = "Compressed file saved to Cloud Vault successfully.";
    } else {
      resultMessage =
        "Compression completed successfully. No output action was selected.";
    }

    setShowResultModal(false);
    return resultMessage;
  };

  // ------------------------------------------------------------
  // Confirm Options Wrapper
  // ------------------------------------------------------------
  const onConfirmOptions = async () => {
    try {
      const msg = await handleModalSubmit();
      setSuccessMessage(
        msg || "File compressed and stored in Cloud Vault successfully!",
      );
      setShowSuccessPopup(true);
    } catch (err) {
      console.error("Compression Error:", err);
      alert("Compression Error: " + err.message);
    }
  };

  // ------------------------------------------------------------
  // Navigation Handlers
  // ------------------------------------------------------------
  const goToDashboard = () => {
    const FRONTEND_URL =
      import.meta.env.VITE_FRONTEND_URL ||
      "https://cloud-vault-vpax.onrender.com";
    window.location.href = FRONTEND_URL;
  };

  const goToLogin = () => {
    const FRONTEND_URL =
      import.meta.env.VITE_FRONTEND_URL ||
      "https://cloud-vault-vpax.onrender.com";
    window.location.href = `${FRONTEND_URL}/login`;
  };

  // ------------------------------------------------------------
  // UI Render Layout
  // ------------------------------------------------------------
  return (
    <div
      className={`compress-page-wrapper ${isDarkMode ? "dark-theme" : "light-theme"}`}
    >
      {/* Dynamic Gemini Mesh Background Auras */}
      <div className="gemini-aura-1"></div>
      <div className="gemini-aura-2"></div>
      <div className="gemini-aura-3"></div>

      {/* Main Scrollable Wrapper */}
      <div className="compress-scrollable-container">
        {/* Top Header Navbar */}
        <header className="dashboard-top-nav">
          <div className="brand-logo-area">
            <span className="logo-icon-box">CV</span>
            <span className="brand-title">CloudVault</span>
          </div>

          <div className="nav-controls-group">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="theme-toggle-btn"
              title="Toggle Dark/Light Mode"
            >
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </button>
            <button onClick={goToLogin} className="auth-nav-btn">
              Login / Sign Up
            </button>
          </div>
        </header>

        {/* Promotional Banner Section */}
        <div className="promo-banner-card">
          <div className="promo-banner-content">
            <span className="promo-badge">Next-Gen Storage Ecosystem</span>
            <h2>Secure, AI-Powered Cloud Storage with Free Generous Quota</h2>
            <p>
              Experience advanced file compression, zero-knowledge encryption,
              and intelligent multimodal asset search built for high-performance
              workflows.
            </p>
          </div>
          <div className="promo-banner-actions">
            <button onClick={goToLogin} className="auth-highlight-btn">
              Get Started Free
            </button>
          </div>
        </div>

        {/* Core Microservice Split Workspace */}
        <div className="gemini-card-container">
          {/* Left Hero Sidebar */}
          <div className="hero-sidebar">
            <div>
              <span className="sidebar-badge">
                Standalone Microservice Node
              </span>
              <h1 className="hero-title">
                Smart File <br />
                Compression Engine.
              </h1>
              <p className="hero-subtitle">
                Asynchronously process heavy images, media matrices, and large
                documents without draining main server bandwidth.
              </p>
            </div>

            <div className="feature-pills">
              <div className="pill-item">
                <span className="pill-check">✓</span>
                <span>Lossless Bitrate Optimization</span>
              </div>
              <div className="pill-item">
                <span className="pill-check">✓</span>
                <span>Direct Cloud Vault Pipeline</span>
              </div>
              <div className="pill-item">
                <span className="pill-check">✓</span>
                <span>Secure JWT Interceptors</span>
              </div>
            </div>
          </div>

          {/* Right Action & Preview Panel */}
          <div className="main-content-panel">
            <div>
              <div className="panel-top-bar">
                <button onClick={goToDashboard} className="back-dash-btn">
                  Return to Dashboard
                </button>
              </div>

              {/* Dedicated File Preview & Asset Card Area */}
              <div className="asset-preview-card">
                <div className="preview-card-header">
                  <span className="preview-label">Active Target Asset</span>
                  <span className="preview-status-indicator">
                    {selectedFile || hasCloudFile
                      ? "Ready for Processing"
                      : "Awaiting Selection"}
                  </span>
                </div>

                <div className="preview-card-body">
                  <div className="file-thumbnail-icon">
                    {selectedFile
                      ? selectedFile.name.split(".").pop().toUpperCase()
                      : "FILE"}
                  </div>
                  <div className="file-meta-info">
                    <p className="file-name-text">
                      {selectedFile
                        ? selectedFile.name
                        : hasCloudFile
                          ? cloudFileName
                          : "No asset loaded in compression buffer"}
                    </p>
                    <p className="file-size-text">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(2)} KB • Local Buffer`
                        : hasCloudFile
                          ? "Cloud Vault Synchronized Asset"
                          : "Select from local system or dashboard"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Local File Selection Component */}
              <div className="dropzone-wrapper">
                <label className="dropzone-label">
                  Upload or replace source file from local system:
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="file-input-custom"
                />
              </div>
            </div>

            {/* Compression Trigger Action Button */}
            <button
              onClick={handleCompress}
              disabled={(!selectedFile && !cloudFileUrl) || isCompressing}
              className="compress-action-btn"
            >
              {isCompressing
                ? "Executing Deep Compression..."
                : "Compress Asset Now"}
            </button>
          </div>
        </div>

        {/* Secondary Feature Showcase Grid */}
        <div className="trust-showcase-section">
          <div className="trust-card">
            <div className="trust-icon-box">AI</div>
            <h3>Intelligent Vision Indexing</h3>
            <p>
              Automated content analysis and deep contextual asset
              categorization powered by Google Gemini.
            </p>
          </div>
          <div className="trust-card">
            <div className="trust-icon-box">SEC</div>
            <h3>Military-Grade Encryption</h3>
            <p>
              End-to-end cryptographic security ensuring complete
              confidentiality for all uploaded files.
            </p>
          </div>
          <div className="trust-card">
            <div className="trust-icon-box">CDN</div>
            <h3>Lightning-Fast Delivery</h3>
            <p>
              Global edge distribution networks delivering instantaneous media
              preview and download speeds.
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================
          STEP 1: RESULT OPTIONS MODAL
          ====================================================== */}
      {showResultModal && !showSuccessPopup && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header-icon success-check">✓</div>
            <h2 className="modal-title-text">Compression Completed</h2>
            <p className="modal-desc-text">
              Select your preferred output handling parameters for the optimized
              asset.
            </p>

            <div className="modal-options-bg">
              <label className="custom-checkbox-row">
                <input
                  type="checkbox"
                  checked={downloadLocal}
                  onChange={(e) => setDownloadLocal(e.target.checked)}
                />
                Download optimized copy locally
              </label>

              <label className="custom-checkbox-row">
                <input
                  type="checkbox"
                  checked={saveToCloud}
                  onChange={(e) => setSaveToCloud(e.target.checked)}
                />
                Save copy back to Cloud Vault
              </label>
            </div>

            <button onClick={onConfirmOptions} className="modal-primary-btn">
              Confirm & Finalize
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          STEP 2: CUSTOM SUCCESS NOTIFICATION MODAL
          ====================================================== */}
      {showSuccessPopup && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header-icon success-check">✓</div>
            <h2 className="modal-title-text">Operation Successful</h2>
            <p className="modal-desc-text">{successMessage}</p>

            <button onClick={goToDashboard} className="modal-primary-btn">
              Done & Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompressionService;
