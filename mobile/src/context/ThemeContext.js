import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ThemeContext = createContext();

// ─── Shared Theme Tokens (mirrors web ThemeContext) ───
export const theme = {
  light: {
    bg: "#ffffff",
    cardBg: "#ffffff",
    text: "#0f1419",
    textSecondary: "#536471",
    border: "#eff3f4",
    headerBg: "#ffffff",
    inputBg: "#eff3f4",
    inputBorder: "#cfd9de",
    accent: "#764ba2",
    accentBlue: "#1d9bf0",
    tagBg: "#e8f5fd",
    tagText: "#1d9bf0",
    hoverBg: "#f7f9f9",
    avatarBg: "#ffd700",
    riskBg: "#ffeeee",
    riskText: "#f4212e",
    tabBarBg: "#ffffff",
    statusBar: "dark-content",
    contextBg: "#f8f9fa",
    contextBorder: "#e1e8ed",
    newsBg: "#f0f4f8",
    mentionTagBg: "#e8f0fe",
    mentionTagText: "#1a73e8",
    hashtagTagBg: "#e6f9e6",
    hashtagTagText: "#1e8e3e",
  },
  dark: {
    bg: "#000000",
    cardBg: "#16181c",
    text: "#e7e9ea",
    textSecondary: "#71767b",
    border: "#2f3336",
    headerBg: "#000000",
    inputBg: "#202327",
    inputBorder: "#333639",
    accent: "#a78bfa",
    accentBlue: "#1d9bf0",
    tagBg: "rgba(29,155,240,0.1)",
    tagText: "#1d9bf0",
    hoverBg: "#1d1f23",
    avatarBg: "#d4a017",
    riskBg: "rgba(244,33,46,0.1)",
    riskText: "#f4212e",
    tabBarBg: "#000000",
    statusBar: "light-content",
    contextBg: "#1a1d21",
    contextBorder: "#2f3336",
    newsBg: "#1e2125",
    mentionTagBg: "rgba(26,115,232,0.15)",
    mentionTagText: "#8ab4f8",
    hashtagTagBg: "rgba(30,142,62,0.15)",
    hashtagTagText: "#81c995",
  },
};

export function getTheme(darkMode) {
  return darkMode ? theme.dark : theme.light;
}

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("pulse-dark-mode");
        if (saved === "true") setDarkMode(true);
      } catch {}
    })();
  }, []);

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    await AsyncStorage.setItem("pulse-dark-mode", String(next));
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
