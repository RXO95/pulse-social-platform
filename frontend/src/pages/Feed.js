import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; 
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import LikeButton from "../components/LikeButton";
import Loader from "../components/Loader";
import CommentButton from "../components/CommentButton";
import PostLoader from "../components/PostLoader";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isPosting, setIsPosting] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate(); 
  const token = localStorage.getItem("token");

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

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API}/posts`, {
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
      const res = await fetch(`${API}/trending`, {
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
      const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPosts(data.results || []);
    } catch {
      console.error("Search failed");
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await fetch(`${API}/likes/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        // Optimistic UI update or refetch
        fetchPosts(); 
      } else {
        const data = await res.json();
        console.log(data.detail || "Already liked");
      }
    } catch {
      alert("Could not like post");
    }
  };

  const handleFollowToggle = async (postAuthorId, isFollowing) => {
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`${API}/follow/${postAuthorId}`, {
        method: method,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchPosts(); 
      } else {
        const data = await res.json();
        alert(data.message || "Action failed");
      }
    } catch {
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

  const createPost = async () => {
    if (!content.trim()) return;
    try {
      setIsPosting(true);
      const res = await fetch(`${API}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Post blocked");
        return;
      }
      setContent("");
      fetchPosts();
      fetchTrending();
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
             <div style={styles.smallLogo}>P</div>
             <h2 style={styles.title}>Pulse</h2>
          </div>
          
          <input 
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={styles.searchInput}
          />

          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={() => currentUser && navigate(`/profile/${currentUser.username}`)}
              style={styles.profileBtn}
            >
              Profile
            </button>
            <button onClick={logout} style={styles.logoutBtn}>Logout</button>
          </div>
        </div>
      </header>

      <div style={styles.layoutBody}>
        <main style={styles.mainContent}>
          <div style={styles.card}>
            <textarea
              placeholder="What's happening?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={styles.textarea}
            />
            <div style={styles.buttonContainer}>
              <button onClick={createPost} style={styles.postButton}>Post</button>
            </div>
          </div>

          <div style={styles.feedList}>
            {isPosting && <PostLoader />}
            {isLoading ? (
              <Loader />
            ) : (
              posts.map((p) => (
              <div key={p._id} style={styles.postCard}>
                <div style={styles.postHeader}>
                  <div style={styles.avatar}>{p.username?.charAt(0).toUpperCase()}</div>
                  <div style={styles.userMeta}>
                    <strong 
                      style={{...styles.username, cursor: "pointer"}}
                      onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${p.username}`);
                      }}
                    >
                      @{p.username}
                    </strong>
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
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f7f9f9"}
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
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f7f9f9"}
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
                    {p.entities?.map((e, idx) => (
                        <span key={idx} style={styles.tag}>
                        {e.text} <small style={styles.tagLabel}>{e.label}</small>
                        </span>
                    ))}
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
                    count={0}
                  />
                </div>
              </div>
            ))
            )}
          </div>
        </main>

        <aside style={styles.sidebar}>
          <div style={styles.trendingCard}>
            <h3 style={styles.trendingTitle}>What's Happening</h3>
            {trending.length > 0 ? trending.map((item, index) => (
              <div key={index} style={styles.trendingItem} onClick={() => handleSearch(item.topic)}>
                <div style={styles.trendingLabel}>{item.label} · Trending</div>
                <div style={styles.trendingTopic}>#{item.topic}</div>
                <div style={styles.trendingCount}>{item.count} posts</div>
              </div>
            )) : (
              <p style={{ fontSize: "14px", color: "#666" }}>Nothing trending yet...</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

const styles = {
  fullScreenWrapper: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f0f2f5",
    fontFamily: '-apple-system, system-ui, sans-serif',
    overflow: "hidden"
  },
  header: {
    height: "70px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #ddd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "sticky",
    top: 0,
    zIndex: 100
  },
  headerContent: {
    width: "100%",
    maxWidth: "1100px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 20px",
    gap: "15px"
  },
  layoutBody: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    maxWidth: "1100px",
    margin: "0 auto",
    gap: "30px",
    flex: 1,
    overflow: "hidden"
  },
  logoGroup: { display: "flex", alignItems: "center", gap: "10px" },
  smallLogo: {
    width: "30px",
    height: "30px",
    backgroundColor: "#764ba2",
    color: "white",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold"
  },
  searchInput: {
    flex: 1,
    padding: "10px 15px",
    borderRadius: "20px",
    border: "1px solid #ddd",
    backgroundColor: "#f0f2f5",
    outline: "none",
    fontSize: "14px"
  },
  title: { fontSize: "22px", fontWeight: "800", margin: 0, color: "#764ba2" },
  logoutBtn: { 
    background: "none", 
    border: "1px solid #ddd", 
    borderRadius: "20px", 
    padding: "5px 15px", 
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500"
  },
  profileBtn: {
    backgroundColor: "#1a1a1a",
    color: "white",
    border: "none",
    borderRadius: "20px",
    padding: "5px 15px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600"
  },
  mainContent: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 0",
    maxWidth: "600px"
  },
  sidebar: {
    width: "350px",
    padding: "20px 0",
    display: "block",
  },
  trendingCard: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  trendingTitle: { fontSize: "18px", fontWeight: "800", marginBottom: "15px" },
  trendingItem: {
    padding: "12px 0",
    cursor: "pointer",
    borderBottom: "1px solid #f0f2f5",
    transition: "background 0.2s"
  },
  trendingLabel: { fontSize: "11px", color: "#65676b", textTransform: "uppercase", fontWeight: "600" },
  trendingTopic: { fontSize: "15px", fontWeight: "700", margin: "2px 0", color: "#1a1a1a" },
  trendingCount: { fontSize: "13px", color: "#65676b" },
  card: { backgroundColor: "#fff", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", marginBottom: "16px" },
  textarea: { width: "100%", height: "80px", border: "none", outline: "none", fontSize: "18px", resize: "none" },
  buttonContainer: { display: "flex", justifyContent: "flex-end", borderTop: "1px solid #eff3f4", paddingTop: "10px" },
  postButton: { backgroundColor: "#1d9bf0", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "30px", fontWeight: "bold", cursor: "pointer" },
  feedList: { display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "100px" },
  postCard: { backgroundColor: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #eff3f4" },
  postHeader: { display: "flex", alignItems: "center", marginBottom: "8px" },
  userMeta: { display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 },
  avatar: { width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#ffd700", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", fontWeight: "bold" },
  username: { fontSize: "15px" },
  postContent: { fontSize: "16px", margin: "5px 0" },
  
  // --- NEW STYLE FOR TRANSLATE BUTTON ---
  translateBtn: {
    color: "#1d9bf0",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    marginBottom: "10px",
    display: "inline-block"
  },

  riskBadge: { backgroundColor: "#ffeeee", color: "#ff0000", padding: "5px 10px", borderRadius: "4px", fontSize: "12px", marginTop: "8px", display: "inline-block" },
  entityContainer: { display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" },
  tag: { backgroundColor: "#e8f5fd", color: "#1d9bf0", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" },
  tagLabel: { color: "#536471", fontSize: "10px" },
  actionSection: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    marginTop: "15px",
    paddingTop: "5px",
    borderTop: "1px solid #f0f2f5"
  },
  followBtn: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: "20px",
    padding: "6px 16px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "background 0.2s"
  },
  unfollowBtn: {
    backgroundColor: "transparent",
    color: "#1a1a1a",
    border: "1px solid #ddd",
    borderRadius: "20px",
    padding: "6px 16px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s"
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
    color: "#536471"
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    backgroundColor: "#fff",
    border: "1px solid #eff3f4",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    minWidth: "150px",
    zIndex: 10,
    marginTop: "4px"
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
    color: "#f4212e",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "background 0.2s",
    borderRadius: "12px"
  }
};