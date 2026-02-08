import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import StarsBackground from "../components/StarsBackground";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
    return () => {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(
        `${API}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );

      if (!res.ok) {
        alert("Invalid credentials");
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      login(data.access_token);
      navigate("/feed");

    } catch {
      alert("Server error");
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
            <img src="/logo-light.png" alt="Pulse" style={styles.logoImage} />
            <p style={styles.subtitle}>Welcome back! Please login to your account.</p>
          </div>

          <form onSubmit={submit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {isLoading ? (
              <Loader />
            ) : (
              <button style={styles.button}>Login to Pulse</button>
            )}
          </form>

          <div style={styles.footer}>
            <p style={styles.footerText}>
              Don't have an account?{" "}
              <span 
                onClick={() => navigate("/signup")} 
                style={styles.link}
              >
                Sign up
              </span>
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
    background: "rgba(255, 255, 255, 0.97)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: "24px",
    padding: "48px 40px",
    maxWidth: "420px",
    width: "100%",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
  brandContainer: {
    textAlign: "center",
    marginBottom: "35px",
  },
  logoImage: {
    width: "200px",
    height: "auto",
    objectFit: "contain",
    margin: "0 auto 30px",
    display: "block"
  },
  appName: {
    fontSize: "32px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "15px",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: "15px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    backgroundColor: "#f8fafc",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "15px",
    fontSize: "15px",
    fontWeight: "700",
    color: "white",
    background: "#0f1419",
    border: "none",
    borderRadius: "9999px",
    cursor: "pointer",
    marginTop: "8px",
    transition: "all 0.2s ease",
  },
  footer: {
    marginTop: "30px",
    textAlign: "center",
  },
  footerText: {
    color: "#64748b",
    fontSize: "14px",
  },
  link: {
    color: "#1d9bf0",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "none",
  },
};