import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import LikeButton from "../components/LikeButton";
import CommentButton from "../components/CommentButton";
import BookmarkButton from "../components/BookmarkButton";
import PostLoader from "../components/PostLoader";
import DarkModeToggle from "../components/DarkModeToggle";
import BottomNav from "../components/BottomNav";
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

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  
  // Media upload state
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const mediaInputRef = useRef(null);

  const { logout } = useAuth();
  const navigate = useNavigate(); 
  const token = localStorage.getItem("token");
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile);

  // --- FETCH CURRENT USER ---
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch {
      console.error("Failed to load user profile");
    }
  };

  const fetchPosts = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      const res = await fetch(`${API}/posts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { logout(); return; }
      const data = await res.json();
      // Initialize translation properties for each post
      const processedPosts = data.map(p => ({
        ...p,
        translatedText: null,
        showTranslation: false
      }));
      setPosts(processedPosts);
    } catch {
      alert("Failed to load feed");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${API}/trending/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTrending(data);
    } catch {
      console.error("Failed to load trending");
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchPosts();
      return;
    }
    try {
      const res = await fetch(`${API}/search/?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        console.error("Search failed with status:", res.status);
        alert("Search failed. Please try again.");
        return;
      }
      
      const data = await res.json();
      console.log("Search results:", data);
      setPosts(data.results || []);
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed. Please check the console for details.");
    }
  };

  const handleLike = async (postId) => {
    // Find the post to get current state
    const post = posts.find(p => p._id === postId);
    if (!post) return;
    
    // Optimistic UI update
    const wasLiked = post.is_liked_by_user;
    const newLikeCount = wasLiked ? post.likes - 1 : post.likes + 1;
    
    setPosts(posts.map(p => 
      p._id === postId 
        ? { ...p, is_liked_by_user: !wasLiked, likes: newLikeCount } 
        : p
    ));
    
    try {
      const res = await fetch(`${API}/likes/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Update with actual server values
        setPosts(prev => prev.map(p => 
          p._id === postId 
            ? { ...p, is_liked_by_user: data.liked, likes: data.likes } 
            : p
        ));
      } else {
        // Revert on error
        setPosts(prev => prev.map(p => 
          p._id === postId 
            ? { ...p, is_liked_by_user: wasLiked, likes: post.likes } 
            : p
        ));
      }
    } catch {
      // Revert on error
      setPosts(prev => prev.map(p => 
        p._id === postId 
          ? { ...p, is_liked_by_user: wasLiked, likes: post.likes } 
          : p
      ));
    }
  };

  const handleFollowToggle = async (postAuthorId, isFollowing) => {
    // Optimistic UI update - update all posts by this author
    setPosts(posts.map(p => 
      p.user_id === postAuthorId 
        ? { ...p, is_followed_by_user: !isFollowing } 
        : p
    ));
    
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`${API}/follow/${postAuthorId}`, {
        method: method,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        // Revert on error
        setPosts(prev => prev.map(p => 
          p.user_id === postAuthorId 
            ? { ...p, is_followed_by_user: isFollowing } 
            : p
        ));
        const data = await res.json();
        alert(data.message || "Action failed");
      }
    } catch {
      // Revert on error
      setPosts(prev => prev.map(p => 
        p.user_id === postAuthorId 
          ? { ...p, is_followed_by_user: isFollowing } 
          : p
      ));
      alert("Network error while updating follow status");
    }
  };

  // --- NEW: HANDLE TRANSLATION ---
  const handleTranslate = async (postId, originalText) => {
    // 1. Find the post in state
    const postIndex = posts.findIndex(p => p._id === postId);
    if (postIndex === -1) return;
    const post = posts[postIndex];

    // 2. If already translated, just toggle visibility
    if (post.translatedText) {
      const updatedPosts = [...posts];
      updatedPosts[postIndex].showTranslation = !updatedPosts[postIndex].showTranslation;
      setPosts(updatedPosts);
      return;
    }

    // 3. If not, fetch translation
    try {
      const res = await fetch(`${API}/translate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: originalText, target_lang: "en" })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedPosts = [...posts];
        updatedPosts[postIndex].translatedText = data.translated_text;
        updatedPosts[postIndex].showTranslation = true;
        setPosts(updatedPosts);
      }
    } catch {
      alert("Translation failed");
    }
  };

  // --- NEW: HANDLE DELETE POST ---
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    try {
      const res = await fetch(`${API}/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // Remove from UI
        setPosts(posts.filter(p => p._id !== postId));
        setOpenMenuId(null);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete post");
      }
    } catch {
      alert("Could not delete post");
    }
  };

  // --- HANDLE BOOKMARK ---
  const handleBookmark = async (postId) => {
    try {
      const res = await fetch(`${API}/bookmarks/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        // Update UI optimistically
        setPosts(posts.map(p => 
          p._id === postId ? { ...p, is_bookmarked: data.bookmarked } : p
        ));
      }
    } catch {
      console.error("Bookmark failed");
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchTrending();
    fetchCurrentUser(); 
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && !e.target.closest('[data-menu]')) {
        setOpenMenuId(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Handle media file selection
  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
    }
  };

  // Clear media selection
  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
  };

  const createPost = async () => {
    if (!content.trim() && !mediaFile) return;
    const startTime = Date.now();
    try {
      setIsPosting(true);
      
      let res;
      
      if (mediaFile) {
        // Use FormData with /posts/with-media endpoint for media posts
        const formData = new FormData();
        formData.append("content", content.trim() || " ");
        formData.append("media", mediaFile);
        
        res = await fetch(`${API}/posts/with-media`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });
      } else {
        // Use JSON for text-only posts (more compatible)
        res = await fetch(`${API}/posts/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ content: content.trim() })
        });
      }
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.detail?.message || data.detail || "Post blocked");
        return;
      }
      setContent("");
      clearMedia();
      await fetchPosts(false);
      fetchTrending();
      
      // Ensure loader shows for at least 1 second
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
      }
    } catch {
      alert("Could not create post");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoGroup}>
             <img src={darkMode ? "/logo-dark.png" : "/logo-light.png"} alt="Pulse" style={styles.logoImage} />
          </div>
          
          <input 
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={styles.searchInput}
          />

          <div style={{ display: "flex", gap: mobile ? "6px" : "10px", alignItems: "center" }}>
            <DarkModeToggle />
            {!mobile && (
              <>
                <button 
                  onClick={() => navigate("/bookmarks")}
                  style={styles.profileBtn}
                  aria-label="Bookmarks"
                >
                  Bookmarks
                </button>
                <button 
                  onClick={() => currentUser && navigate(`/profile/${currentUser.username}`)}
                  style={styles.profileBtn}
                >
                  Profile
                </button>
              </>
            )}
            <button onClick={logout} style={styles.logoutBtn}>{mobile ? "Exit" : "Logout"}</button>
          </div>
        </div>
      </header>

      <div style={styles.layoutBody}>
        <main style={styles.mainContent}>
          <div style={styles.card}>
            <div style={{display: "flex", gap: "12px"}}>
            <div style={styles.composeAvatar}>
              {currentUser?.profile_pic_url ? (
                <img src={currentUser.profile_pic_url} alt="" style={{width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover"}} />
              ) : (
                currentUser?.username?.charAt(0).toUpperCase() || "?"
              )}
            </div>
              <div style={{flex: 1, minWidth: 0}}>
                <textarea
                  placeholder="What's happening?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={styles.textarea}
                />
                
                {/* Media Preview */}
                {mediaPreview && (
                  <div style={styles.mediaPreviewContainer}>
                    <button onClick={clearMedia} style={styles.removeMediaBtn}>✕</button>
                    {mediaType === "video" ? (
                      <video src={mediaPreview} style={styles.mediaPreview} controls />
                    ) : (
                      <img src={mediaPreview} alt="Preview" style={styles.mediaPreview} />
                    )}
                  </div>
                )}
                
                <div style={styles.buttonContainer}>
                  {/* Media Upload Button */}
                  <input 
                    type="file" 
                    ref={mediaInputRef} 
                    accept="image/*,video/*" 
                    onChange={handleMediaSelect}
                    style={{display: "none"}}
                  />
                  <button 
                    onClick={() => mediaInputRef.current?.click()} 
                    style={styles.mediaBtn}
                    title="Add image or video"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7C8.784 7 8 7.784 8 8.75s.784 1.75 1.75 1.75 1.75-.784 1.75-1.75S10.716 7 9.75 7z"/>
                    </svg>
                  </button>
                  <button 
                    onClick={createPost} 
                    style={{...styles.postButton, opacity: (content.trim() || mediaFile) ? 1 : 0.5}}
                    disabled={!content.trim() && !mediaFile}
                  >
                    {isPosting ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.feedList}>
            {isPosting && <PostLoader />}
            {isLoading ? (
              <>
                <PostLoader />
                <PostLoader />
                <PostLoader />
                <PostLoader />
              </>
            ) : (
              posts.map((p) => (
              <div key={p._id} style={styles.postCard}>
                <div style={styles.postHeader}>
                  <div style={styles.avatar}>
                    {p.profile_pic_url ? (
                      <img src={p.profile_pic_url} alt="" style={{width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover"}} />
                    ) : (
                      p.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={styles.userMeta}>
                    <div style={styles.usernameRow}>
                      <strong 
                        style={{...styles.username, cursor: "pointer"}}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${p.username}`);
                        }}
                      >
                        @{p.username}
                      </strong>
                      <span style={styles.timestamp}>· {timeAgo(p.created_at)}</span>
                    </div>
                    {currentUser && p.username !== currentUser.username && (
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleFollowToggle(p.user_id, p.is_followed_by_user);
                        }}
                        style={p.is_followed_by_user ? styles.unfollowBtn : styles.followBtn}
                      >
                        {p.is_followed_by_user ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                  
                  {/* 3-Dot Menu for Post Owner */}
                  {currentUser && p.username === currentUser.username && (
                    <div style={styles.menuContainer} data-menu>
                      <button 
                        style={styles.menuButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === p._id ? null : p._id);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.hoverBg}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        ⋮
                      </button>
                      {openMenuId === p._id && (
                        <div style={styles.dropdown}>
                          <button 
                            style={styles.deleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePost(p._id);
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.hoverBg}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                          >
                            Delete Post
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* --- CLICKABLE POST AREA --- */}
                <div 
                  style={{cursor: "pointer"}} 
                  onClick={() => navigate(`/post/${p._id}`)}
                >
                    {/* Toggle between Original and Translated Text */}
                    <p style={styles.postContent}>
                      {p.showTranslation ? p.translatedText : p.content}
                    </p>

                    {/* --- POST MEDIA --- */}
                    {p.media_url && (
                      <div style={styles.postMediaContainer} onClick={e => e.stopPropagation()}>
                        {p.media_type === "video" ? (
                          <video src={p.media_url} controls style={styles.postMedia} />
                        ) : (
                          <img src={p.media_url} alt="Post media" style={styles.postMedia} />
                        )}
                      </div>
                    )}

                    {/* --- TRANSLATE BUTTON --- */}
                    <div 
                      style={styles.translateBtn} 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent navigating to post details
                        handleTranslate(p._id, p.content);
                      }}
                    >
                       {p.showTranslation ? "See Original" : "Translate Post"}
                    </div>

                    {p.risk_score > 0.6 && (
                    <div style={styles.riskBadge}>⚠ High Risk Content</div>
                    )}

                    <div style={styles.entityContainer}>
                    {p.entities?.map((e, idx) => {
                        const isMention = e.source === "mention" || e.text.startsWith("@");
                        const isHashtag = e.source === "hashtag" || e.text.startsWith("#");
                        
                        return (
                          <span 
                            key={idx} 
                            style={{
                              ...styles.tag, 
                              cursor: "pointer",
                              ...(isMention && styles.mentionTag),
                              ...(isHashtag && styles.hashtagTag)
                            }}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (isMention) {
                                // Navigate to user profile (strip @ symbol)
                                navigate(`/profile/${e.text.replace('@', '')}`);
                              } else if (isHashtag) {
                                // Navigate to entity page with the identified_as or normalized text
                                const entityName = e.identified_as || e.text.replace('#', '');
                                navigate(`/entity/${encodeURIComponent(entityName)}`);
                              } else {
                                navigate(`/entity/${encodeURIComponent(e.text)}`);
                              }
                            }}
                          >
                          {e.text} <small style={styles.tagLabel}>{e.label}</small>
                          </span>
                        );
                    })}
                    </div>
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
            ))
            )}
          </div>
        </main>

        <aside style={styles.sidebar}>
          <div style={styles.trendingCard}>
            <h3 
              style={{...styles.trendingTitle, cursor: "pointer"}} 
              onClick={() => navigate("/trending")}
            >
              What's Happening
            </h3>
            {trending.length > 0 ? (
              <>
                {trending.slice(0, 5).map((item, index) => (
                  <div key={index} style={styles.trendingItem} onClick={() => navigate(`/entity/${encodeURIComponent(item.topic)}`)}>
                    <div style={styles.trendingLabel}>{item.label} · Trending</div>
                    <div style={styles.trendingTopic}>#{item.topic}</div>
                    <div style={styles.trendingCount}>{item.count} posts</div>
                  </div>
                ))}
                <div 
                  style={styles.showMoreLink} 
                  onClick={() => navigate("/trending")}
                >
                  Show more
                </div>
              </>
            ) : (
              <p style={{ fontSize: "14px", color: t.textSecondary }}>Nothing trending yet...</p>
            )}
          </div>
        </aside>
      </div>
      {mobile && <BottomNav currentUser={currentUser} />}
    </div>
  );
}

