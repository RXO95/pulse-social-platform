import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("pulse-dark-mode");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("pulse-dark-mode", darkMode);
    document.documentElement.style.backgroundColor = darkMode ? "#000000" : "#ffffff";
    document.body.style.backgroundColor = darkMode ? "#000000" : "#ffffff";
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// --- SHARED THEME TOKENS ---
export const theme = {
  light: {
    bg: "#ffffff",
    cardBg: "#ffffff",
    text: "#0f1419",
    textSecondary: "#536471",
    border: "#eff3f4",
    headerBg: "rgba(255,255,255,0.85)",
    inputBg: "#eff3f4",
    inputBorder: "#cfd9de",
    accent: "#764ba2",
    accentBlue: "#1d9bf0",
    tagBg: "#e8f5fd",
    tagText: "#1d9bf0",
    hoverBg: "#f7f9f9",
    coverGradient: "linear-gradient(135deg, #764ba2, #667eea)",
    avatarBg: "#ffd700",
    contextBg: "#f7f9f9",
    contextBorder: "#eff3f4",
    newsBg: "#ffffff",
    noteBg: "#f7f9f9",
    riskBg: "#ffeeee",
    riskText: "#f4212e",
    shadow: "none",
  },
  dark: {
    bg: "#000000",
    cardBg: "#16181c",
    text: "#e7e9ea",
    textSecondary: "#71767b",
    border: "#2f3336",
    headerBg: "rgba(0,0,0,0.85)",
    inputBg: "#202327",
    inputBorder: "#333639",
    accent: "#a78bfa",
    accentBlue: "#1d9bf0",
    tagBg: "rgba(29,155,240,0.1)",
    tagText: "#1d9bf0",
    hoverBg: "#1d1f23",
    coverGradient: "linear-gradient(135deg, #4a2d6e, #3b4f80)",
    avatarBg: "#d4a017",
    contextBg: "#1e2028",
    contextBorder: "#2f3336",
    newsBg: "#202327",
    noteBg: "#202327",
    riskBg: "rgba(244,33,46,0.1)",
    riskText: "#f4212e",
    shadow: "0 1px 3px rgba(0,0,0,0.4)",
  },
};

export function getTheme(darkMode) {
  return darkMode ? theme.dark : theme.light;
}
