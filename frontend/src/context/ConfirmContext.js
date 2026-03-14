import { createContext, useContext, useState, useCallback } from "react";
import { useTheme, getTheme } from "./ThemeContext";

const ConfirmContext = createContext();

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }) {
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const [state, setState] = useState(null);

  const confirm = useCallback((message, { title = "Confirm", confirmText = "Delete", cancelText = "Cancel", danger = true } = {}) => {
    return new Promise((resolve) => {
      setState({ message, title, confirmText, cancelText, danger, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const glass = background && background !== "none";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          onClick={handleCancel}
          style={{
            position: "fixed", inset: 0, zIndex: 100000,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            animation: "confirmFadeIn 0.15s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              margin: "0 20px",
              borderRadius: 20,
              padding: "28px 24px 20px",
              backgroundColor: glass ? "rgba(30,30,40,0.85)" : (darkMode ? "#1e1e1e" : "#fff"),
              backdropFilter: glass ? "blur(24px)" : undefined,
              border: `1px solid ${glass ? "rgba(255,255,255,0.12)" : t.border}`,
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
              animation: "confirmSlideIn 0.2s ease",
            }}
          >
            <h3 style={{
              margin: "0 0 8px", fontSize: 17, fontWeight: 700,
              color: t.text,
            }}>{state.title}</h3>
            <p style={{
              margin: "0 0 24px", fontSize: 14, lineHeight: 1.5,
              color: t.textSecondary,
            }}>{state.message}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s",
                  border: `1px solid ${t.border}`,
                  backgroundColor: "transparent", color: t.text,
                }}
              >{state.cancelText}</button>
              <button
                onClick={handleConfirm}
                autoFocus
                style={{
                  padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s",
                  border: "none",
                  backgroundColor: state.danger ? "#f4212e" : (t.accentBlue || "#1d9bf0"),
                  color: "#fff",
                }}
              >{state.confirmText}</button>
            </div>
          </div>
          <style>{`
            @keyframes confirmFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes confirmSlideIn {
              from { opacity: 0; transform: scale(0.95) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
