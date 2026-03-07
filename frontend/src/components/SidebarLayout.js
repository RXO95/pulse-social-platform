import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import API from "../api/api";
import BottomNav from "./BottomNav";
import DarkModeToggle from "./DarkModeToggle";
import useIsMobile from "../hooks/useIsMobile";

export default function SidebarLayout() {
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const token = localStorage.getItem("token");

  const [currentUser, setCurrentUser] = useState(null);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // Fetch current user
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setCurrentUser(await res.json());
      } catch {}
    })();
  }, [token]);

  // Fetch unread message count every 30s
  useEffect(() => {
    if (!token) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API}/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadMsgCount(data.unread || 0);
        }
      } catch {}
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    return () => clearInterval(iv);
  }, [token]);

  const isActive = (path) => {
    if (path === "/feed") return location.pathname === "/feed";
    if (path === "/messages") return location.pathname === "/messages";
    if (path === "/trending") return location.pathname === "/trending";
    if (path === "/bookmarks") return location.pathname === "/bookmarks";
    if (path === "/profile") return location.pathname.startsWith("/profile");
    return false;
  };

  const navItems = [
    {
      path: "/feed",
      label: "Home",
      icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h13c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696zM12 16.5c-1.933 0-3.5-1.567-3.5-3.5s1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5z"/>
        </svg>
      ),
    },
    {
      path: "/messages",
      label: "Messages",
      icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.14 8-5.14V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 4.971l-8 5.14-8-5.14V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.529z"/>
        </svg>
      ),
      badge: unreadMsgCount,
    },
    {
      path: "/trending",
      label: "Trending",
      icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M14.23 2.854c.98-.977 2.67-.238 2.67 1.17v4.964h4.59c1.51 0 2.27 1.82 1.21 2.89l-9.58 9.58c-.98.98-2.67.24-2.67-1.17v-4.96H5.86c-1.51 0-2.27-1.82-1.21-2.89l9.58-9.59z"/>
        </svg>
      ),
    },
    {
      path: "/bookmarks",
      label: "Bookmarks",
      icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/>
        </svg>
      ),
    },
    {
      path: "/profile",
      label: "Profile",
      icon: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c1.105 0 2 .9 2 2s-.895 2-2 2-2-.9-2-2 .895-2 2-2zm0-2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z"/>
        </svg>
      ),
    },
  ];

  /* ══════════ MOBILE: just Outlet + BottomNav ══════════ */
  if (mobile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: t.bg, color: t.text }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Outlet />
        </div>
        <BottomNav currentUser={currentUser} />
      </div>
    );
  }

  /* ══════════ DESKTOP: sidebar + content ══════════ */
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "row",
      backgroundColor: t.bg,
      color: t.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      {/* ── Left sidebar nav ── */}
      <nav style={{
        width: 275,
        flexShrink: 0,
        height: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        padding: "0 12px",
        boxSizing: "border-box",
      }}>
        <div style={{
          width: 232,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          paddingTop: 12,
          paddingBottom: 12,
          boxSizing: "border-box",
        }}>
          {/* Logo */}
          <div
            style={{ padding: "8px 12px", marginBottom: 4, cursor: "pointer" }}
            onClick={() => navigate("/feed")}
          >
            <img
              src={darkMode ? "/logo-dark.png" : "/logo-light.png"}
              alt="Pulse"
              style={{ height: 30, width: "auto", objectFit: "contain" }}
            />
          </div>

          {/* Nav buttons */}
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  if (item.path === "/profile" && currentUser) {
                    navigate(`/profile/${currentUser.username}`);
                  } else {
                    navigate(item.path);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  width: "fit-content",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  fontWeight: active ? "700" : "400",
                  color: t.text,
                  transition: "background-color 0.15s",
                  borderRadius: 9999,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div style={{ position: "relative", display: "inline-flex" }}>
                  {item.icon}
                  {item.badge > 0 && (
                    <span style={{
                      position: "absolute", top: -6, right: -10,
                      backgroundColor: "#1d9bf0", color: "#fff", fontSize: 10,
                      fontWeight: 700, minWidth: 16, height: 16,
                      borderRadius: 8, display: "flex", alignItems: "center",
                      justifyContent: "center", padding: "0 4px", lineHeight: 1,
                    }}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Dark mode toggle + Logout */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 12px",
          }}>
            <DarkModeToggle />
            <button
              onClick={logout}
              style={{
                background: "transparent",
                border: "none",
                borderRadius: 9999,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 400,
                color: t.textSecondary,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = t.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = t.textSecondary)}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ── Page content area ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        height: "100vh",
        overflow: "hidden",
      }}>
        <Outlet />
      </div>
    </div>
  );
}
