import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import LikeButton from "../components/LikeButton";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const token = localStorage.getItem("token");

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
      const res = await fetch(`${API}/posts`, {
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

  if (!profile) return <div style={{textAlign:"center", marginTop: 50}}>Loading...</div>;

  return (
    <div style={styles.container}>
      {/* HEADER / NAV */}
      <div style={styles.navBar}>
        <button onClick={() => navigate("/feed")} style={styles.backButton}>← Back</button>
        <h3 style={{margin:0}}>@{profile.username}</h3>
      </div>

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
        {posts.length === 0 && <p style={{color:"#888", textAlign:"center"}}>No posts yet.</p>}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: "600px", margin: "0 auto", paddingBottom: "50px", fontFamily: "sans-serif" },
  navBar: { display: "flex", gap: "20px", alignItems: "center", padding: "15px", borderBottom: "1px solid #eee" },
  backButton: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "#1d9bf0" },
  
  profileHeader: { borderBottom: "1px solid #eee", paddingBottom: "20px" },
  coverImage: { height: "150px", background: "linear-gradient(135deg, #764ba2, #667eea)" },
  headerContent: { padding: "0 20px", marginTop: "-50px", position: "relative" },
  avatarLarge: { width: "100px", height: "100px", borderRadius: "50%", border: "4px solid white", backgroundColor: "#ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", fontWeight: "bold" },
  
  actionRow: { display: "flex", justifyContent: "flex-end", marginTop: "-40px", marginBottom: "20px" },
  name: { fontSize: "24px", margin: "10px 0 5px 0" },
  bio: { color: "#555", marginBottom: "15px" },
  statsRow: { display: "flex", gap: "20px", fontSize: "14px" },
  stat: { color: "#333" },
  
  sectionTitle: { padding: "15px 20px 5px", margin: 0 },
  feedList: { display: "flex", flexDirection: "column", gap: "10px", padding: "10px" },
  postCard: { backgroundColor: "#fff", border: "1px solid #eee", borderRadius: "12px", padding: "15px" },
  postHeader: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" },
  avatarSmall: { width: "30px", height: "30px", borderRadius: "50%", backgroundColor: "#ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "bold" },
  username: { fontSize: "15px" },
  postContent: { fontSize: "16px", margin: "5px 0" },
  entityContainer: { display: "flex", gap: "5px", marginTop: "8px" },
  tag: { backgroundColor: "#e8f5fd", color: "#1d9bf0", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" },

  followBtn: { backgroundColor: "#1a1a1a", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 20px", fontWeight: "bold", cursor: "pointer" },
  unfollowBtn: { backgroundColor: "transparent", color: "#1a1a1a", border: "1px solid #ddd", borderRadius: "20px", padding: "8px 20px", fontWeight: "bold", cursor: "pointer" }
};