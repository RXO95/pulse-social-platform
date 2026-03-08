import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import API from "../api/api";
import BottomNav from "./BottomNav";
import DarkModeToggle from "./DarkModeToggle";
import MatrixBackground from "./MatrixBackground";
import StarsBackground from "./StarsBackground";
import useIsMobile from "../hooks/useIsMobile";
import PulseLogo from "./PulseLogo";

export default function SidebarLayout() {
  const { darkMode, background, wallpaperUrl } = useTheme();
  const t = getTheme(darkMode, background);
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth(); // eslint-disable-line no-unused-vars
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
    if (path === "/settings") return location.pathname === "/settings";
    return false;
  };

  const navItems = [
    {
      path: "/feed",
      label: "Home",
      iconOutline: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h13c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696zM19 19.5c0 .276-.224.5-.5.5h-13c-.276 0-.5-.224-.5-.5V8.429l7-4.375 7 4.375V19.5zM12 9.5c-1.933 0-3.5 1.567-3.5 3.5s1.567 3.5 3.5 3.5 3.5-1.567 3.5-3.5-1.567-3.5-3.5-3.5zm0 5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5z"/>
        </svg>
      ),
      iconFilled: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h13c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696zM12 16.5c-1.933 0-3.5-1.567-3.5-3.5s1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5z"/>
        </svg>
      ),
    },
    {
      path: "/messages",
      label: "Messages",
      iconOutline: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.14 8-5.14V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 4.971l-8 5.14-8-5.14V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.529z"/>
        </svg>
      ),
      iconFilled: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5L22 18.5c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5l-.002-13zm9.002 8.67l-8-5.14V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5V9.03l-8 5.14z"/>
        </svg>
      ),
      badge: unreadMsgCount,
    },
    {
      path: "/trending",
      label: "Trending",
      iconOutline: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M14.23 2.854c.98-.977 2.67-.238 2.67 1.17v4.964h4.59c1.51 0 2.27 1.82 1.21 2.89l-9.58 9.58c-.98.98-2.67.24-2.67-1.17v-4.96H5.86c-1.51 0-2.27-1.82-1.21-2.89l9.58-9.59zM15.11 4.04l-9.58 9.58h5.92v6.34l9.58-9.58h-5.92V4.04z"/>
        </svg>
      ),
      iconFilled: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M14.23 2.854c.98-.977 2.67-.238 2.67 1.17v4.964h4.59c1.51 0 2.27 1.82 1.21 2.89l-9.58 9.58c-.98.98-2.67.24-2.67-1.17v-4.96H5.86c-1.51 0-2.27-1.82-1.21-2.89l9.58-9.59z"/>
        </svg>
      ),
    },
    {
      path: "/bookmarks",
      label: "Bookmarks",
      iconOutline: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/>
        </svg>
      ),
      iconFilled: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"/>
        </svg>
      ),
    },
    {
      path: "/profile",
      label: "Profile",
      iconOutline: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c1.105 0 2 .9 2 2s-.895 2-2 2-2-.9-2-2 .895-2 2-2zm0-2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z"/>
        </svg>
      ),
      iconFilled: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M7.978 19c.254-2.46 1.143-4.18 2.386-5.33C11.65 12.39 13.17 11.75 15 11.75c-.828 0-1.5-.67-1.5-1.5s.672-1.5 1.5-1.5 1.5.67 1.5 1.5-.672 1.5-1.5 1.5c1.83 0 3.35.64 4.636 1.92 1.243 1.15 2.132 2.87 2.386 5.33H7.978zM12 2c2.209 0 4 1.79 4 4s-1.791 4-4 4-4-1.79-4-4 1.791-4 4-4zm0 10c-3.17 0-5.99 1.32-7.784 3.82C2.828 17.52 2.1 20.04 2 23h20c-.1-2.96-.828-5.48-2.216-7.18C17.99 13.32 15.17 12 12 12z"/>
        </svg>
      ),
    },
    {
      path: "/settings",
      label: "Settings",
      iconOutline: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M10.54 1.75h2.92l.57 2.56c.83.29 1.59.73 2.24 1.28l2.47-.88 1.46 2.53-1.9 1.68c.1.45.15.92.15 1.38s-.05.93-.15 1.38l1.9 1.68-1.46 2.53-2.47-.88c-.65.55-1.41.99-2.24 1.28l-.57 2.56h-2.92l-.57-2.56c-.83-.29-1.59-.73-2.24-1.28l-2.47.88-1.46-2.53 1.9-1.68c-.1-.45-.15-.92-.15-1.38s.05-.93.15-1.38l-1.9-1.68 1.46-2.53 2.47.88c.65-.55 1.41-.99 2.24-1.28l.57-2.56zM12 15.5c1.93 0 3.5-1.57 3.5-3.5s-1.57-3.5-3.5-3.5-3.5 1.57-3.5 3.5 1.57 3.5 3.5 3.5zm0-2c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5z"/>
        </svg>
      ),
      iconFilled: (
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M10.54 1.75h2.92l.57 2.56c.83.29 1.59.73 2.24 1.28l2.47-.88 1.46 2.53-1.9 1.68c.1.45.15.92.15 1.38s-.05.93-.15 1.38l1.9 1.68-1.46 2.53-2.47-.88c-.65.55-1.41.99-2.24 1.28l-.57 2.56h-2.92l-.57-2.56c-.83-.29-1.59-.73-2.24-1.28l-2.47.88-1.46-2.53 1.9-1.68c-.1-.45-.15-.92-.15-1.38s.05-.93.15-1.38l-1.9-1.68 1.46-2.53 2.47.88c.65-.55 1.41-.99 2.24-1.28l.57-2.56zM12 15.5c1.93 0 3.5-1.57 3.5-3.5s-1.57-3.5-3.5-3.5-3.5 1.57-3.5 3.5 1.57 3.5 3.5 3.5z"/>
        </svg>
      ),
    },
  ];

  const hasCustomBg = background && background !== "none";

  /* ══════════ MOBILE: just Outlet + BottomNav ══════════ */
  if (mobile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: hasCustomBg ? "transparent" : t.bg, color: t.text, position: "relative", ...(hasCustomBg && { textShadow: "0 1px 3px rgba(0,0,0,0.5)" }) }}>
        {hasCustomBg && background === "matrix" && <MatrixBackground />}
        {hasCustomBg && background === "stars" && <StarsBackground />}
        {background === "wallpaper" && wallpaperUrl && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, backgroundImage: `url(${wallpaperUrl})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative", zIndex: 1 }}>
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
      backgroundColor: hasCustomBg ? "transparent" : t.bg,
      color: t.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      position: "relative",
      ...(hasCustomBg && { textShadow: "0 1px 3px rgba(0,0,0,0.5)" }),
    }}>
      {/* Animated background layer */}
      {hasCustomBg && background === "matrix" && <MatrixBackground />}
      {hasCustomBg && background === "stars" && <StarsBackground />}
      {background === "wallpaper" && wallpaperUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, backgroundImage: `url(${wallpaperUrl})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
      )}

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
        position: "relative",
        zIndex: 1,
        ...(hasCustomBg && {
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          backgroundColor: "rgba(255,255,255,0.12)",
          borderRight: "1px solid rgba(255,255,255,0.2)",
        }),
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
            <PulseLogo height={30} color={t.text} />
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
                  background: active
                    ? (hasCustomBg ? "rgba(255,255,255,0.12)" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"))
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  fontWeight: active ? "700" : "400",
                  color: t.text,
                  transition: "background-color 0.15s",
                  borderRadius: 9999,
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = darkMode || hasCustomBg ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "transparent";
                  else e.currentTarget.style.backgroundColor = hasCustomBg ? "rgba(255,255,255,0.12)" : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)");
                }}
              >
                <div style={{ position: "relative", display: "inline-flex" }}>
                  {active ? item.iconFilled : item.iconOutline}
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

          {/* Dark mode toggle — only when default background */}
          {background === "none" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 12px",
            }}>
              <DarkModeToggle />
            </div>
          )}
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
        position: "relative",
        zIndex: 1,
      }}>
        <Outlet />
      </div>
    </div>
  );
}
