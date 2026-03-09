import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import Loader from "../components/Loader";
import StarsBackground from "../components/StarsBackground";
import PulseLogo from "../components/PulseLogo";

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
            <div style={styles.logoImage}><PulseLogo height={52} /></div>
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
    marginBottom: "28px",
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
    gap: "16px",
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
