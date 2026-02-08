import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import { useTheme, getTheme } from "../context/ThemeContext";
import LikeButton from "../components/LikeButton";
import DarkModeToggle from "../components/DarkModeToggle";
import useIsMobile from "../hooks/useIsMobile";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const token = localStorage.getItem("token");
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile);

  // Fetch Profile Info
  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API}/users/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      console.error("Failed to load profile");
    }
  };

  // Fetch User's Posts (Reuse existing feed endpoint filtering on client for now)
  // Ideally, create a backend endpoint: /posts/user/{username}
  const fetchUserPosts = async () => {
    try {
      const res = await fetch(`${API}/posts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const allPosts = await res.json();
        // Simple filter for the demo
        const userPosts = allPosts.filter(p => p.username === username);
        setPosts(userPosts);
      }
    } catch {
      console.error("Failed to load posts");
    }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    const method = profile.is_followed_by_user ? "DELETE" : "POST";
    
    try {
      const res = await fetch(`${API}/follow/${profile.user_id}`, {
        method: method,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchProfile(); // Refresh stats and button state
      }
    } catch {
      alert("Action failed");
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, [username]);

  if (!profile) return <div style={{textAlign:"center", marginTop: 50, color: t.text}}>Loading...</div>;

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.navBar}>
        <div style={styles.navContent}>
          <button onClick={() => navigate("/feed")} style={styles.backButton}>← Back</button>
          <h3 style={{margin:0, color: t.text}}>@{profile.username}</h3>
          <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
        </div>
      </header>

      <div style={styles.scrollArea}>

      {/* PROFILE HEADER CARD */}
      <div style={styles.profileHeader}>
        <div style={styles.coverImage}></div>
        <div style={styles.headerContent}>
          <div style={styles.avatarLarge}>
            {profile.username.charAt(0).toUpperCase()}
          </div>
          
          <div style={styles.actionRow}>
             <button 
                onClick={handleFollowToggle}
                style={profile.is_followed_by_user ? styles.unfollowBtn : styles.followBtn}
             >
                {profile.is_followed_by_user ? "Following" : "Follow"}
             </button>
          </div>

          <h1 style={styles.name}>@{profile.username}</h1>
          <p style={styles.bio}>{profile.bio}</p>

          <div style={styles.statsRow}>
            <span style={styles.stat}><strong>{profile.stats.posts}</strong> Posts</span>
            <span style={styles.stat}><strong>{profile.stats.followers}</strong> Followers</span>
            <span style={styles.stat}><strong>{profile.stats.following}</strong> Following</span>
          </div>
        </div>
      </div>

      {/* USER POSTS */}
      <div style={styles.feedList}>
        <h4 style={styles.sectionTitle}>Posts</h4>
        {posts.map((p) => (
          <div key={p._id} style={styles.postCard}>
            <div style={styles.postHeader}>
              <div style={styles.avatarSmall}>{p.username?.charAt(0).toUpperCase()}</div>
              <strong style={styles.username}>@{p.username}</strong>
            </div>
            <p style={styles.postContent}>{p.content}</p>
            <div style={styles.entityContainer}>
                {p.entities?.map((e, idx) => (
                  <span key={idx} style={styles.tag}>{e.text}</span>
                ))}
            </div>
          </div>
        ))}
        {posts.length === 0 && <p style={{color: t.textSecondary, textAlign:"center"}}>No posts yet.</p>}
      </div>
      </div>
    </div>
  );
}

function getStyles(t, m) { return {
  fullScreenWrapper: { height: "100vh", display: "flex", flexDirection: "column", backgroundColor: t.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: "hidden", color: t.text, transition: "background-color 0.3s, color 0.3s" },
  navBar: { height: "53px", backgroundColor: t.headerBg, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", transition: "background-color 0.3s" },
  navContent: { width: "100%", maxWidth: "600px", display: "flex", alignItems: "center", gap: m ? "12px" : "20px", padding: m ? "0 12px" : "0 20px" },
  backButton: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: t.accentBlue, fontWeight: "600", flexShrink: 0 },
  scrollArea: { flex: 1, overflowY: "auto" },
  
  profileHeader: { borderBottom: `1px solid ${t.border}`, paddingBottom: "20px", maxWidth: "600px", margin: "0 auto", width: "100%", borderLeft: m ? "none" : `1px solid ${t.border}`, borderRight: m ? "none" : `1px solid ${t.border}` },
  coverImage: { height: m ? "130px" : "200px", background: t.coverGradient },
  headerContent: { padding: m ? "0 16px" : "0 20px", marginTop: "-48px", position: "relative" },
  avatarLarge: { width: m ? "82px" : "134px", height: m ? "82px" : "134px", borderRadius: "50%", border: `4px solid ${t.bg}`, backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: m ? "32px" : "52px", fontWeight: "800", color: "#1a1a1a" },
  
  actionRow: { display: "flex", justifyContent: "flex-end", marginTop: m ? "-35px" : "-50px", marginBottom: "12px" },
  name: { fontSize: m ? "20px" : "22px", fontWeight: "800", margin: "12px 0 2px 0", color: t.text },
  bio: { color: t.textSecondary, marginBottom: "12px", fontSize: "15px", lineHeight: "1.4" },
  statsRow: { display: "flex", gap: m ? "16px" : "20px", fontSize: "14px", flexWrap: "wrap" },
  stat: { color: t.textSecondary, cursor: "pointer" },
  
  sectionTitle: { padding: "16px 16px 8px", margin: 0, color: t.text, fontSize: "16px", fontWeight: "700", borderBottom: `1px solid ${t.border}` },
  feedList: { display: "flex", flexDirection: "column", gap: "0", padding: "0", maxWidth: "600px", margin: "0 auto", width: "100%", borderLeft: m ? "none" : `1px solid ${t.border}`, borderRight: m ? "none" : `1px solid ${t.border}` },
  postCard: { backgroundColor: t.cardBg, borderBottom: `1px solid ${t.border}`, padding: m ? "12px 16px" : "16px 20px", transition: "background-color 0.15s" },
  postHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" },
  avatarSmall: { width: "32px", height: "32px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#1a1a1a", flexShrink: 0 },
  username: { fontSize: "15px", fontWeight: "700", color: t.text },
  postContent: { fontSize: "15px", lineHeight: "1.5", margin: "4px 0", color: t.text, wordBreak: "break-word" },
  entityContainer: { display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" },
  tag: { backgroundColor: t.tagBg, color: t.tagText, padding: "3px 10px", borderRadius: "9999px", fontSize: m ? "12px" : "13px", fontWeight: "500" },

  followBtn: { backgroundColor: t.text === "#e7e9ea" ? "#eff3f4" : "#0f1419", color: t.text === "#e7e9ea" ? "#0f1419" : "#ffffff", border: "none", borderRadius: "9999px", padding: m ? "8px 20px" : "10px 24px", fontWeight: "700", cursor: "pointer", fontSize: "15px", transition: "all 0.2s" },
  unfollowBtn: { backgroundColor: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: "9999px", padding: m ? "8px 20px" : "10px 24px", fontWeight: "700", cursor: "pointer", fontSize: "15px", transition: "all 0.2s" }
}; }