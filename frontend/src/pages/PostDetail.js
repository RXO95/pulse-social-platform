import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import { useTheme, getTheme } from "../context/ThemeContext";
import LikeButton from "../components/LikeButton";
import CommentButton from "../components/CommentButton";
import BookmarkButton from "../components/BookmarkButton";
import DarkModeToggle from "../components/DarkModeToggle";
import BottomNav from "../components/BottomNav";
import Loader from "../components/Loader";
import useIsMobile from "../hooks/useIsMobile";

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isRegeneratingContext, setIsRegeneratingContext] = useState(false);
  
  // --- NEW: Translation State ---
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  
  const token = localStorage.getItem("token");
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile);

  // Fetch Post Details
  const fetchPost = async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`${API}/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      } else {
        setLoadError(true);
        alert("Post not found");
        navigate("/feed");
      }
    } catch {
      console.error("Failed to load post");
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Comments (Manual User Notes)
  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API}/comments/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch {
      console.error("Failed to load comments");
    }
  };

  // Handle Like
  const handleLike = async () => {
    if (!post) return;
    const wasLiked = post.is_liked_by_user;
    const currentLikes = post.likes || 0;
    
    // Optimistic update
    setPost(prev => ({
      ...prev,
      is_liked_by_user: !wasLiked,
      likes: wasLiked ? currentLikes - 1 : currentLikes + 1
    }));
    
    try {
      const res = await fetch(`${API}/likes/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPost(prev => ({
          ...prev,
          is_liked_by_user: data.liked,
          likes: data.likes
        }));
      } else {
        // Revert on error
        setPost(prev => ({
          ...prev,
          is_liked_by_user: wasLiked,
          likes: currentLikes
        }));
      }
    } catch {
      setPost(prev => ({
        ...prev,
        is_liked_by_user: wasLiked,
        likes: currentLikes
      }));
    }
  };

  // Handle Bookmark
  const handleBookmark = async () => {
    if (!post) return;
    try {
      const res = await fetch(`${API}/bookmarks/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPost(prev => ({ ...prev, is_bookmarked: data.bookmarked }));
      }
    } catch {
      console.error("Bookmark failed");
    }
  };

  // Add a New Comment
  const handleSubmitNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch(`${API}/comments/${postId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newNote })
      });
      
      if (res.ok) {
        setNewNote("");
        fetchNotes(); // Refresh list
      }
    } catch {
      alert("Failed to add comment");
    }
  };

  // --- NEW: Handle Translation ---
  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }

    try {
      const res = await fetch(`${API}/translate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: post.content, target_lang: "en" })
      });

      if (res.ok) {
        const data = await res.json();
        setTranslatedText(data.translated_text);
        setShowTranslation(true);
      }
    } catch {
      alert("Translation failed");
    }
  };

  // --- Regenerate Context ---
  const handleRegenerateContext = async () => {
    if (isRegeneratingContext) return;
    setIsRegeneratingContext(true);
    try {
      const res = await fetch(`${API}/posts/${postId}/regenerate-context`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPost(prev => ({
          ...prev,
          context_data: data.context_data
        }));
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to regenerate context");
      }
    } catch {
      alert("Failed to regenerate context");
    } finally {
      setIsRegeneratingContext(false);
    }
  };

  useEffect(() => {
    fetchPost();
    fetchNotes();
    fetchCurrentUser();
  }, [postId]);

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

  if (isLoading) return (
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: t.bg}}>
      <Loader />
    </div>
  );

  if (loadError || !post) return (
    <div style={{display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: t.bg, color: t.text}}>
      <p>Failed to load post</p>
      <button onClick={() => navigate("/feed")} style={{marginTop: 10, padding: "10px 20px", cursor: "pointer"}}>
        Back to Feed
      </button>
    </div>
  );

  // --- HELPER: Context Box Component ---
  const renderContextBox = () => {
    const ctx = post.context_data;
    const hasContext = ctx && ctx.is_generated;
    const hasEntities = post.entities && post.entities.length > 0;

    // Show regenerate button if no context but has entities
    if (!hasContext && hasEntities) {
      return (
        <div style={styles.contextBox}>
          <div style={styles.contextHeader}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill={t.text}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <strong>Pulse Context</strong>
          </div>
          <p style={{color: t.textSecondary, fontSize: "14px", margin: "8px 0 12px"}}>
            Generate Wikipedia info and related news for:
          </p>
          <div style={{display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px"}}>
            {post.entities.map((ent, idx) => (
              <span key={idx} style={styles.contextEntityTag}>
                {ent.text}
              </span>
            ))}
          </div>
          <button 
            onClick={handleRegenerateContext}
            disabled={isRegeneratingContext}
            style={styles.regenerateBtn}
          >
            {isRegeneratingContext ? "Generating..." : "Generate Pulse Context"}
          </button>
        </div>
      );
    }

    if (!hasContext) return null;

    return (
      <div style={styles.contextBox}>
        <div style={styles.contextHeader}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill={t.text}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          <strong>Pulse Context</strong>
          <button 
            onClick={handleRegenerateContext}
            disabled={isRegeneratingContext}
            style={styles.refreshBtn}
            title="Regenerate context"
          >
            {isRegeneratingContext ? (
              <span style={{fontSize: "12px"}}>...</span>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill={t.accentBlue}>
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Disambiguation Section */}
        {ctx.disambiguation && ctx.disambiguation.length > 0 && (
          <div style={styles.contextSection}>
            <p style={styles.contextLabel}>Entity Clarification:</p>
            <ul style={styles.contextList}>
              {ctx.disambiguation.map((item, idx) => (
                <li key={idx}>
                  <strong>{item.entity}</strong> is identified as <strong>{item.identified_as}</strong>
                  <div style={{color: t.textSecondary, fontSize: "13px", marginTop: "2px"}}>
                    {item.description}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* News Section */}
        {ctx.news && (
          <div style={styles.contextSection}>
            <p style={styles.contextLabel}>Related Context:</p>
            <div style={styles.newsCard}>
              <a href={ctx.news.url} target="_blank" rel="noopener noreferrer" style={styles.newsLink}>
                {ctx.news.headline}
              </a>
              <div style={{fontSize: "11px", color: t.textSecondary, marginTop: "4px"}}>Source: Google News</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.navBar}>
        <div style={styles.navContent}>
          <button onClick={() => navigate(-1)} style={styles.backButton}>← Back</button>
          <h3 style={{margin:0, color: t.text}}>Post Details</h3>
          <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
        </div>
      </header>

      <div style={styles.scrollArea}>

      {/* MAIN POST CARD */}
      <div style={styles.card}>
        <div style={styles.header}>
           <div style={styles.avatar}>
             {post.profile_pic_url ? (
               <img src={post.profile_pic_url} alt="" style={{width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover"}} />
             ) : (
               post.username?.charAt(0).toUpperCase()
             )}
           </div>
           <strong style={{fontSize: "16px", color: t.text}}>@{post.username}</strong>
        </div>
        
        {/* --- UPDATED: Content with Translation Toggle --- */}
        <p style={styles.content}>
          {showTranslation ? translatedText : post.content}
        </p>

        {/* --- POST MEDIA --- */}
        {post.media_url && (
          <div style={styles.mediaContainer}>
            {post.media_type === "video" ? (
              <video src={post.media_url} controls style={styles.media} />
            ) : (
              <img src={post.media_url} alt="Post media" style={styles.media} />
            )}
          </div>
        )}

        {/* --- NEW: Translate Button --- */}
        <div 
           style={styles.translateBtn} 
           onClick={handleTranslate}
        >
           {showTranslation ? "See Original" : "Translate Post"}
        </div>

        {/* NER TAGS */}
        <div style={styles.entityContainer}>
            {post.entities?.map((e, idx) => (
              <span key={idx} style={styles.tag}>
                {e.text} <small style={styles.tagLabel}>{e.label}</small>
              </span>
            ))}
        </div>

        {/* --- PULSE CONTEXT BOX --- */}
        {renderContextBox()}

        {/* ACTION BUTTONS */}
        <div style={styles.actionSection}>
          <LikeButton 
            isLiked={post.is_liked_by_user} 
            count={post.likes || 0}
            onLike={handleLike}
          />
          <CommentButton 
            onClick={() => document.querySelector('textarea')?.focus()}
            count={notes.length}
          />
          <BookmarkButton 
            isBookmarked={post.is_bookmarked}
            onToggle={handleBookmark}
          />
        </div>

        <div style={{marginTop: 15, paddingTop: 10, borderTop: `1px solid ${t.border}`}}>
           <small style={{color: t.textSecondary}}>{new Date(post.created_at).toLocaleString()}</small>
        </div>
      </div>

      {/* COMMENTS SECTION */}
      <div style={styles.notesSection}>
        <h4 style={styles.sectionTitle}>Comments</h4>
        
        <div style={styles.inputGroup}>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a comment..."
            style={styles.textarea}
          />
          <button onClick={handleSubmitNote} style={styles.postBtn}>Post</button>
        </div>

        <div style={styles.notesList}>
          {notes.map((note) => (
            <div key={note._id} style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <strong>@{note.username}</strong>
                <small style={{color: t.textSecondary}}>{new Date(note.created_at).toLocaleDateString()}</small>
              </div>
              <p style={{margin:"5px 0", fontSize:"14px", color: t.text}}>{note.content}</p>
            </div>
          ))}
          {notes.length === 0 && <p style={{color: t.textSecondary, fontStyle:"italic"}}>No comments yet.</p>}
        </div>
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
  scrollArea: { flex: 1, overflowY: "auto", maxWidth: "600px", width: "100%", margin: "0 auto", padding: m ? "0" : "0", paddingBottom: m ? "70px" : "0", borderLeft: m ? "none" : `1px solid ${t.border}`, borderRight: m ? "none" : `1px solid ${t.border}` },
  
  card: { backgroundColor: t.cardBg, borderBottom: `1px solid ${t.border}`, padding: m ? "16px" : "20px", transition: "background-color 0.3s" },
  header: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  avatar: { width: m ? "40px" : "48px", height: m ? "40px" : "48px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: m ? "16px" : "20px", color: "#1a1a1a", flexShrink: 0 },
  content: { fontSize: m ? "17px" : "23px", lineHeight: "1.35", margin: "8px 0 12px", color: t.text, wordBreak: "break-word" },
  
  // Media styles
  mediaContainer: { marginTop: "12px", marginBottom: "12px", borderRadius: "16px", overflow: "hidden", maxHeight: m ? "350px" : "500px", border: `1px solid ${t.border}` },
  media: { width: "100%", maxHeight: m ? "350px" : "500px", objectFit: "cover", display: "block" },
  
  translateBtn: {
    color: t.accentBlue,
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    marginBottom: "15px",
    display: "inline-block"
  },

  entityContainer: { display: "flex", flexWrap: "wrap", gap: m ? "6px" : "8px", marginTop: "0px", marginBottom: "20px" },
  tag: { backgroundColor: t.tagBg, color: t.tagText, padding: "4px 12px", borderRadius: "9999px", fontSize: m ? "12px" : "13px", fontWeight: "500" },
  tagLabel: { color: t.textSecondary, fontSize: "11px", marginLeft: "4px" },

  contextBox: {
    backgroundColor: t.contextBg,
    border: `1px solid ${t.contextBorder}`,
    borderRadius: "12px",
    padding: m ? "14px" : "16px",
    marginTop: "16px",
    marginBottom: "16px",
    transition: "background-color 0.3s"
  },
  contextHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
    borderBottom: `1px solid ${t.contextBorder}`,
    paddingBottom: "8px",
    color: t.text,
    fontSize: m ? "14px" : "16px"
  },
  contextSection: {
    marginBottom: "12px"
  },
  contextLabel: {
    fontSize: "12px",
    fontWeight: "bold",
    color: t.textSecondary,
    textTransform: "uppercase",
    marginBottom: "6px"
  },
  contextList: {
    listStyleType: "disc",
    paddingLeft: m ? "16px" : "20px",
    margin: 0,
    fontSize: m ? "13px" : "14px",
    color: t.text
  },
  newsCard: {
    backgroundColor: t.newsBg,
    border: `1px solid ${t.border}`,
    borderRadius: "6px",
    padding: "10px",
    transition: "background-color 0.3s"
  },
  newsLink: {
    color: t.accentBlue,
    textDecoration: "none",
    fontWeight: "600",
    fontSize: m ? "13px" : "14px",
    display: "block",
    wordBreak: "break-word"
  },

  actionSection: {
    display: "flex",
    alignItems: "center",
    gap: m ? "24px" : "32px",
    padding: "16px 4px",
    marginTop: "16px",
    borderTop: `1px solid ${t.border}`
  },

  notesSection: { marginTop: "0", borderTop: `1px solid ${t.border}`, padding: m ? "16px" : "20px" },
  sectionTitle: { fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: t.text },
  inputGroup: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" },
  textarea: { padding: "14px", borderRadius: "12px", border: `1px solid ${t.inputBorder}`, resize: "none", height: "64px", fontFamily: "inherit", backgroundColor: t.inputBg, color: t.text, transition: "background-color 0.3s, border-color 0.2s", fontSize: "15px", outline: "none" },
  postBtn: { alignSelf: "flex-end", backgroundColor: t.accentBlue, color: "#fff", border: "none", padding: "10px 24px", borderRadius: "9999px", fontWeight: "700", fontSize: "15px", cursor: "pointer", transition: "all 0.2s" },
  
  notesList: { display: "flex", flexDirection: "column", gap: "0" },
  noteCard: { backgroundColor: "transparent", padding: m ? "12px 0" : "14px 0", borderBottom: `1px solid ${t.border}`, transition: "background-color 0.3s" },
  noteHeader: { display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px", color: t.text },
  
  regenerateBtn: {
    backgroundColor: t.accentBlue,
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "9999px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  refreshBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s"
  },
  contextEntityTag: {
    backgroundColor: t.tagBg,
    color: t.tagText,
    padding: "4px 10px",
    borderRadius: "9999px",
    fontSize: "13px",
    fontWeight: "500"
  }
}; }