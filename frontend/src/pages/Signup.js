import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import Loader from "../components/Loader";
import StarsBackground from "../components/StarsBackground";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters long!");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, email, password })
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || "Signup failed");
        setIsLoading(false);
        return;
      }

      alert("Account created successfully! Please login.");
      navigate("/login");

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
        <div style={styles.signupCard}>
          <div style={styles.brandContainer}>
            <img src="/logo-light.png" alt="Pulse" style={styles.logoImage} />
            <p style={styles.subtitle}>Create your account and join the conversation.</p>
          </div>

          <form onSubmit={submit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input}
                type="email"
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

            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {isLoading ? (
              <Loader />
            ) : (
              <button style={styles.button}>Create Account</button>
            )}
          </form>

          <div style={styles.footer}>
            <p style={styles.footerText}>
              Already have an account?{" "}
              <span 
                onClick={() => navigate("/login")} 
                style={styles.link}
              >
                Sign in
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
  signupCard: {
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
