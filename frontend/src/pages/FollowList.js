import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import { useTheme, getTheme } from "../context/ThemeContext";
import DarkModeToggle from "../components/DarkModeToggle";
import BottomNav from "../components/BottomNav";
import Loader from "../components/Loader";
import useIsMobile from "../hooks/useIsMobile";

export default function FollowList() {
  const { username, type } = useParams(); // type is "followers" or "following"
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const token = localStorage.getItem("token");
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile);

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

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/follow/${type}/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      console.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowToggle = async (userId, isFollowing) => {
    const method = isFollowing ? "DELETE" : "POST";
    
    // Optimistic update
    setUsers(users.map(u => 
      u.user_id === userId 
        ? { ...u, is_followed_by_user: !isFollowing }
        : u
    ));

    try {
      const res = await fetch(`${API}/follow/${userId}`, {
        method: method,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        // Revert on error
        setUsers(users.map(u => 
          u.user_id === userId 
            ? { ...u, is_followed_by_user: isFollowing }
            : u
        ));
      }
    } catch {
      // Revert on error
      setUsers(users.map(u => 
        u.user_id === userId 
          ? { ...u, is_followed_by_user: isFollowing }
          : u
      ));
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
  }, [username, type]);

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.navBar}>
        <div style={styles.navContent}>
          <button onClick={() => navigate(`/profile/${username}`)} style={styles.backButton}>← Back</button>
          <div>
            <h3 style={{margin: 0, color: t.text}}>@{username}</h3>
            <span style={{fontSize: "13px", color: t.textSecondary}}>{title}</span>
          </div>
          <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
        </div>
      </header>

      <div style={styles.scrollArea}>
        {isLoading ? (
          <div style={{padding: 40, display: "flex", justifyContent: "center"}}>
            <Loader />
          </div>
        ) : users.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{color: t.textSecondary}}>
              {type === "followers" 
                ? "No followers yet" 
                : "Not following anyone yet"}
            </p>
          </div>
        ) : (
          <div style={styles.userList}>
            {users.map((user) => (
              <div key={user.user_id} style={styles.userCard}>
                <div 
                  style={styles.avatarSection}
                  onClick={() => navigate(`/profile/${user.username}`)}
                >
                  <div style={styles.avatar}>
                    {user.profile_pic_url ? (
                      <img 
                        src={user.profile_pic_url} 
                        alt="" 
                        style={{width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover"}} 
                      />
                    ) : (
                      user.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
                
                <div style={styles.userInfo} onClick={() => navigate(`/profile/${user.username}`)}>
                  <div style={styles.username}>@{user.username}</div>
                  {user.bio && <div style={styles.bio}>{user.bio}</div>}
                </div>

                {currentUser && currentUser.username !== user.username && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollowToggle(user.user_id, user.is_followed_by_user);
                    }}
                    style={user.is_followed_by_user ? styles.unfollowBtn : styles.followBtn}
                  >
                    {user.is_followed_by_user ? "Following" : "Follow"}
                  </button>
                )}
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
  fullScreenWrapper: { 
    height: "100vh", 
    display: "flex", 
    flexDirection: "column", 
    backgroundColor: t.bg, 
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: t.text,
    transition: "background-color 0.3s"
  },
  navBar: { 
    height: "53px", 
    backgroundColor: t.headerBg, 
    borderBottom: `1px solid ${t.border}`, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(12px)"
  },
  navContent: { 
    width: "100%", 
    maxWidth: "600px", 
    display: "flex", 
    alignItems: "center", 
    gap: m ? "12px" : "20px",
    padding: m ? "0 12px" : "0 20px"
  },
  backButton: { 
    background: "none", 
    border: "none", 
    fontSize: "16px", 
    cursor: "pointer", 
    color: t.accentBlue, 
    fontWeight: "600"
  },
  scrollArea: { 
    flex: 1, 
    overflowY: "auto", 
    maxWidth: "600px", 
    width: "100%", 
    margin: "0 auto",
    paddingBottom: m ? "70px" : "0",
    borderLeft: m ? "none" : `1px solid ${t.border}`,
    borderRight: m ? "none" : `1px solid ${t.border}`
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px"
  },
  userList: {
    display: "flex",
    flexDirection: "column"
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    padding: m ? "12px 16px" : "16px 20px",
    borderBottom: `1px solid ${t.border}`,
    gap: "12px"
  },
  avatarSection: {
    cursor: "pointer"
  },
  avatar: {
    width: m ? "44px" : "48px",
    height: m ? "44px" : "48px",
    borderRadius: "50%",
    backgroundColor: t.avatarBg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    color: "#1a1a1a",
    fontSize: m ? "16px" : "18px",
    flexShrink: 0
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    cursor: "pointer"
  },
  username: {
    fontWeight: "700",
    fontSize: m ? "15px" : "16px",
    color: t.text
  },
  bio: {
    fontSize: "14px",
    color: t.textSecondary,
    marginTop: "2px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  followBtn: {
    backgroundColor: t.text,
    color: t.bg,
    border: "none",
    padding: "8px 16px",
    borderRadius: "9999px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    flexShrink: 0
  },
  unfollowBtn: {
    backgroundColor: "transparent",
    color: t.text,
    border: `1px solid ${t.border}`,
    padding: "8px 16px",
    borderRadius: "9999px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    flexShrink: 0
  }
}; }
