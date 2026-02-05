import { useEffect, useState } from "react";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import LikeButton from "../components/LikeButton";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [trending, setTrending] = useState([]); // Added state for trending
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { logout } = useAuth();
  const token = localStorage.getItem("token");

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { logout(); return; }
      const data = await res.json();
      setPosts(data);
    } catch {
      alert("Failed to load feed");
    }
  };

  // --- FETCH TRENDING DATA ---
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
        fetchPosts(); 
      } else {
        const data = await res.json();
        console.log(data.detail || "Already liked");
      }
    } catch {
      alert("Could not like post");
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchTrending(); // Initial trending load
  }, []);

  const createPost = async () => {
    if (!content.trim()) return;
    try {
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
      fetchTrending(); // Update trending when a new post is made
    } catch {
      alert("Could not create post");
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

          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
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
            {posts.map((p) => (
              <div key={p._id} style={styles.postCard}>
                <div style={styles.postHeader}>
                  <div style={styles.avatar}>{p.username?.charAt(0).toUpperCase()}</div>
                  <strong style={styles.username}>@{p.username}</strong>
                </div>

                <p style={styles.postContent}>{p.content}</p>

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

                <div style={styles.actionSection}>
                  <LikeButton 
                    isLiked={p.is_liked_by_user} 
                    count={p.likes || 0}
                    onLike={() => handleLike(p._id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* --- TRENDING SIDEBAR --- */}
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
    maxWidth: "1100px", // Expanded for sidebar
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
  logoutBtn: { background: "none", border: "1px solid #ddd", borderRadius: "20px", padding: "5px 15px", cursor: "pointer" },
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
  avatar: { width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#ffd700", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", fontWeight: "bold" },
  username: { fontSize: "15px" },
  postContent: { fontSize: "16px", margin: "5px 0" },
  riskBadge: { backgroundColor: "#ffeeee", color: "#ff0000", padding: "5px 10px", borderRadius: "4px", fontSize: "12px", marginTop: "8px", display: "inline-block" },
  entityContainer: { display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" },
  tag: { backgroundColor: "#e8f5fd", color: "#1d9bf0", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" },
  tagLabel: { color: "#536471", fontSize: "10px" },
  actionSection: {
    marginTop: "15px",
    paddingTop: "5px",
    borderTop: "1px solid #f0f2f5"
  },
};