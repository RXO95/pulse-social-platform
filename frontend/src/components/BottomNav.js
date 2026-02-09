import { useNavigate, useLocation } from "react-router-dom";
import { useTheme, getTheme } from "../context/ThemeContext";

export default function BottomNav({ currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  const isActive = (path) => {
    if (path === "/feed") return location.pathname === "/feed";
    if (path === "/trending") return location.pathname === "/trending";
    if (path === "/bookmarks") return location.pathname === "/bookmarks";
    if (path === "/profile") return location.pathname.startsWith("/profile");
    return false;
  };

  const navItems = [
    {
      path: "/feed",
      label: "Home",
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? t.accentBlue : t.textSecondary}>
          {active ? (
            <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h13c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696zM12 16.5c-1.933 0-3.5-1.567-3.5-3.5s1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5z"/>
          ) : (
            <path d="M12 9c-2.209 0-4 1.791-4 4s1.791 4 4 4 4-1.791 4-4-1.791-4-4-4zm0 6c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm0-13.304L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h13c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696zM19 19.5c0 .276-.224.5-.5.5h-13c-.276 0-.5-.224-.5-.5V8.429l7-4.375 7 4.375V19.5z"/>
          )}
        </svg>
      )
    },
    {
      path: "/trending",
      label: "Trending",
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? t.accentBlue : t.textSecondary}>
          {active ? (
            <path d="M14.23 2.854c.98-.977 2.67-.238 2.67 1.17v4.964h4.59c1.51 0 2.27 1.82 1.21 2.89l-9.58 9.58c-.98.98-2.67.24-2.67-1.17v-4.96H5.86c-1.51 0-2.27-1.82-1.21-2.89l9.58-9.59z"/>
          ) : (
            <path d="M14.23 2.854c.98-.977 2.67-.238 2.67 1.17v4.964h4.59c1.51 0 2.27 1.82 1.21 2.89l-9.58 9.58c-.98.98-2.67.24-2.67-1.17v-4.96H5.86c-1.51 0-2.27-1.82-1.21-2.89l9.58-9.59zM8.66 12.878l4.79-4.79v4.9h5.89l-4.79 4.79v-4.9H8.66z"/>
          )}
        </svg>
      )
    },
    {
      path: "/bookmarks",
      label: "Saved",
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? t.accentBlue : t.textSecondary}>
          {active ? (
            <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"/>
          ) : (
            <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/>
          )}
        </svg>
      )
    },
    {
      path: "/profile",
      label: "Profile",
      icon: (active) => (
        <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? t.accentBlue : t.textSecondary}>
          {active ? (
            <path d="M17.863 13.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44zM12 2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z"/>
          ) : (
            <path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c1.105 0 2 .9 2 2s-.895 2-2 2-2-.9-2-2 .895-2 2-2zm0-2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z"/>
          )}
        </svg>
      )
    }
  ];

  return (
    <nav style={styles.bottomNav(t)}>
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
            style={styles.navItem(t, active)}
          >
            {item.icon(active)}
            <span style={styles.navLabel(t, active)}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  bottomNav: (t) => ({
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "56px",
    backgroundColor: t.headerBg,
    borderTop: `1px solid ${t.border}`,
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: "env(safe-area-inset-bottom)",
    zIndex: 1000,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)"
  }),
  navItem: (t, active) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    background: "none",
    border: "none",
    padding: "8px 16px",
    cursor: "pointer",
    transition: "transform 0.1s",
    minWidth: "64px"
  }),
  navLabel: (t, active) => ({
    fontSize: "10px",
    fontWeight: active ? "600" : "500",
    color: active ? t.accentBlue : t.textSecondary,
    marginTop: "2px"
  })
};
