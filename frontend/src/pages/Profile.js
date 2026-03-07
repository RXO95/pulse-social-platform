import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import DarkModeToggle from "../components/DarkModeToggle";

import Loader from "../components/Loader";
import PostLoader from "../components/PostLoader";
import useIsMobile from "../hooks/useIsMobile";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPicture, setEditPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const fileInputRef = useRef(null);
  const { logout } = useAuth();
  const token = localStorage.getItem("token");
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile, background);

  // Check if viewing own profile
  const isOwnProfile = currentUser && profile && currentUser.username === profile.username;

  // Fetch current user
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
      console.error("Failed to load current user");
    }
  };

  // Fetch Profile Info
  const fetchProfile = async () => {
    setIsLoadingProfile(true);
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
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Fetch User's Posts (Reuse existing feed endpoint filtering on client for now)
  // Ideally, create a backend endpoint: /posts/user/{username}
  const fetchUserPosts = async () => {
    setIsLoadingPosts(true);
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
    } finally {
      setIsLoadingPosts(false);
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

  // Open edit modal
  const openEditModal = () => {
    setEditUsername(profile.username || "");
    setEditBio(profile.bio || "");
    setEditPicture(null);
    setPicturePreview(profile.profile_pic_url || null);
    setIsEditing(true);
  };

  // Handle profile picture selection
  const handlePictureSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditPicture(file);
      setPicturePreview(URL.createObjectURL(file));
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      if (editUsername.trim() && editUsername !== profile.username) {
        formData.append("username", editUsername.trim());
      }
      formData.append("bio", editBio);
      if (editPicture) {
        formData.append("profile_picture", editPicture);
      }

      const res = await fetch(`${API}/users/me`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        // If username changed, navigate to new profile URL
        if (data.user.username !== username) {
          navigate(`/profile/${data.user.username}`, { replace: true });
        } else {
          fetchProfile();
          fetchCurrentUser();
        }
        setIsEditing(false);
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to update profile");
      }
    } catch {
      alert("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    fetchCurrentUser();
  }, [username]);

  if (isLoadingProfile || !profile) return (
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: t.bg}}>
      <Loader />
    </div>
  );

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.navBar}>
        <div style={styles.navContent}>
          <button onClick={() => navigate(-1)} style={styles.backButton}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"/></svg>
          </button>
          <h3 style={{margin:0, color: t.text}}>@{profile.username}</h3>
          {mobile && <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>}
        </div>
      </header>

      <div style={styles.scrollArea}>

      {/* PROFILE HEADER CARD */}
      <div style={styles.profileHeader}>
        <div style={styles.coverImage}></div>
        <div style={styles.headerContent}>
          {/* Avatar with profile picture */}
          <div style={{...styles.avatarLarge, ...(profile.profile_pic_url ? styles.avatarWithImage : {})}}>
            {profile.profile_pic_url ? (
              <img 
                src={profile.profile_pic_url} 
                alt={profile.username} 
                style={styles.avatarImage}
              />
            ) : (
              profile.username.charAt(0).toUpperCase()
            )}
          </div>
          
          <div style={styles.actionRow}>
            {isOwnProfile ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={openEditModal} style={styles.editBtn}>
                  Edit Profile
                </button>
                <button onClick={logout} style={{ ...styles.editBtn, color: "#f4212e", borderColor: "#f4212e" }}>
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={handleFollowToggle}
                  style={profile.is_followed_by_user ? styles.unfollowBtn : styles.followBtn}
                >
                  {profile.is_followed_by_user ? "Following" : "Follow"}
                </button>
                <button
                  onClick={() => navigate(`/messages?userId=${profile.user_id}`)}
                  style={{ ...styles.editBtn, marginLeft: 8 }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: 4 }}>
                    <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.14 8-5.14V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 4.971l-8 5.14-8-5.14V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.529z"/>
                  </svg>
                  Message
                </button>
              </>
            )}
          </div>

          <h1 style={styles.name}>@{profile.username}</h1>
          <p style={styles.bio}>{profile.bio}</p>

          <div style={styles.statsRow}>
            <span style={styles.stat}><strong>{profile.stats.posts}</strong> Posts</span>
            <span 
              style={{...styles.stat, cursor: "pointer"}}
              onClick={() => navigate(`/profile/${profile.username}/followers`)}
            >
              <strong>{profile.stats.followers}</strong> Followers
            </span>
            <span 
              style={{...styles.stat, cursor: "pointer"}}
              onClick={() => navigate(`/profile/${profile.username}/following`)}
            >
              <strong>{profile.stats.following}</strong> Following
            </span>
          </div>
        </div>
      </div>

      {/* USER POSTS */}
      <div style={styles.feedList}>
        <h4 style={styles.sectionTitle}>Posts</h4>
        {isLoadingPosts ? (
          <>
            <PostLoader />
            <PostLoader />
          </>
        ) : posts.length === 0 ? (
          <p style={{color: t.textSecondary, textAlign: "center", padding: 20}}>No posts yet</p>
        ) : (
          posts.map((p) => (
          <div key={p._id} style={styles.postCard}>
            <div style={styles.postHeader}>
              <div style={styles.avatarSmall}>
                {profile.profile_pic_url ? (
                  <img src={profile.profile_pic_url} alt="" style={styles.avatarImageSmall} />
                ) : (
                  p.username?.charAt(0).toUpperCase()
                )}
              </div>
              <strong style={styles.username}>@{p.username}</strong>
            </div>
            <p style={styles.postContent}>{p.content}</p>
            {/* Render media if exists */}
            {p.media_url && (
              <div style={styles.mediaContainer}>
                {p.media_type === "video" ? (
                  <video src={p.media_url} controls style={styles.mediaVideo} />
                ) : (
                  <img src={p.media_url} alt="Post media" style={styles.mediaImage} />
                )}
              </div>
            )}
            <div style={styles.entityContainer}>
                {p.entities?.map((e, idx) => (
                  <span key={idx} style={styles.tag}>{e.text}</span>
                ))}
            </div>
          </div>
        ))
        )}
      </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditing && (
        <div style={styles.modalOverlay} onClick={() => setIsEditing(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Edit Profile</h2>
            
            {/* Profile Picture */}
            <div style={styles.editAvatarSection}>
              <div 
                style={styles.editAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                {picturePreview ? (
                  <img src={picturePreview} alt="Preview" style={styles.avatarImage} />
                ) : (
                  <span style={styles.avatarPlaceholder}>📷</span>
                )}
                <div style={styles.avatarOverlay}>Change</div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePictureSelect}
                style={{display: "none"}}
              />
              <span style={styles.editAvatarHint}>Click to change profile picture</span>
            </div>

            {/* Username */}
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={editUsername}
              onChange={e => setEditUsername(e.target.value)}
              style={styles.input}
              placeholder="Username"
            />

            {/* Bio */}
            <label style={styles.label}>Bio</label>
            <textarea
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              style={styles.textarea}
              placeholder="Write something about yourself..."
              rows={3}
            />

            {/* Actions */}
            <div style={styles.modalActions}>
              <button onClick={() => setIsEditing(false)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile} 
                style={styles.saveBtn}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStyles(t, m, bg) {
  const glass = bg && bg !== "none";
  return {
  fullScreenWrapper: { flex: 1, display: "flex", flexDirection: "column", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: "hidden", color: t.text },
  navBar: { height: "53px", backgroundColor: glass ? "rgba(0,0,0,0.6)" : t.headerBg, borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.06)" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 100, backdropFilter: glass ? "blur(20px) saturate(1.4)" : "blur(12px)", WebkitBackdropFilter: glass ? "blur(20px) saturate(1.4)" : "blur(12px)", transition: "background-color 0.3s" },
  navContent: { width: "100%", maxWidth: "600px", display: "flex", alignItems: "center", gap: m ? "12px" : "20px", padding: m ? "0 12px" : "0 20px" },
  backButton: { background: "none", border: "none", cursor: "pointer", padding: "8px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: t.text, flexShrink: 0 },
  scrollArea: { flex: 1, overflowY: "auto", paddingBottom: m ? "70px" : "0", maxWidth: m ? "none" : "600px", width: "100%", margin: "0 auto", borderLeft: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.06)" : t.border}`, borderRight: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.06)" : t.border}`, ...(glass && { backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", backgroundColor: "rgba(0,0,0,0.5)" }) },
  
  profileHeader: { borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.06)" : t.border}`, paddingBottom: "20px", maxWidth: "600px", margin: "0 auto", width: "100%" },
  coverImage: { height: m ? "130px" : "200px", background: t.coverGradient },
  headerContent: { padding: m ? "0 16px" : "0 20px", marginTop: "-48px", position: "relative" },
  avatarLarge: { width: m ? "82px" : "134px", height: m ? "82px" : "134px", borderRadius: "50%", border: `4px solid ${t.bg}`, backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: m ? "32px" : "52px", fontWeight: "800", color: "#1a1a1a", overflow: "hidden" },
  avatarWithImage: { padding: 0 },
  avatarImage: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" },
  avatarImageSmall: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" },
  
  actionRow: { display: "flex", justifyContent: "flex-end", marginTop: m ? "-35px" : "-50px", marginBottom: "12px" },
  name: { fontSize: m ? "20px" : "22px", fontWeight: "800", margin: "12px 0 2px 0", color: t.text },
  bio: { color: t.textSecondary, marginBottom: "12px", fontSize: "15px", lineHeight: "1.4" },
  statsRow: { display: "flex", gap: m ? "16px" : "20px", fontSize: "14px", flexWrap: "wrap" },
  stat: { color: t.textSecondary, cursor: "pointer" },
  
  sectionTitle: { padding: "16px 16px 8px", margin: 0, color: t.text, fontSize: "16px", fontWeight: "700", borderBottom: `1px solid ${t.border}` },
  feedList: { display: "flex", flexDirection: "column", gap: "0", padding: "0", maxWidth: "600px", margin: "0 auto", width: "100%" },
  postCard: { backgroundColor: glass ? "rgba(22,24,28,0.5)" : t.cardBg, borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.06)" : t.border}`, padding: m ? "12px 16px" : "16px 20px", transition: "background-color 0.15s" },
  postHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" },
  avatarSmall: { width: "32px", height: "32px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#1a1a1a", flexShrink: 0, overflow: "hidden" },
  username: { fontSize: "15px", fontWeight: "700", color: t.text },
  postContent: { fontSize: "15px", lineHeight: "1.5", margin: "4px 0", color: t.text, wordBreak: "break-word" },
  entityContainer: { display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" },
  tag: { backgroundColor: t.tagBg, color: t.tagText, padding: "3px 10px", borderRadius: "9999px", fontSize: m ? "12px" : "13px", fontWeight: "500" },

  // Media styles
  mediaContainer: { marginTop: "12px", borderRadius: "16px", overflow: "hidden", maxHeight: "500px" },
  mediaImage: { width: "100%", height: "auto", maxHeight: "500px", objectFit: "cover", display: "block" },
  mediaVideo: { width: "100%", maxHeight: "500px", backgroundColor: "#000" },

  // Edit button
  editBtn: { backgroundColor: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: "9999px", padding: m ? "8px 20px" : "10px 24px", fontWeight: "700", cursor: "pointer", fontSize: "15px", transition: "all 0.2s" },

  followBtn: { backgroundColor: t.text === "#e7e9ea" ? "#eff3f4" : "#0f1419", color: t.text === "#e7e9ea" ? "#0f1419" : "#ffffff", border: "none", borderRadius: "9999px", padding: m ? "8px 20px" : "10px 24px", fontWeight: "700", cursor: "pointer", fontSize: "15px", transition: "all 0.2s" },
  unfollowBtn: { backgroundColor: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: "9999px", padding: m ? "8px 20px" : "10px 24px", fontWeight: "700", cursor: "pointer", fontSize: "15px", transition: "all 0.2s" },

  // Modal styles
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modalContent: { backgroundColor: t.cardBg, borderRadius: "16px", padding: m ? "20px" : "24px", width: "100%", maxWidth: "400px", maxHeight: "90vh", overflowY: "auto" },
  modalTitle: { margin: "0 0 20px 0", fontSize: "20px", fontWeight: "700", color: t.text },
  
  editAvatarSection: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" },
  editAvatar: { width: "100px", height: "100px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", overflow: "hidden", border: `3px solid ${t.border}` },
  avatarPlaceholder: { fontSize: "32px" },
  avatarOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "12px", padding: "6px", textAlign: "center" },
  editAvatarHint: { fontSize: "13px", color: t.textSecondary, marginTop: "8px" },

  label: { display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "600", color: t.text },
  input: { width: "100%", padding: "12px", fontSize: "15px", border: `1px solid ${t.border}`, borderRadius: "8px", marginBottom: "16px", backgroundColor: t.inputBg || t.bg, color: t.text, boxSizing: "border-box", outline: "none" },
  textarea: { width: "100%", padding: "12px", fontSize: "15px", border: `1px solid ${t.border}`, borderRadius: "8px", marginBottom: "16px", backgroundColor: t.inputBg || t.bg, color: t.text, boxSizing: "border-box", outline: "none", resize: "vertical", fontFamily: "inherit" },

  modalActions: { display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" },
  cancelBtn: { backgroundColor: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: "9999px", padding: "10px 20px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  saveBtn: { backgroundColor: t.accentBlue, color: "#fff", border: "none", borderRadius: "9999px", padding: "10px 20px", fontWeight: "600", cursor: "pointer", fontSize: "14px" }
}; }