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
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import Home from "@mui/icons-material/Home";
import MailOutline from "@mui/icons-material/MailOutline";
import Mail from "@mui/icons-material/Mail";
import BoltOutlined from "@mui/icons-material/BoltOutlined";
import Bolt from "@mui/icons-material/Bolt";
import BookmarkBorder from "@mui/icons-material/BookmarkBorder";
import Bookmark from "@mui/icons-material/Bookmark";
import PersonOutline from "@mui/icons-material/PersonOutline";
import Person from "@mui/icons-material/Person";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Settings from "@mui/icons-material/Settings";

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

  const iconSx = { fontSize: 28 };

  const navItems = [
    {
      path: "/feed",
      label: "Home",
      iconOutline: <HomeOutlined sx={iconSx} />,
      iconFilled: <Home sx={iconSx} />,
    },
    {
      path: "/messages",
      label: "Messages",
      iconOutline: <MailOutline sx={iconSx} />,
      iconFilled: <Mail sx={iconSx} />,
      badge: unreadMsgCount,
    },
    {
      path: "/trending",
      label: "Trending",
      iconOutline: <BoltOutlined sx={iconSx} />,
      iconFilled: <Bolt sx={iconSx} />,
    },
    {
      path: "/bookmarks",
      label: "Bookmarks",
      iconOutline: <BookmarkBorder sx={iconSx} />,
      iconFilled: <Bookmark sx={iconSx} />,
    },
    {
      path: "/profile",
      label: "Profile",
      iconOutline: <PersonOutline sx={iconSx} />,
      iconFilled: <Person sx={iconSx} />,
    },
    {
      path: "/settings",
      label: "Settings",
      iconOutline: <SettingsOutlined sx={iconSx} />,
      iconFilled: <Settings sx={iconSx} />,
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

          {/* Post button */}
          <button
            onClick={() => navigate("/compose")}
            style={{
              width: "90%", padding: "14px 0", marginTop: 16,
              backgroundColor: t.accentBlue || "#1d9bf0", color: "#fff",
              border: "none", borderRadius: 9999, fontSize: 17,
              fontWeight: 700, cursor: "pointer", textAlign: "center",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            Post
          </button>

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
