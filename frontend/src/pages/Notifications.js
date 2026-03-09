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

/* ─── helpers ─── */
function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  let raw = String(dateString);
  if (!raw.endsWith("Z") && !raw.includes("+")) raw += "Z";
  const date = new Date(raw);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 0) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ICON_MAP = {
  like:         { Icon: FavoriteIcon,    color: "#f91880" },
  comment:      { Icon: ChatBubbleIcon,  color: "#1d9bf0" },
  follow:       { Icon: PersonAddIcon,   color: "#7856ff" },
  repost:       { Icon: RepeatIcon,      color: "#00ba7c" },
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

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notifications/?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setItems(await res.json());
    } catch {} finally {
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
        </div>
      ) : (
        <div>
          {items.map((n, i) => (
            <div
              key={i}
              onClick={() => onTap(n)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: mobile ? "14px 16px" : "14px 20px",
                borderBottom: `1px solid ${t.border}`,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = glass
                  ? "rgba(255,255,255,0.06)"
                  : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
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
                <div style={{ fontSize: 14, lineHeight: 1.45, color: t.textSecondary }}>
                  {message(n)}
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, opacity: 0.7 }}>
                  {timeAgo(n.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
