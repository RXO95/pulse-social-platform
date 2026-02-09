import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { useTheme, getTheme } from "../context/ThemeContext";
import LikeButton from "../components/LikeButton";
import CommentButton from "../components/CommentButton";
import BookmarkButton from "../components/BookmarkButton";
import DarkModeToggle from "../components/DarkModeToggle";
import BottomNav from "../components/BottomNav";
import PostLoader from "../components/PostLoader";
import useIsMobile from "../hooks/useIsMobile";

function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Bookmarks() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const token = localStorage.getItem("token");
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile);

  const fetchBookmarks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API}/bookmarks/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch {
      console.error("Failed to load bookmarks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await fetch(`${API}/likes/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchBookmarks();
      }
    } catch {
      console.error("Like failed");
    }
  };

  const handleRemoveBookmark = async (postId) => {
    try {
      const res = await fetch(`${API}/bookmarks/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Remove from UI
        setBookmarks(bookmarks.filter(b => b._id !== postId));
      }
    } catch {
      console.error("Remove bookmark failed");
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCurrentUser(await res.json());
      }
    } catch {}
  };

  useEffect(() => {
    fetchBookmarks();
    fetchCurrentUser();
  }, []);

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.navBar}>
        <div style={styles.navContent}>
          <button onClick={() => navigate("/feed")} style={styles.backButton}>← Back</button>
          <h3 style={{margin:0, color: t.text}}>Bookmarks</h3>
          <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
        </div>
      </header>

      <div style={styles.scrollArea}>
        {isLoading ? (
          <>
            <PostLoader />
            <PostLoader />
            <PostLoader />
          </>
        ) : bookmarks.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill={t.textSecondary}>
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"/>
              </svg>
            </div>
            <h3 style={styles.emptyTitle}>No bookmarks yet</h3>
            <p style={styles.emptyText}>Save posts to view them here later</p>
          </div>
        ) : (
          <div style={styles.postsSection}>
            <div style={styles.headerBar}>
              <span style={styles.countBadge}>{bookmarks.length} saved</span>
            </div>
            {bookmarks.map((p) => (
              <div key={p._id} style={styles.postCard}>
                <div style={styles.postHeader}>
                  <div style={styles.avatar}>
                    {p.profile_pic_url ? (
                      <img src={p.profile_pic_url} alt="" style={{width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover"}} />
                    ) : (
                      p.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={styles.postMeta}>
                    <strong 
                      style={styles.username}
                      onClick={() => navigate(`/profile/${p.username}`)}
                    >
                      @{p.username}
                    </strong>
                    <span style={styles.timestamp}>· {timeAgo(p.created_at)}</span>
                  </div>
                </div>

                <p 
                  style={styles.postContent}
                  onClick={() => navigate(`/post/${p._id}`)}
                >
                  {p.content}
                </p>

                {/* Post Media */}
                {p.media_url && (
                  <div style={styles.mediaContainer} onClick={() => navigate(`/post/${p._id}`)}>
                    {p.media_type === "video" ? (
                      <video src={p.media_url} style={styles.media} />
                    ) : (
                      <img src={p.media_url} alt="Post media" style={styles.media} />
                    )}
                  </div>
                )}

                <div style={styles.entityContainer}>
                  {p.entities?.map((e, idx) => (
                    <span 
                      key={idx} 
                      style={{...styles.tag, cursor: "pointer"}}
                      onClick={() => navigate(`/entity/${encodeURIComponent(e.text)}`)}
                    >
                      {e.text} <small style={styles.tagLabel}>{e.label}</small>
                    </span>
                  ))}
                </div>

                <div style={styles.actionSection}>
                  <LikeButton 
                    isLiked={p.is_liked_by_user} 
                    count={p.likes || 0}
                    onLike={() => handleLike(p._id)}
                  />
                  <CommentButton 
                    onClick={() => navigate(`/post/${p._id}`)}
                    count={p.comment_count || 0}
                  />
                  <BookmarkButton 
                    isBookmarked={true}
                    onToggle={() => handleRemoveBookmark(p._id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {mobile && <BottomNav currentUser={currentUser} />}
    </div>
  );
}

function getStyles(t, m) { return {
  fullScreenWrapper: { height: "100vh", display: "flex", flexDirection: "column", backgroundColor: t.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: "hidden", color: t.text, transition: "background-color 0.3s, color 0.3s" },
  navBar: { height: "53px", backgroundColor: t.headerBg, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", transition: "background-color 0.3s" },
  navContent: { width: "100%", maxWidth: "600px", display: "flex", alignItems: "center", gap: m ? "12px" : "20px", padding: m ? "0 12px" : "0 20px" },
  backButton: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: t.accentBlue, fontWeight: "600", flexShrink: 0 },
  scrollArea: { flex: 1, overflowY: "auto", maxWidth: "600px", width: "100%", margin: "0 auto", paddingBottom: m ? "70px" : "0", borderLeft: m ? "none" : `1px solid ${t.border}`, borderRight: m ? "none" : `1px solid ${t.border}` },

  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { marginBottom: "16px" },
  emptyTitle: { fontSize: "20px", fontWeight: "700", color: t.text, margin: "0 0 8px 0" },
  emptyText: { color: t.textSecondary, fontSize: "15px" },

  headerBar: { padding: "16px 20px", borderBottom: `1px solid ${t.border}` },
  countBadge: { color: t.textSecondary, fontSize: "14px" },

  postsSection: { padding: 0 },
  postCard: { backgroundColor: t.cardBg, padding: m ? "12px 16px 4px" : "16px 20px 4px", borderBottom: `1px solid ${t.border}`, transition: "background-color 0.15s" },
  postHeader: { display: "flex", alignItems: "center", marginBottom: "8px" },
  avatar: { width: "38px", height: "38px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", fontWeight: "700", color: "#1a1a1a", fontSize: "15px", flexShrink: 0 },
  postMeta: { display: "flex", alignItems: "center", gap: "4px" },
  username: { fontSize: "15px", fontWeight: "700", color: t.text, cursor: "pointer" },
  timestamp: { fontSize: "14px", color: t.textSecondary },
  postContent: { fontSize: "15px", lineHeight: "1.5", margin: "4px 0 8px 0", color: t.text, wordBreak: "break-word", cursor: "pointer" },
  
  // Media styles
  mediaContainer: { marginTop: "12px", marginBottom: "12px", borderRadius: "16px", overflow: "hidden", maxHeight: m ? "250px" : "400px", border: `1px solid ${t.border}`, cursor: "pointer" },
  media: { width: "100%", maxHeight: m ? "250px" : "400px", objectFit: "cover", display: "block" },
  
  entityContainer: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" },
  tag: { backgroundColor: t.tagBg, color: t.tagText, padding: "3px 10px", borderRadius: "9999px", fontSize: "13px", fontWeight: "500" },
  tagLabel: { color: t.textSecondary, fontSize: "11px", marginLeft: "2px" },
  actionSection: { display: "flex", alignItems: "center", gap: m ? "16px" : "24px", marginTop: "8px", paddingTop: "4px" }
}; }
