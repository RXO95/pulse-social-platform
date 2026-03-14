import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";

export default function WhoToFollow({ theme: t }) {
  const [suggestions, setSuggestions] = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchSuggestions();
    // eslint-disable-next-line
  }, []);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch(`${API}/feed/suggested-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch {}
  };

  const handleFollow = async (userId) => {
    try {
      const res = await fetch(`${API}/follow/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFollowingIds((prev) => new Set([...prev, userId]));
      }
    } catch {}
  };

  if (suggestions.length === 0) return null;

  return (
    <div
      style={{
        background: t.cardBg || "rgba(255,255,255,0.05)",
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        padding: "16px 0",
        marginTop: 16,
      }}
    >
      <h3
        style={{
          margin: 0,
          padding: "0 16px 12px",
          fontSize: "18px",
          fontWeight: 800,
          color: t.text,
        }}
      >
        Who to Follow
      </h3>
      {suggestions.map((user) => (
        <div
          key={user._id}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 16px",
            gap: 12,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onClick={() => navigate(`/profile/${user.username}`)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background =
              t.hoverBg || "rgba(255,255,255,0.06)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          {/* Avatar */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              background: t.inputBg || "#333",
            }}
          >
            {user.profile_picture ? (
              <img
                src={user.profile_picture}
                alt={user.username}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: t.textSecondary,
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {user.username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>

          {/* Name + Bio */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: t.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              @{user.username}
            </div>
            {user.bio && (
              <div
                style={{
                  fontSize: 12,
                  color: t.textSecondary,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 1,
                }}
              >
                {user.bio}
              </div>
            )}
          </div>

          {/* Follow Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFollow(user._id);
            }}
            disabled={followingIds.has(user._id)}
            style={{
              padding: "6px 16px",
              borderRadius: 9999,
              border: "none",
              fontWeight: 700,
              fontSize: 13,
              cursor: followingIds.has(user._id) ? "default" : "pointer",
              background: followingIds.has(user._id)
                ? "transparent"
                : t.text || "#fff",
              color: followingIds.has(user._id)
                ? t.textSecondary
                : t.bg || "#000",
              border: followingIds.has(user._id)
                ? `1px solid ${t.border}`
                : "none",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            {followingIds.has(user._id) ? "Following" : "Follow"}
          </button>
        </div>
      ))}
    </div>
  );
}
