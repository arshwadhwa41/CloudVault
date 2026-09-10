import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import { GoogleLogin } from "@react-oauth/google";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function App() {
  // mode: "login" | "register" | "forgot" | "reset"
  const [mode, setMode] = useState("login");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    newPassword: "",
  });

  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // =========================================================
  // INITIAL AUTH CHECKS
  // Email Verification + Password Reset + Existing Session
  // =========================================================

  useEffect(() => {
    async function initAuthChecks() {
      const queryParams = new URLSearchParams(window.location.search);

      const verifyToken = queryParams.get("token");
      const rToken = queryParams.get("resetToken");

      // -------------------------------------------------------
      // 1. Email Verification URL Handler
      // -------------------------------------------------------

      if (verifyToken) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(
              verifyToken,
            )}`,
          );

          const data = await response.json();

          if (data.success) {
            setMessage(
              data.message || "Email verified successfully!",
            );
            setErrorMessage("");
            setMode("login");
          } else {
            setErrorMessage(
              data.message || "Email verification failed.",
            );
            setMessage("");
          }
        } catch (error) {
          console.error("Email verification error:", error);

          setErrorMessage(
            "Verification failed. Please try again.",
          );
          setMessage("");
        } finally {
          // Remove token from URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }

      // -------------------------------------------------------
      // 2. Password Reset URL Handler
      // -------------------------------------------------------

      if (rToken) {
        setResetToken(rToken);
        setMode("reset");

        // Remove reset token from URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }

      // -------------------------------------------------------
      // 3. Existing User Session Check
      // -------------------------------------------------------

      const token = localStorage.getItem("token");

      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/auth/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          localStorage.removeItem("token");
          setIsCheckingAuth(false);
          return;
        }

        const data = await response.json();

        setUser(data.data.user);
      } catch (error) {
        console.error("Auth check error:", error);
        localStorage.removeItem("token");
      } finally {
        setIsCheckingAuth(false);
      }
    }

    initAuthChecks();
  }, []);

  // =========================================================
  // INPUT CHANGE
  // =========================================================

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));

    setMessage("");
    setErrorMessage("");
  }

  // =========================================================
  // MODE CHANGE
  // =========================================================

  function handleModeChange(nextMode) {
    setMode(nextMode);

    setFormData({
      name: "",
      email: "",
      password: "",
      newPassword: "",
    });

    setShowPassword(false);
    setMessage("");
    setErrorMessage("");
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  function handleLogout() {
    localStorage.removeItem("token");

    setUser(null);
    setMode("login");

    setFormData({
      name: "",
      email: "",
      password: "",
      newPassword: "",
    });

    setShowPassword(false);
    setMessage("");
    setErrorMessage("");
  }

  // =========================================================
  // GOOGLE LOGIN SUCCESS
  // =========================================================

  async function handleGoogleSuccess(credentialResponse) {
    setIsLoading(true);
    setErrorMessage("");
    setMessage("");

    try {
      if (!credentialResponse?.credential) {
        throw new Error(
          "Google authentication credential was not received.",
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/api/auth/google`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: credentialResponse.credential,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Google Sign-In failed",
        );
      }

      const token = data.data?.token;

      if (!token) {
        throw new Error(
          "Google login token was not received.",
        );
      }

      localStorage.setItem("token", token);

      setUser(data.data.user);

      setMessage(
        `Welcome back, ${data.data?.user?.name || "there"}.`,
      );
    } catch (error) {
      console.error("Google login error:", error);

      setErrorMessage(
        error.message ||
          "Google login was unsuccessful. Try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  // =========================================================
  // FORM SUBMIT
  // =========================================================

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

    // -------------------------------------------------------
    // Frontend Password Validation - Register
    // -------------------------------------------------------

    if (
      mode === "register" &&
      !passwordRegex.test(formData.password)
    ) {
      setErrorMessage(
        "Password must be at least 8 characters long, contain 1 uppercase, 1 number, and 1 special character.",
      );
      return;
    }

    // -------------------------------------------------------
    // Frontend Password Validation - Reset
    // -------------------------------------------------------

    if (
      mode === "reset" &&
      !passwordRegex.test(formData.newPassword)
    ) {
      setErrorMessage(
        "New Password must be at least 8 characters long, contain 1 uppercase, 1 number, and 1 special character.",
      );
      return;
    }

    setIsLoading(true);

    let endpoint = `${API_BASE_URL}/api/auth/login`;
    let requestBody = {};

    // -------------------------------------------------------
    // Login
    // -------------------------------------------------------

    if (mode === "login") {
      endpoint = `${API_BASE_URL}/api/auth/login`;

      requestBody = {
        email: formData.email,
        password: formData.password,
      };
    }

    // -------------------------------------------------------
    // Register
    // -------------------------------------------------------

    else if (mode === "register") {
      endpoint = `${API_BASE_URL}/api/auth/register`;

      requestBody = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };
    }

    // -------------------------------------------------------
    // Forgot Password
    // -------------------------------------------------------

    else if (mode === "forgot") {
      endpoint = `${API_BASE_URL}/api/auth/forgot-password`;

      requestBody = {
        email: formData.email,
      };
    }

    // -------------------------------------------------------
    // Reset Password
    // -------------------------------------------------------

    else if (mode === "reset") {
      endpoint = `${API_BASE_URL}/api/auth/reset-password`;

      requestBody = {
        token: resetToken,
        newPassword: formData.newPassword,
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Something went wrong",
        );
      }

      // -------------------------------------------------------
      // Register Success
      // -------------------------------------------------------

      if (mode === "register") {
        setMessage(
          data.message ||
            "Account created! Please check your email to verify.",
        );

        setMode("login");
        return;
      }

      // -------------------------------------------------------
      // Forgot Password Success
      // -------------------------------------------------------

      if (mode === "forgot") {
        setMessage(
          data.message ||
            "If an account exists with this email, a reset link has been sent.",
        );
        return;
      }

      // -------------------------------------------------------
      // Reset Password Success
      // -------------------------------------------------------

      if (mode === "reset") {
        setMessage(
          data.message ||
            "Password updated successfully. You can now login.",
        );

        setMode("login");
        setResetToken("");

        return;
      }

      // -------------------------------------------------------
      // Login Success
      // -------------------------------------------------------

      const token = data.data?.token;

      if (!token) {
        throw new Error("Login token not received");
      }

      localStorage.setItem("token", token);

      setUser(data.data.user);

      setMessage(
        `Welcome back, ${data.data?.user?.name || "there"}.`,
      );
    } catch (error) {
      console.error("Authentication error:", error);

      setErrorMessage(
        error.message || "Something went wrong.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  // =========================================================
  // SESSION CHECK LOADING SCREEN
  // =========================================================

  if (isCheckingAuth) {
    return (
      <main className="auth-page">
        <div className="bg-glow glow-top-left"></div>
        <div className="bg-glow glow-top-right"></div>
        <div className="bg-glow glow-bottom-right"></div>

        <div className="session-loading">
          Checking your Cloud Vault session...
        </div>
      </main>
    );
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  if (user) {
    return (
      <Dashboard
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  // =========================================================
  // AUTH PAGE
  // =========================================================

  return (
    <main className="auth-page">
      <div className="bg-glow glow-top-left"></div>
      <div className="bg-glow glow-top-right"></div>
      <div className="bg-glow glow-bottom-right"></div>

      <section className="auth-shell">
        {/* ===================================================
            BRAND PANEL
        =================================================== */}

        <div className="auth-brand-panel">
          <p className="eyebrow">CLOUD VAULT</p>

          <h1>
            Keep every important file within reach.
          </h1>

          <p className="brand-description">
            Securely organize, preview, and manage your
            digital assets from one clean workspace.
          </p>

          <div className="brand-stat-row">
            <div>
              <strong>500 MB</strong>
              <span>Starter storage</span>
            </div>

            <div>
              <strong>Secure</strong>
              <span>Private workspace</span>
            </div>
          </div>
        </div>

        {/* ===================================================
            FORM PANEL
        =================================================== */}

        <div className="auth-form-panel">
          <div className="auth-heading">
            <p className="eyebrow blue-eyebrow">
              {mode === "login"
                ? "WELCOME BACK"
                : mode === "register"
                  ? "GET STARTED"
                  : mode === "forgot"
                    ? "RECOVERY"
                    : "SECURITY"}
            </p>

            <h2>
              {mode === "login"
                ? "Sign in to your account"
                : mode === "register"
                  ? "Create your account"
                  : mode === "forgot"
                    ? "Forgot your password?"
                    : "Set a new password"}
            </h2>

            <p>
              {mode === "login"
                ? "Access your personal digital asset workspace."
                : mode === "register"
                  ? "Start managing your files in one secure place."
                  : mode === "forgot"
                    ? "Enter your registered email to receive a password reset link."
                    : "Create a strong new password for your account."}
            </p>
          </div>

          {/* =================================================
              LOGIN / REGISTER TABS
          ================================================= */}

          {(mode === "login" || mode === "register") && (
            <div className="auth-tabs">
              <button
                type="button"
                className={
                  mode === "login"
                    ? "active-tab"
                    : ""
                }
                onClick={() =>
                  handleModeChange("login")
                }
              >
                Login
              </button>

              <button
                type="button"
                className={
                  mode === "register"
                    ? "active-tab"
                    : ""
                }
                onClick={() =>
                  handleModeChange("register")
                }
              >
                Create account
              </button>
            </div>
          )}

          {/* =================================================
              AUTH FORM
          ================================================= */}

          <form
            className="auth-form"
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            {/* Hidden dummy inputs to prevent browser force-autofill */}
            <input type="text" name="prevent_autofill" style={{ display: 'none' }} tabIndex={-1} />
            <input type="password" name="prevent_autofill_pwd" style={{ display: 'none' }} tabIndex={-1} />

            {/* Full Name */}
            {mode === "register" && (
              <label>
                Full name

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  minLength="2"
                  maxLength="80"
                  required
                  autoComplete="off"
                />
              </label>
            )}

            {/* Email */}
            {(mode === "login" ||
              mode === "register" ||
              mode === "forgot") && (
              <label>
                Email address

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  autoComplete="off"
                  placeholder="Enter your email address"
                  required
                />
              </label>
            )}

            {/* Login / Register Password */}
            {(mode === "login" ||
              mode === "register") && (
              <label
                style={{
                  position: "relative",
                }}
              >
                Password

                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    autoComplete="new-password"
                    placeholder={
                      mode === "register"
                        ? "e.g. Pass@1234 (Min 8 chars, 1 uppercase, 1 symbol)"
                        : "Enter your password"
                    }
                    required
                    style={{
                      width: "100%",
                      paddingRight: "40px",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword,
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    style={{
                      position: "absolute",
                      right: "10px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1.1rem",
                      minWidth: "36px",
                      minHeight: "36px",
                    }}
                  >
                    {showPassword
                      ? "Hide Password"
                      : "Show Password"}
                  </button>
                </div>
              </label>
            )}

            {/* =================================================
                FORGOT PASSWORD LINK
            ================================================= */}

            {mode === "login" && (
              <div
                style={{
                  textAlign: "right",
                  marginTop: "-4px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    handleModeChange("forgot")
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* =================================================
                RESET PASSWORD
            ================================================= */}

            {mode === "reset" && (
              <label
                style={{
                  position: "relative",
                }}
              >
                New Password

                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    autoComplete="new-password"
                    placeholder="Enter your new strong password"
                    required
                    style={{
                      width: "100%",
                      paddingRight: "40px",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword,
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    style={{
                      position: "absolute",
                      right: "10px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1.1rem",
                      minWidth: "36px",
                      minHeight: "36px",
                    }}
                  >
                    {showPassword
                      ? "Hide Password"
                      : "Show Password"}
                  </button>
                </div>
              </label>
            )}

            {/* =================================================
                ALERTS
            ================================================= */}

            {errorMessage && (
              <div className="alert error-alert">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="alert success-alert">
                {message}
              </div>
            )}

            {/* =================================================
                MAIN SUBMIT BUTTON
            ================================================= */}

            <button
              className="submit-button"
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
                transition: "all 0.2s ease-in-out",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : mode === "register"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Update password"}
            </button>

            {/* =================================================
                GOOGLE LOGIN
                Only Login + Register
            ================================================= */}

            {(mode === "login" ||
              mode === "register") && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    margin: "16px 0",
                    color: "#9ca3af",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      backgroundColor: "#e5e7eb",
                    }}
                  />

                  <span
                    style={{
                      padding: "0 10px",
                      fontSize: "0.8rem",
                      fontWeight: "500",
                    }}
                  >
                    OR
                  </span>

                  <div
                    style={{
                      flex: 1,
                      height: "1px",
                      backgroundColor: "#e5e7eb",
                    }}
                  />
                </div>

                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() =>
                      setErrorMessage(
                        "Google login was unsuccessful. Try again.",
                      )
                    }
                    shape="rectangular"
                    theme="outline"
                    size="large"
                    width="100%"
                  />
                </div>
              </>
            )}

            {/* =================================================
                BACK TO LOGIN
            ================================================= */}

            {(mode === "forgot" ||
              mode === "reset") && (
              <button
                type="button"
                onClick={() =>
                  handleModeChange("login")
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  width: "100%",
                  marginTop: "8px",
                  minHeight: "44px",
                }}
              >
                ← Back to Login
              </button>
            )}
          </form>

          {/* =================================================
              SECURITY NOTE
          ================================================= */}

          <p className="security-note">
            Your account information is protected by
            secure authentication.
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;