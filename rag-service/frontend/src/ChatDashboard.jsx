
import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiSend, FiSun, FiMoon, FiCpu } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import './dashboard.css';

export default function CloudVaultWorkspace() {

  // Saare required states initialize kar rahe hain
  const [darkMode, setDarkMode] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am CloudVault AI. Upload any PDF, Image, Audio, or Video file using the `+` button and ask me anything about it.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // File input ko programmatically access karne ke liye ref
  const fileInputRef = useRef(null);

  // Component load hone par purana session reset kar rahe hain
  useEffect(() => {
    const resetSessionOnLoad = async () => {
      try {
        const res = await fetch('/api/v1/upload/reset', { method: 'POST' });

        if (!res.ok) {
          console.warn("Session reset returned status:", res.status);
          return;
        }

        const data = await res.json();
        console.log("Session Reset Response:", data);

      } catch (err) {
        console.error("Failed to reset session database on load:", err);
      }
    };

    resetSessionOnLoad();
  }, []);

  // URL se aayi file ko automatically Vector DB mein ingest karwana
  useEffect(() => {
    const ingestFromUrl = async () => {

      // URL ke query parameters se fileUrl, fileName aur token extract kar rahe hain
      const params = new URLSearchParams(window.location.search);
      const fileUrl = params.get("fileUrl");
      const fileName = params.get("fileName") || "remote-file";
      const token = params.get("token");

      // Agar URL mein fileUrl nahi hai toh ingestion process stop kar denge
      if (!fileUrl) return;

      // URL se query params hata kar browser URL clean rakho
      window.history.replaceState({}, document.title, window.location.pathname);

      // Attached file ka naam update karke loading state enable kar rahe hain
      setAttachedFile(fileName);
      setLoading(true);

      // User ko batane ke liye message feed mein ingestion status add kar rahe hain
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `🔄 Fetching & ingesting **${fileName}** into Vector DB...`,
        },
      ]);

      try {

        // Backend API ko file URL aur filename bhejkar ingestion request kar rahe hain
        const res = await fetch("/api/v1/upload/from-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            file_url: fileUrl,
            filename: fileName,
          }),
        });

        // Backend se response JSON format mein receive kar rahe hain
        const data = await res.json();

        // Agar ingestion successful hai toh success message show kar rahe hain
        if (res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✅ **${fileName}** is ready! Ask me anything about it.`,
            },
          ]);

        } else {

          // Agar backend error return karta hai toh uska detail message show kar rahe hain
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ Failed to ingest **${fileName}**: ${data.detail || "Unknown error"}`,
            },
          ]);
        }

      } catch (err) {

        // Network ya fetch error aane par error message display kar rahe hain
        console.error("From-URL ingest error:", err);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "⚠️ Network error while ingesting file from URL.",
          },
        ]);

      } finally {

        // Process complete hone ke baad loading state disable kar rahe hain
        setLoading(false);
      }
    };

    // URL ingestion function execute kar rahe hain
    ingestFromUrl();

  }, []);

  // User ke manually file select karne par upload handler execute hoga
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];

    // Agar user ne koi file select nahi ki toh function stop kar do
    if (!file) return;

    // Selected file ko FormData mein append kar rahe hain
    const formData = new FormData();
    formData.append('file', file);

    // Upload process start hone par loading enable kar rahe hain
    setLoading(true);

    try {

      // File ko backend upload API par send kar rahe hain
      const res = await fetch('/api/v1/upload/', {
        method: 'POST',
        body: formData,
      });

      // Backend response ko JSON mein convert kar rahe hain
      const data = await res.json();

      // Upload successful hone par attached file update aur success message show kar rahe hain
      if (res.ok) {
        setAttachedFile(file.name);

        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ File **"${file.name}"** successfully uploaded & ingested into Vector DB!`
          }
        ]);

      } else {

        // Upload fail hone par backend ka error message alert mein show kar rahe hain
        alert(data.detail || "Upload failed");
      }

    } catch (err) {

      // Network error hone par console aur user ko error show kar rahe hain
      console.error("Upload error:", err);
      alert("Error uploading file.");

    } finally {

      // Upload complete hone ke baad loading disable kar rahe hain
      setLoading(false);
    }
  };

  // User ke chat query submit karne par backend se AI response fetch kar rahe hain
  const handleSendMessage = async (e) => {
    e.preventDefault();

    // Empty message submit hone se rok rahe hain
    if (!inputMessage.trim()) return;

    // User ke message ko temporary variable mein store kar rahe hain
    const userMsg = inputMessage;

    // Input field clear karke user message chat feed mein add kar rahe hain
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    // AI response generate hone tak loading enable kar rahe hain
    setLoading(true);

    try {

      // User ki query backend chat API ko send kar rahe hain
      const res = await fetch('/api/v1/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg,
          n_results: 3
        })
      });

      // Backend se AI response receive kar rahe hain
      const data = await res.json();

      // Successful response hone par AI ka answer chat feed mein add kar rahe hain
      if (res.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.response }
        ]);

      } else {

        // Backend error hone par error message display kar rahe hain
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: "⚠️ Error getting response from server."
          }
        ]);
      }

    } catch (err) {

      // Network failure hone par error message display kar rahe hain
      console.error("Chat error:", err);

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "⚠️ Network error occurred."
        }
      ]);

    } finally {

      // Chat request complete hone ke baad loading disable kar rahe hain
      setLoading(false);
    }
  };

  // Main UI render kar rahe hain
  return (
    <div className="gemini-app-container" data-theme={darkMode ? 'dark' : 'light'}>

      {/* Background mesh gradients create kar rahe hain */}
      <div className="mesh-gradient-bg">
        <div className="gradient-blob blob-1"></div>
        <div className="gradient-blob blob-2"></div>
        <div className="gradient-blob blob-3"></div>
      </div>

      {/* Top navbar mein branding aur navigation actions show kar rahe hain */}
      <header className="gemini-navbar-header">
        <div className="navbar-brand">
          <div className="brand-icon">
            <FiCpu />
          </div>

          <div>
            <h1>CloudVault AI <span className="badge">Advanced RAG</span></h1>
            <p>Multi-Modal Hybrid Workspace</p>
          </div>
        </div>

        {/* Theme toggle aur login/signup buttons render kar rahe hain */}
        <div className="navbar-actions">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="icon-btn"
            title="Toggle Theme"
          >
            {darkMode
              ? <FiSun style={{ color: '#fbbf24' }} />
              : <FiMoon style={{ color: '#475569' }} />
            }
          </button>

          <div className="divider" />

          <button className="nav-btn-outline">Login</button>
          <button className="nav-btn-primary">Sign Up</button>
        </div>
      </header>

      {/* Main workspace mein chat feed aur input section display kar rahe hain */}
      <main className="dashboard-wrapper">
        <div className="chat-feed">

          {/* Welcome banner mein user greeting aur session status show kar rahe hain */}
          <div className="welcome-banner">
            <h2>Hello, Arsh. What can we explore today?</h2>
            <p>Hybrid RAG active session is synchronized with your vector database.</p>
          </div>

          {/* Agar koi file attached hai toh uska naam display kar rahe hain */}
          {attachedFile && (
            <div
              style={{
                background: 'rgba(155, 81, 224, 0.1)',
                padding: '8px 16px',
                borderRadius: '12px',
                color: '#9b51e0',
                fontSize: '0.85rem',
                fontWeight: '600',
                width: 'fit-content',
                margin: '0 auto'
              }}
            >
              📎 Attached File: {attachedFile}
            </div>
          )}

          {/* Messages feed mein user aur assistant ke messages render kar rahe hain */}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message-row ${msg.role === 'user' ? 'user-row' : 'ai-row'}`}
            >

              {/* Assistant message ke liye AI avatar show kar rahe hain */}
              {msg.role === 'assistant' && (
                <div className="ai-avatar">
                  <FiCpu />
                </div>
              )}

              {/* Role ke according message bubble aur content display kar rahe hain */}
              <div className={msg.role === 'user' ? 'user-bubble' : 'chat-message-ai'}>
                {msg.role === 'assistant' ? (
                  <div className="prose max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {/* User message ke liye user avatar show kar rahe hain */}
              {msg.role === 'user' && (
                <div className="user-avatar">AW</div>
              )}
            </div>
          ))}

          {/* API request ya ingestion process chalne par loading indicator show kar rahe hain */}
          {loading && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                fontSize: '0.9rem'
              }}
            >
              CloudVault AI is thinking & retrieving context...
            </div>
          )}

        </div>

        {/* Floating input form se file upload aur chat query submit kar rahe hain */}
        <form onSubmit={handleSendMessage} className="floating-input-container">

          {/* Hidden file input ko ref ke through access kar rahe hain */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <div className="input-card">

            {/* Plus button click hone par file selection dialog open kar rahe hain */}
            <button
              type="button"
              className="chat-add-btn"
              onClick={() => fileInputRef.current.click()}
              title="Upload File"
            >
              <FiPlus />
            </button>

            {/* User se chat query input le rahe hain */}
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask anything about your uploaded file..."
            />

            {/* Send button click hone par chat query submit kar rahe hain */}
            <button
              type="submit"
              className="chat-send-btn"
              title="Send Query"
            >
              <FiSend />
            </button>
          </div>

          {/* Footer mein application ki processing information show kar rahe hain */}
          <p className="footer-note">
            CloudVault AI processes multi-modal queries securely with vector embeddings.
          </p>
        </form>

      </main>
    </div>
  );
}
