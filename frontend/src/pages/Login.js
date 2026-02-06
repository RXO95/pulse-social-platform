import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
    <div style={styles.pageWrapper}>
      <div style={styles.loginCard}>
        <div style={styles.brandContainer}>
          <div style={styles.logo}>P</div>
          <h1 style={styles.appName}>Pulse</h1>
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

        <p style={styles.footerText}>
          Don't have an account? <span style={styles.link}>Sign up</span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  pageWrapper: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    fontFamily: '-apple-system, system-ui, sans-serif',
  },
  loginCard: {
    backgroundColor: "#ffffff",
    padding: "40px",
    borderRadius: "20px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center",
  },
  brandContainer: {
    marginBottom: "30px",
  },
  logo: {
    width: "50px",
    height: "50px",
    backgroundColor: "#764ba2",
    color: "white",
    fontSize: "24px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "12px",
    margin: "0 auto 15px",
  },
  appName: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#1a1a1a",
    margin: "0 0 8px 0",
  },
  subtitle: {
    color: "#666",
    fontSize: "14px",
    margin: 0,
  },
  form: {
    textAlign: "left",
  },
  inputGroup: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#444",
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    padding: "12px 15px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border 0.2s",
  },
  button: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#764ba2",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "10px",
    transition: "opacity 0.2s",
  },
  footerText: {
    marginTop: "25px",
    fontSize: "14px",
    color: "#666",
  },
  link: {
    color: "#764ba2",
    fontWeight: "bold",
    cursor: "pointer",
  },
};