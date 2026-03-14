import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { deriveBackupKey, ensureKeys } from "../utils/crypto";
import Loader from "../components/Loader";
import StarsBackground from "../components/StarsBackground";
import PulseLogo from "../components/PulseLogo";

export default function Login() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const emailRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
    emailRef.current?.focus();
    return () => {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        toast("Invalid credentials", "error");
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const token = data.access_token;

      // Decode JWT to get userId for key derivation
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.user_id;

        // Derive E2EE backup key from password (PBKDF2, 600k iterations)
        const backupKeyHex = await deriveBackupKey(password, userId);
        localStorage.setItem("pulse_backup_key", backupKeyHex);

        // Ensure E2EE keys exist (IndexedDB → server backup → generate new)
        await ensureKeys(token, backupKeyHex);
      } catch (err) {
        console.warn("E2EE key setup:", err);
        // Non-fatal — messaging will still work, just without backup
      }

      login(token);
      navigate("/feed");

    } catch {
      toast("Server error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <StarsBackground />
      <div style={styles.pageWrapper}>
        <div style={styles.loginCard}>
          <div style={styles.brandContainer}>
            <div style={styles.logoImage}><PulseLogo height={52} /></div>
            <p style={styles.subtitle}>Welcome back! Sign in to continue.</p>
          </div>

          <form onSubmit={submit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                ref={emailRef}
                style={{...styles.input, borderColor: focusedField === "email" ? "rgba(139, 92, 246, 0.6)" : "rgba(255, 255, 255, 0.1)"}}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{...styles.input, borderColor: focusedField === "password" ? "rgba(139, 92, 246, 0.6)" : "rgba(255, 255, 255, 0.1)", paddingRight: "44px"}}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(255,255,255,0.4)", fontSize: "13px", fontWeight: 500 }}
                >{showPw ? "Hide" : "Show"}</button>
              </div>
            </div>

            {isLoading ? (
              <Loader />
            ) : (
              <button style={styles.button}>
                Sign In
              </button>
            )}
          </form>

          <div style={styles.footer}>
            <p style={styles.footerText}>
              Don't have an account?{" "}
              <button 
                type="button"
                onClick={() => navigate("/signup")} 
                style={{...styles.link, background: "none", border: "none", cursor: "pointer", fontSize: "inherit", fontFamily: "inherit", padding: 0}}
              >
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  pageWrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    position: "relative",
    zIndex: 2,
  },
  loginCard: {
    background: "rgba(15, 18, 30, 0.65)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderRadius: "28px",
    padding: "44px 40px",
    maxWidth: "400px",
    width: "100%",
    boxShadow: "0 8px 64px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  brandContainer: {
    textAlign: "center",
    marginBottom: "32px",
  },
  logoImage: {
    display: "flex",
    justifyContent: "center",
    margin: "0 auto 14px",
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: "14px",
    margin: 0,
    letterSpacing: "0.3px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.55)",
    letterSpacing: "0.3px",
  },
  input: {
    width: "100%",
    padding: "13px 16px",
    fontSize: "15px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "14px",
    outline: "none",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    color: "#ffffff",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "14px",
    fontSize: "15px",
    fontWeight: "600",
    color: "white",
    background: "linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)",
    border: "none",
    borderRadius: "14px",
    cursor: "pointer",
    marginTop: "4px",
    transition: "all 0.25s ease",
    letterSpacing: "0.3px",
  },
  footer: {
    marginTop: "28px",
    textAlign: "center",
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: "14px",
  },
  link: {
    color: "#8b5cf6",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "none",
  },
};