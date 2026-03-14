import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, type = "info", duration = 3500) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div style={containerStyle}>
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}

function Toast({ toast }) {
  const bgMap = {
    success: "#00ba7c",
    error: "#e0245e",
    info: "#1d9bf0",
    warning: "#ffad1f",
  };
  const bg = bgMap[toast.type] || bgMap.info;

  return (
    <div
      style={{
        ...toastStyle,
        backgroundColor: bg,
        opacity: toast.exiting ? 0 : 1,
        transform: toast.exiting ? "translateY(-12px)" : "translateY(0)",
      }}
    >
      {toast.message}
    </div>
  );
}

const containerStyle = {
  position: "fixed",
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 99999,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  pointerEvents: "none",
  maxWidth: 420,
  width: "90%",
};

const toastStyle = {
  color: "#fff",
  padding: "12px 20px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  transition: "opacity 0.3s, transform 0.3s",
  textAlign: "center",
  lineHeight: 1.4,
};
