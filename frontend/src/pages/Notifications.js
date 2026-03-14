import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { useTheme, getTheme } from "../context/ThemeContext";
import useIsMobile from "../hooks/useIsMobile";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import RepeatIcon from "@mui/icons-material/Repeat";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { timeAgo } from "../utils/timeAgo";

const ICON_MAP = {
  like: { Icon: FavoriteIcon, color: "#f91880" },
  comment: { Icon: ChatBubbleIcon, color: "#1d9bf0" },
  follow: { Icon: PersonAddIcon, color: "#7856ff" },
  repost: { Icon: RepeatIcon, color: "#00ba7c" },
  quote_repost: { Icon: FormatQuoteIcon, color: "#ff7a00" },
};

export default function Notifications() {
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastReadAt, setLastReadAt] = useState(() => {
    return localStorage.getItem("pulse_notif_last_read") || null;
  });

  const isUnread = (n) => {
    if (!lastReadAt) return true;
    return new Date(n.created_at) > new Date(lastReadAt);
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notifications/?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        // Mark all as read after fetching
        const now = new Date().toISOString();
        localStorage.setItem("pulse_notif_last_read", now);
        // Small delay so unread indicators are visible briefly
        setTimeout(() => setLastReadAt(now), 3000);
      }
    } catch { } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  /* ─── render helpers ─── */
  const avatar = (n) => {
    if (n.actor_pic) {
      return (
        <img
          src={n.actor_pic}
          alt=""
          style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover" }}
        />
      );
    }
    const letter = (n.actor_username || "?")[0].toUpperCase();
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: t.avatarBg || "#ffd700",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: 16,
      }}>
        {letter}
      </div>
    );
  };

  const typeIcon = (type) => {
    const cfg = ICON_MAP[type] || ICON_MAP.like;
    const { Icon } = cfg;
    return <Icon sx={{ fontSize: 14, color: cfg.color }} />;
  };

  const message = (n) => {
    switch (n.type) {
      case "like":
        return (
          <>
            <strong style={{ color: t.text }}>@{n.actor_username}</strong>
            {" "}liked your post
            {n.post_preview && (
              <span style={{ color: t.textSecondary }}> — "{n.post_preview.slice(0, 50)}…"</span>
            )}
          </>
        );
      case "comment":
        return (
          <>
            <strong style={{ color: t.text }}>@{n.actor_username}</strong>
            {" "}commented on your post
            {n.comment_preview && (
              <span style={{ color: t.textSecondary }}> — "{n.comment_preview.slice(0, 50)}…"</span>
            )}
          </>
        );
      case "follow":
        return (
          <>
            <strong style={{ color: t.text }}>@{n.actor_username}</strong>
            {" "}started following you
          </>
        );
      case "repost":
        return (
          <>
            <strong style={{ color: t.text }}>@{n.actor_username}</strong>
            {" "}reposted your post
            {n.post_preview && (
              <span style={{ color: t.textSecondary }}> — "{n.post_preview.slice(0, 50)}…"</span>
            )}
          </>
        );
      case "quote_repost":
        return (
          <>
            <strong style={{ color: t.text }}>@{n.actor_username}</strong>
            {" "}quoted your post
            {n.quote_content && (
              <span style={{ color: t.textSecondary }}> — "{n.quote_content.slice(0, 50)}…"</span>
            )}
          </>
        );
      default:
        return <span>New notification</span>;
    }
  };

  const onTap = (n) => {
    if (n.type === "follow") {
      navigate(`/profile/${n.actor_username}`);
    } else if (n.post_id) {
      navigate(`/post/${n.post_id}`);
    }
  };

  /* ─── glass check ─── */
  const glass = background && background !== "none";

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflowY: "auto",
      paddingBottom: mobile ? "70px" : "0",
    }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        padding: "16px 20px",
        borderBottom: `1px solid ${t.border}`,
        backgroundColor: glass ? "rgba(255,255,255,0.08)" : t.headerBg,
        backdropFilter: glass ? "blur(20px)" : undefined,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Notifications</span>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${t.border}`,
            borderTopColor: t.accentBlue, borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 60, color: t.textSecondary,
        }}>
          <NotificationsNoneOutlined sx={{ fontSize: 48, marginBottom: '12px', color: t.textSecondary }} />
          <span style={{ fontSize: 16 }}>No notifications yet</span>
          <span style={{ fontSize: 13, marginTop: 6, color: t.textSecondary }}>Follow people and interact with posts to see activity here</span>
        </div>
      ) : (
        <div>
          {items.map((n, i) => {
            const unread = isUnread(n);
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => onTap(n)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(n); } }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: mobile ? "14px 16px" : "14px 20px",
                  borderBottom: `1px solid ${t.border}`,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  backgroundColor: unread
                    ? (glass ? "rgba(29,155,240,0.06)" : (darkMode ? "rgba(29,155,240,0.08)" : "rgba(29,155,240,0.04)"))
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = glass
                    ? "rgba(255,255,255,0.06)"
                    : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)");
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = unread
                    ? (glass ? "rgba(29,155,240,0.06)" : (darkMode ? "rgba(29,155,240,0.08)" : "rgba(29,155,240,0.04)"))
                    : "transparent";
                }}
              >
                {/* Avatar with type badge */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {avatar(n)}
                  <div style={{
                    position: "absolute", bottom: -2, right: -2,
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: glass ? "rgba(30,30,30,0.9)" : t.cardBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `2px solid ${glass ? "rgba(255,255,255,0.15)" : t.bg}`,
                  }}>
                    {typeIcon(n.type)}
                  </div>
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.45, color: unread ? t.text : t.textSecondary, fontWeight: unread ? 600 : 400 }}>
                    {message(n)}
                  </div>
                  <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, opacity: 0.7 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                {unread && (
                  <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accentBlue || "#1d9bf0", flexShrink: 0, marginTop: 6 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