function getStyles(t, m) { return {
  fullScreenWrapper: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: t.bg,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    overflow: "hidden",
    color: t.text,
    transition: "background-color 0.3s, color 0.3s"
  },
  header: {
    height: m ? "53px" : "53px",
    backgroundColor: t.headerBg,
    borderBottom: `1px solid ${t.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    transition: "background-color 0.3s"
  },
  headerContent: {
    width: "100%",
    maxWidth: "1280px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: m ? "0 12px" : "0 24px",
    gap: m ? "8px" : "16px"
  },
  layoutBody: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    maxWidth: "1280px",
    margin: "0 auto",
    gap: "0",
    flex: 1,
    overflow: "hidden"
  },
  logoGroup: { display: "flex", alignItems: "center", gap: "10px" },
  logoImage: {
    height: m ? "28px" : "34px",
    width: "auto",
    objectFit: "contain"
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: m ? "8px 12px" : "10px 15px",
    borderRadius: "9999px",
    border: `1px solid ${t.inputBorder}`,
    backgroundColor: t.inputBg,
    color: t.text,
    outline: "none",
    fontSize: "15px",
    transition: "background-color 0.3s, border-color 0.3s"
  },
  title: { fontSize: "22px", fontWeight: "800", margin: 0, color: t.accent },
  logoutBtn: { 
    background: "transparent", 
    border: `1px solid ${t.border}`, 
    borderRadius: "9999px", 
    padding: m ? "6px 12px" : "8px 18px", 
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    color: t.text,
    flexShrink: 0,
    transition: "all 0.2s"
  },
  profileBtn: {
    backgroundColor: t.accent,
    color: "#ffffff",
    border: "none",
    borderRadius: "9999px",
    padding: m ? "6px 12px" : "8px 18px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "700",
    flexShrink: 0,
    transition: "all 0.2s"
  },
  mainContent: {
    flex: 1,
    overflowY: "auto",
    padding: "0",
    paddingBottom: m ? "70px" : "0",
    maxWidth: "600px",
    width: "100%",
    borderRight: m ? "none" : `1px solid ${t.border}`,
    borderLeft: m ? "none" : `1px solid ${t.border}`,
  },
  sidebar: {
    width: "350px",
    padding: "12px 24px",
    display: m ? "none" : "block",
    overflowY: "auto",
  },
  trendingCard: {
    backgroundColor: t.cardBg,
    borderRadius: "16px",
    padding: "12px 0",
    border: `1px solid ${t.border}`,
    transition: "background-color 0.3s",
    overflow: "hidden"
  },
  trendingTitle: { fontSize: "20px", fontWeight: "800", padding: "4px 16px 12px", margin: 0, color: t.text },
  trendingItem: {
    padding: "12px 16px",
    cursor: "pointer",
    transition: "background 0.15s"
  },
  trendingLabel: { fontSize: "13px", color: t.textSecondary, fontWeight: "400" },
  trendingTopic: { fontSize: "15px", fontWeight: "700", margin: "2px 0", color: t.text },
  trendingCount: { fontSize: "13px", color: t.textSecondary },
  showMoreLink: { padding: "16px", color: t.accentBlue, fontSize: "15px", cursor: "pointer", fontWeight: "500" },
  composeAvatar: { width: "40px", height: "40px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "#1a1a1a", fontSize: "16px", flexShrink: 0 },
  card: { backgroundColor: t.cardBg, padding: m ? "12px" : "16px", borderBottom: `1px solid ${t.border}`, transition: "background-color 0.3s" },
  textarea: { width: "100%", minHeight: m ? "52px" : "56px", border: "none", outline: "none", fontSize: m ? "18px" : "20px", resize: "none", backgroundColor: "transparent", color: t.text, lineHeight: "1.4", padding: "8px 0" },
  buttonContainer: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${t.border}`, paddingTop: "12px", marginTop: "8px" },
  
  // Media upload styles
  mediaBtn: { background: "none", border: "none", color: t.accentBlue, cursor: "pointer", padding: "8px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 0.2s" },
  mediaPreviewContainer: { position: "relative", marginTop: "12px", borderRadius: "16px", overflow: "hidden", maxHeight: "300px", border: `1px solid ${t.border}` },
  mediaPreview: { width: "100%", maxHeight: "300px", objectFit: "cover", display: "block" },
  removeMediaBtn: { position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.75)", color: "#fff", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 },
  
  // Post media display styles
  postMediaContainer: { marginTop: "12px", borderRadius: "16px", overflow: "hidden", maxHeight: m ? "300px" : "500px", border: `1px solid ${t.border}` },
  postMedia: { width: "100%", maxHeight: m ? "300px" : "500px", objectFit: "cover", display: "block" },
  
  postButton: { backgroundColor: t.accentBlue, color: "#fff", border: "none", padding: m ? "8px 20px" : "10px 24px", borderRadius: "9999px", fontWeight: "700", fontSize: "15px", cursor: "pointer", transition: "all 0.2s" },
  feedList: { display: "flex", flexDirection: "column", gap: "0", paddingBottom: "100px" },
  postCard: { backgroundColor: t.cardBg, padding: m ? "12px 12px 4px" : "16px 16px 4px", borderBottom: `1px solid ${t.border}`, transition: "background-color 0.15s" },
  postHeader: { display: "flex", alignItems: "flex-start", marginBottom: "4px" },
  userMeta: { display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, minWidth: 0, gap: "8px" },
  avatar: { width: m ? "38px" : "40px", height: m ? "38px" : "40px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", fontWeight: "700", color: "#1a1a1a", fontSize: m ? "15px" : "16px", flexShrink: 0 },
  usernameRow: { display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" },
  username: { fontSize: "15px", fontWeight: "700", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  timestamp: { fontSize: "14px", color: t.textSecondary, whiteSpace: "nowrap", flexShrink: 0 },
  postContent: { fontSize: "15px", lineHeight: "1.5", margin: "4px 0 8px 0", color: t.text, wordBreak: "break-word" },
  
  translateBtn: {
    color: t.accentBlue,
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    marginBottom: "10px",
    display: "inline-block"
  },

  riskBadge: { backgroundColor: t.riskBg, color: t.riskText, padding: "5px 10px", borderRadius: "4px", fontSize: "12px", marginTop: "8px", display: "inline-block" },
  entityContainer: { display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" },
  tag: { backgroundColor: t.tagBg, color: t.tagText, padding: "3px 10px", borderRadius: "9999px", fontSize: m ? "12px" : "13px", fontWeight: "500", border: "1px solid transparent" },
  tagLabel: { color: t.textSecondary, fontSize: "11px", marginLeft: "2px" },
  mentionTag: { backgroundColor: "rgba(29, 155, 240, 0.15)", borderColor: "#1d9bf0" },
  hashtagTag: { backgroundColor: "rgba(0, 186, 124, 0.15)", borderColor: "#00ba7c" },
  actionSection: {
    display: "flex",
    alignItems: "center",
    gap: m ? "16px" : "24px",
    marginTop: "8px",
    paddingTop: "4px"
  },
  followBtn: {
    backgroundColor: t.text === "#e7e9ea" ? "#eff3f4" : "#0f1419",
    color: t.text === "#e7e9ea" ? "#0f1419" : "#ffffff",
    border: "none",
    borderRadius: "9999px",
    padding: m ? "4px 14px" : "6px 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s",
    flexShrink: 0
  },
  unfollowBtn: {
    backgroundColor: "transparent",
    color: t.text,
    border: `1px solid ${t.border}`,
    borderRadius: "9999px",
    padding: m ? "4px 14px" : "6px 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s",
    flexShrink: 0
  },
  menuContainer: {
    position: "relative"
  },
  menuButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: "20px",
    borderRadius: "50%",
    transition: "background 0.2s",
    color: t.textSecondary
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    backgroundColor: t.cardBg,
    border: `1px solid ${t.border}`,
    borderRadius: "12px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    minWidth: "160px",
    zIndex: 10,
    marginTop: "4px",
    overflow: "hidden"
  },
  deleteBtn: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "12px 16px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    color: t.riskText,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "background 0.2s",
    borderRadius: "12px"
  }
}; }