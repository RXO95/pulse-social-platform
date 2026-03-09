import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import { useTheme, getTheme } from "../context/ThemeContext";
import LikeButton from "../components/LikeButton";
import CommentButton from "../components/CommentButton";
import BookmarkButton from "../components/BookmarkButton";
import RepostButton from "../components/RepostButton";
import GifPicker from "../components/GifPicker";
import DarkModeToggle from "../components/DarkModeToggle";

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
  const [commentGifUrl, setCommentGifUrl] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  
  // --- NEW: Translation State ---
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  
  const token = localStorage.getItem("token");
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile, background);

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
    if (!newNote.trim() && !commentGifUrl) return;
    try {
      const body = { content: newNote.trim() };
      if (commentGifUrl) body.gif_url = commentGifUrl;
      const res = await fetch(`${API}/comments/${postId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setNewNote("");
        setCommentGifUrl(null);
        fetchNotes();
      }
    } catch {
      alert("Failed to add comment");
    }
  };

  // Delete a Comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`${API}/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotes(prev => prev.filter(n => n._id !== commentId));
      }
    } catch {
      alert("Failed to delete comment");
    }
  };

  // Toggle Like on Comment
  const handleCommentLike = async (commentId) => {
    // Optimistic update
    setNotes(prev => prev.map(n => {
      if (n._id !== commentId) return n;
      return {
        ...n,
        is_liked_by_user: !n.is_liked_by_user,
        likes: n.is_liked_by_user ? (n.likes || 1) - 1 : (n.likes || 0) + 1
      };
    }));
    try {
      const res = await fetch(`${API}/comments/${commentId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(prev => prev.map(n => {
          if (n._id !== commentId) return n;
          return { ...n, is_liked_by_user: data.liked, likes: data.likes };
        }));
      }
    } catch {
      // Revert on error
      setNotes(prev => prev.map(n => {
        if (n._id !== commentId) return n;
        return {
          ...n,
          is_liked_by_user: !n.is_liked_by_user,
          likes: n.is_liked_by_user ? (n.likes || 1) - 1 : (n.likes || 0) + 1
        };
      }));
    }
  };

  // Toggle Bookmark on Comment
  const handleCommentBookmark = async (commentId) => {
    setNotes(prev => prev.map(n => {
      if (n._id !== commentId) return n;
      return { ...n, is_bookmarked_by_user: !n.is_bookmarked_by_user };
    }));
    try {
      const res = await fetch(`${API}/comments/${commentId}/bookmark`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(prev => prev.map(n => {
          if (n._id !== commentId) return n;
          return { ...n, is_bookmarked_by_user: data.bookmarked };
        }));
      }
    } catch {
      setNotes(prev => prev.map(n => {
        if (n._id !== commentId) return n;
        return { ...n, is_bookmarked_by_user: !n.is_bookmarked_by_user };
      }));
    }
  };

  // Handle Repost
  const handleRepost = async (postId) => {
    const wasReposted = post.is_reposted_by_user;
    setPost(prev => ({
      ...prev,
      is_reposted_by_user: !wasReposted,
      repost_count: wasReposted ? (prev.repost_count || 1) - 1 : (prev.repost_count || 0) + 1
    }));
    try {
      await fetch(`${API}/reposts/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      setPost(prev => ({
        ...prev,
        is_reposted_by_user: wasReposted,
        repost_count: wasReposted ? (prev.repost_count || 0) : (prev.repost_count || 1) - 1
      }));
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
          <button onClick={() => navigate(-1)} style={styles.backButton}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"/></svg>
          </button>
          <h3 style={{margin:0, color: t.text}}>Post Details</h3>
          {mobile && <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>}
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

        {/* --- POST GIF --- */}
        {post.gif_url && !post.media_url && (
          <div style={styles.mediaContainer}>
            <img src={post.gif_url} alt="GIF" style={styles.media} />
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
          <RepostButton
            isReposted={post.is_reposted_by_user}
            count={post.repost_count || 0}
            onRepost={() => handleRepost(post._id)}
            onQuote={() => navigate(`/compose?quote=${post._id}`)}
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
          {commentGifUrl && (
            <div style={{position: "relative", borderRadius: "12px", overflow: "hidden", maxWidth: "200px", marginBottom: "8px"}}>
              <img src={commentGifUrl} alt="GIF" style={{width: "100%", borderRadius: "12px"}} />
              <button onClick={() => setCommentGifUrl(null)} style={{position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center"}}>&times;</button>
            </div>
          )}
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <button onClick={() => setShowGifPicker(true)} style={{background: "none", border: `1px solid ${t.border}`, borderRadius: "8px", padding: "6px 10px", color: t.accentBlue, fontWeight: "700", fontSize: "13px", cursor: "pointer"}}>GIF</button>
            <button onClick={handleSubmitNote} style={styles.postBtn}>Post</button>
          </div>
        </div>

        <div style={styles.notesList}>
          {notes.map((note) => (
            <div key={note._id} style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <strong 
                  style={{cursor: "pointer"}}
                  onClick={() => navigate(`/profile/${note.username}`)}
                >@{note.username}</strong>
                <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                  <small style={{color: t.textSecondary}}>{new Date(note.created_at).toLocaleDateString()}</small>
                  {currentUser && currentUser.username === note.username && (
                    <button
                      onClick={() => handleDeleteComment(note._id)}
                      title="Delete comment"
                      style={styles.deleteBtn}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M16 6V4.5C16 3.12 14.88 2 13.5 2h-3C9.11 2 8 3.12 8 4.5V6H3v2h1.06l.81 11.21C4.98 20.78 6.28 22 7.86 22h8.27c1.58 0 2.89-1.22 2.99-2.79L19.93 8H21V6h-5zm-6-1.5c0-.28.22-.5.5-.5h3c.27 0 .5.22.5.5V6h-4V4.5zM17.13 19.1c-.04.52-.47.9-1 .9H7.86c-.53 0-.96-.38-1-.9L6.07 8h11.85l-.79 11.1zM9 17h2V10H9v7zm4 0h2V10h-2v7z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {note.content && <p style={{margin:"5px 0", fontSize:"14px", color: t.text, wordBreak: "break-word"}}>{note.content}</p>}
              {note.gif_url && (
                <img src={note.gif_url} alt="GIF" style={{maxWidth: "200px", borderRadius: "12px", marginTop: "6px"}} />
              )}
              {/* Comment Action Buttons */}
              <div style={styles.commentActions}>
                {/* Like */}
                <div
                  style={{...styles.commentActionBtn, color: note.is_liked_by_user ? "#F4212E" : t.textSecondary}}
                  onClick={() => handleCommentLike(note._id)}
                  title="Like"
                >
                  {note.is_liked_by_user ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#F4212E">
                      <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.45-4.92-.334-6.98C3.907 4.19 6.043 3 8.399 3c1.837 0 3.238.84 4.1 1.78A5.61 5.61 0 0 1 16.6 3c2.358 0 4.494 1.19 5.617 3.21 1.116 2.06 1.026 4.48-.333 6.98z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.56-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.45-4.92-.334-6.98C3.907 4.19 6.043 3 8.399 3c1.837 0 3.238.84 4.1 1.78A5.61 5.61 0 0 1 16.6 3c2.358 0 4.494 1.19 5.617 3.21 1.116 2.06 1.026 4.48-.333 6.98z"/>
                    </svg>
                  )}
                  {(note.likes || 0) > 0 && <span style={{fontSize: "12px"}}>{note.likes}</span>}
                </div>
                {/* Reply (scroll to comment box) */}
                <div
                  style={styles.commentActionBtn}
                  onClick={() => {
                    const ta = document.querySelector('textarea');
                    if (ta) { ta.focus(); ta.value = `@${note.username} `; setNewNote(`@${note.username} `); }
                  }}
                  title="Reply"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/>
                  </svg>
                </div>
                {/* Bookmark */}
                <div
                  style={{...styles.commentActionBtn, color: note.is_bookmarked_by_user ? "#1d9bf0" : t.textSecondary}}
                  onClick={() => handleCommentBookmark(note._id)}
                  title={note.is_bookmarked_by_user ? "Remove bookmark" : "Bookmark"}
                >
                  {note.is_bookmarked_by_user ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#1d9bf0">
                      <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
          {notes.length === 0 && <p style={{color: t.textSecondary, fontStyle:"italic"}}>No comments yet.</p>}
        </div>
      </div>
      </div>

      {showGifPicker && (
        <GifPicker
          theme={t}
          onSelect={(url) => { setCommentGifUrl(url); setShowGifPicker(false); }}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
}

function getStyles(t, m, bg) { const glass = bg && bg !== "none"; return {
  fullScreenWrapper: { flex: 1, display: "flex", flexDirection: "column", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: "hidden", color: t.text },
  navBar: { height: "53px", backgroundColor: glass ? "rgba(255,255,255,0.14)" : t.headerBg, borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 100, backdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)", WebkitBackdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)", transition: "background-color 0.3s" },
  navContent: { width: "100%", maxWidth: "600px", display: "flex", alignItems: "center", gap: m ? "12px" : "20px", padding: m ? "0 12px" : "0 20px" },
  backButton: { background: "none", border: "none", cursor: "pointer", padding: "8px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: t.text, flexShrink: 0 },
  scrollArea: { flex: 1, overflowY: "auto", maxWidth: "600px", width: "100%", margin: "0 auto", padding: m ? "0" : "0", paddingBottom: m ? "70px" : "0", borderLeft: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`, borderRight: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`, ...(glass && { backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", backgroundColor: "rgba(255,255,255,0.1)" }) },
  
  card: { backgroundColor: glass ? "rgba(255,255,255,0.1)" : t.cardBg, borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.15)" : t.border}`, padding: m ? "16px" : "20px", transition: "background-color 0.3s" },
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

  notesSection: { marginTop: "0", borderTop: `1px solid ${glass ? "rgba(255,255,255,0.1)" : t.border}`, padding: m ? "16px" : "20px" },
  sectionTitle: { fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: t.text },
  inputGroup: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" },
  textarea: { padding: "14px", borderRadius: "12px", border: `1px solid ${t.inputBorder}`, resize: "none", height: "64px", fontFamily: "inherit", backgroundColor: t.inputBg, color: t.text, transition: "background-color 0.3s, border-color 0.2s", fontSize: "15px", outline: "none" },
  postBtn: { alignSelf: "flex-end", backgroundColor: t.accentBlue, color: "#fff", border: "none", padding: "10px 24px", borderRadius: "9999px", fontWeight: "700", fontSize: "15px", cursor: "pointer", transition: "all 0.2s" },
  
  notesList: { display: "flex", flexDirection: "column", gap: "0" },
  noteCard: { backgroundColor: "transparent", padding: m ? "12px 0" : "14px 0", borderBottom: `1px solid ${t.border}`, transition: "background-color 0.3s" },
  noteHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", fontSize: "13px", color: t.text },

  commentActions: {
    display: "flex",
    alignItems: "center",
    gap: m ? "20px" : "24px",
    marginTop: "8px",
    paddingTop: "4px"
  },
  commentActionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
    color: t.textSecondary,
    fontSize: "13px",
    padding: "4px",
    borderRadius: "50%",
    transition: "color 0.2s"
  },
  deleteBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: t.textSecondary,
    padding: "4px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s"
  },
  
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