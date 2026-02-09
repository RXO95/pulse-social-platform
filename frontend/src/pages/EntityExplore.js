import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

export default function EntityExplore() {
  const { entityText } = useParams();
  const navigate = useNavigate();
  const [entityData, setEntityData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [translatedName, setTranslatedName] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const token = localStorage.getItem("token");
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile);

  const fetchEntityData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API}/entities/${encodeURIComponent(entityText)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEntityData(data);
      } else {
        setEntityData(null);
      }
    } catch {
      console.error("Failed to load entity data");
    } finally {
      setIsLoading(false);
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

  const handleLike = async (postId) => {
    try {
      const res = await fetch(`${API}/likes/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchEntityData();
      }
    } catch {
      console.error("Like failed");
    }
  };

  const handleBookmark = async (postId) => {
    try {
      const res = await fetch(`${API}/bookmarks/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchEntityData();
      }
    } catch {
      console.error("Bookmark failed");
    }
  };

  useEffect(() => {
    fetchEntityData();
    fetchCurrentUser();
    setTranslatedName(null); // Reset translation when entity changes
  }, [entityText]);

  const translateEntityName = async () => {
    if (translatedName || isTranslating) return;
    setIsTranslating(true);
    try {
      const res = await fetch(`${API}/translate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: entityData.entity.text, target_lang: "en" })
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedName(data.translated_text);
      }
    } catch {
      console.error("Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const getLabelIcon = (label, color) => {
    switch (label) {
      case "PER": return <svg viewBox="0 0 24 24" width="24" height="24" fill={color}><path d="M12 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0-2C9.79 2 8 3.79 8 6s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.35 0-4.37.85-5.86 2.44-1.48 1.58-2.37 3.8-2.63 6.46l-.11 1.1h17.2l-.11-1.1c-.26-2.66-1.15-4.88-2.63-6.46C16.37 11.85 14.35 11 12 11z"/></svg>;
      case "ORG": return <svg viewBox="0 0 24 24" width="24" height="24" fill={color}><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>;
      case "LOC": case "GPE": return <svg viewBox="0 0 24 24" width="24" height="24" fill={color}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>;
      default: return <svg viewBox="0 0 24 24" width="24" height="24" fill={color}><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>;
    }
  };

  const getLabelName = (label) => {
    switch (label) {
      case "PER": return "Person";
      case "ORG": return "Organization";
      case "LOC": return "Location";
      case "GPE": return "Place";
      default: return "Entity";
    }
  };

  if (isLoading) {
    return (
      <div style={styles.fullScreenWrapper}>
        <header style={styles.navBar}>
          <div style={styles.navContent}>
            <button onClick={() => navigate(-1)} style={styles.backButton}>← Back</button>
            <h3 style={{margin:0, color: t.text}}>Entity</h3>
            <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
          </div>
        </header>
        <div style={styles.scrollArea}>
          <PostLoader />
          <PostLoader />
          <PostLoader />
        </div>
        {mobile && <BottomNav currentUser={currentUser} />}
      </div>
    );
  }

  if (!entityData) {
    return (
      <div style={styles.fullScreenWrapper}>
        <header style={styles.navBar}>
          <div style={styles.navContent}>
            <button onClick={() => navigate(-1)} style={styles.backButton}>← Back</button>
            <h3 style={{margin:0, color: t.text}}>Entity</h3>
            <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
          </div>
        </header>
        <div style={{padding: 40, textAlign: "center", color: t.textSecondary}}>
          <p>No posts found mentioning "{decodeURIComponent(entityText)}"</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.navBar}>
        <div style={styles.navContent}>
          <button onClick={() => navigate(-1)} style={styles.backButton}>← Back</button>
          <h3 style={{margin:0, color: t.text}}>Explore Entity</h3>
          <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
        </div>
      </header>

      <div style={styles.scrollArea}>
        {/* Entity Header Card */}
        <div style={styles.entityHeader}>
          <div style={styles.entityIcon}>
            {getLabelIcon(entityData.entity.label, t.text)}
          </div>
          <div style={styles.entityInfo}>
            <h1 style={styles.entityName}>
              {translatedName || entityData.entity.text}
            </h1>
            {translatedName && (
              <p style={{fontSize: "13px", color: t.textSecondary, margin: "2px 0 6px"}}>Original: {entityData.entity.text}</p>
            )}
            {!translatedName && (
              <button 
                onClick={translateEntityName} 
                style={styles.translateBtn}
                disabled={isTranslating}
              >
                {isTranslating ? "Translating..." : "Translate to English"}
              </button>
            )}
            <div style={styles.entityMeta}>
              <span style={styles.labelBadge}>{getLabelName(entityData.entity.label)}</span>
              <span style={styles.mentionCount}>{entityData.mention_count} posts</span>
            </div>
            {entityData.entity.identified_as && entityData.entity.identified_as !== entityData.entity.text && (
              <p style={styles.identifiedAs}>Also known as: {entityData.entity.identified_as}</p>
            )}
          </div>
        </div>

        {/* Wikipedia Info */}
        {entityData.wikipedia && (
          <div style={styles.wikiCard}>
            <div style={styles.wikiHeader}>
              <span style={{fontSize: "18px"}}>📚</span>
              <strong>Wikipedia</strong>
            </div>
            <p style={styles.wikiText}>{entityData.wikipedia.description}</p>
            {entityData.wikipedia.url && (
              <a href={entityData.wikipedia.url} target="_blank" rel="noopener noreferrer" style={styles.wikiLink}>
                Read more on Wikipedia →
              </a>
            )}
          </div>
        )}

        {/* Related Entities */}
        {entityData.related_entities && entityData.related_entities.length > 0 && (
          <div style={styles.relatedSection}>
            <h4 style={styles.sectionTitle}>Often mentioned with</h4>
            <div style={styles.relatedGrid}>
              {entityData.related_entities.map((rel, idx) => (
                <div 
                  key={idx} 
                  style={styles.relatedChip}
                  onClick={() => navigate(`/entity/${encodeURIComponent(rel.text)}`)}
                >
                  <span style={{display: "flex", alignItems: "center"}}>{getLabelIcon(rel.label, t.text)}</span>
                  <span>{rel.text}</span>
                  <small style={{color: t.textSecondary}}>({rel.co_occurrences})</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        <div style={styles.postsSection}>
          <h4 style={styles.sectionTitle}>Recent Posts</h4>
          {entityData.recent_posts.map((p) => (
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
                    style={{
                      ...styles.tag,
                      backgroundColor: e.text.toLowerCase() === entityText.toLowerCase() ? t.accentBlue : t.tagBg,
                      color: e.text.toLowerCase() === entityText.toLowerCase() ? "#fff" : t.tagText,
                      cursor: "pointer"
                    }}
                    onClick={() => navigate(`/entity/${encodeURIComponent(e.text)}`)}
                  >
                    {e.text}
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
                  isBookmarked={p.is_bookmarked}
                  onToggle={() => handleBookmark(p._id)}
                />
              </div>
            </div>
          ))}
        </div>
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

  entityHeader: { display: "flex", alignItems: "flex-start", gap: "16px", padding: m ? "20px 16px" : "24px 20px", borderBottom: `1px solid ${t.border}` },
  entityIcon: { width: m ? "60px" : "80px", height: m ? "60px" : "80px", borderRadius: "50%", backgroundColor: t.tagBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: m ? "28px" : "36px", flexShrink: 0 },
  entityInfo: { flex: 1, minWidth: 0 },
  entityName: { fontSize: m ? "22px" : "28px", fontWeight: "800", margin: "0 0 4px 0", color: t.text, wordBreak: "break-word" },
  entityMeta: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "8px" },
  labelBadge: { backgroundColor: t.accentBlue, color: "#fff", padding: "4px 12px", borderRadius: "9999px", fontSize: "13px", fontWeight: "600" },
  mentionCount: { color: t.textSecondary, fontSize: "14px" },
  identifiedAs: { color: t.textSecondary, fontSize: "14px", marginTop: "8px", fontStyle: "italic" },
  translateBtn: { background: "none", border: "none", color: t.accentBlue, fontSize: "13px", fontWeight: "500", cursor: "pointer", padding: 0, marginBottom: "4px" },

  wikiCard: { backgroundColor: t.contextBg, border: `1px solid ${t.border}`, margin: m ? "12px" : "16px", borderRadius: "12px", padding: m ? "14px" : "16px" },
  wikiHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", color: t.text, fontWeight: "600" },
  wikiText: { color: t.text, fontSize: "14px", lineHeight: "1.5", margin: "0 0 10px 0" },
  wikiLink: { color: t.accentBlue, fontSize: "14px", fontWeight: "500", textDecoration: "none" },

  relatedSection: { padding: m ? "12px 16px" : "16px 20px", borderBottom: `1px solid ${t.border}` },
  sectionTitle: { fontSize: "16px", fontWeight: "700", color: t.text, margin: "0 0 12px 0" },
  relatedGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  relatedChip: { display: "flex", alignItems: "center", gap: "6px", backgroundColor: t.cardBg, border: `1px solid ${t.border}`, borderRadius: "9999px", padding: "6px 14px", fontSize: "14px", cursor: "pointer", transition: "all 0.2s", color: t.text },

  postsSection: { padding: m ? "12px 0" : "16px 0" },
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
  actionSection: { display: "flex", alignItems: "center", gap: m ? "16px" : "24px", marginTop: "8px", paddingTop: "4px" }
}; }
