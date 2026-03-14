import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { parseContent } from "../utils/parseContent";
import DarkModeToggle from "../components/DarkModeToggle";
import LikeButton from "../components/LikeButton";
import CommentButton from "../components/CommentButton";
import BookmarkButton from "../components/BookmarkButton";
import RepostButton from "../components/RepostButton";

import Loader from "../components/Loader";
import PostLoader from "../components/PostLoader";
import useIsMobile from "../hooks/useIsMobile";
import ImageCropperPopup from "../components/ImageCropperPopup";

export default function Profile() {
  const toast = useToast();
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
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [reposts, setReposts] = useState([]);
  const [isLoadingReposts, setIsLoadingReposts] = useState(false);
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
      toast("Action failed", "error");
    }
  };

  // Fetch user reposts
  const fetchReposts = async () => {
    setIsLoadingReposts(true);
    try {
      const res = await fetch(`${API}/reposts/user/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReposts(data);
      }
    } catch {
      console.error("Failed to load reposts");
    } finally {
      setIsLoadingReposts(false);
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

  // --- Action handlers for posts ---
  const handleLike = async (postId) => {
    const post = posts.find(p => p._id === postId);
    if (!post) return;
    const wasLiked = post.is_liked_by_user;
    setPosts(prev => prev.map(p =>
      p._id === postId ? { ...p, is_liked_by_user: !wasLiked, likes: wasLiked ? p.likes - 1 : p.likes + 1 } : p
    ));
    try {
      const res = await fetch(`${API}/likes/${postId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p =>
          p._id === postId ? { ...p, is_liked_by_user: data.liked, likes: data.likes } : p
        ));
      } else {
        setPosts(prev => prev.map(p =>
          p._id === postId ? { ...p, is_liked_by_user: wasLiked, likes: post.likes } : p
        ));
      }
    } catch {
      setPosts(prev => prev.map(p =>
        p._id === postId ? { ...p, is_liked_by_user: wasLiked, likes: post.likes } : p
      ));
    }
  };

  const handleBookmark = async (postId) => {
    try {
      const res = await fetch(`${API}/bookmarks/${postId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p =>
          p._id === postId ? { ...p, is_bookmarked: data.bookmarked } : p
        ));
      }
    } catch {
      toast("Bookmark failed", "error");
    }
  };

  const handleRepost = async (postId) => {
    const post = posts.find(p => p._id === postId);
    if (!post) return;
    const wasReposted = post.is_reposted_by_user;
    const oldCount = post.repost_count || 0;
    setPosts(prev => prev.map(p =>
      p._id === postId ? { ...p, is_reposted_by_user: !wasReposted, repost_count: wasReposted ? oldCount - 1 : oldCount + 1 } : p
    ));
    try {
      const res = await fetch(`${API}/reposts/${postId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p =>
          p._id === postId ? { ...p, is_reposted_by_user: data.reposted, repost_count: data.repost_count } : p
        ));
      } else {
        setPosts(prev => prev.map(p =>
          p._id === postId ? { ...p, is_reposted_by_user: wasReposted, repost_count: oldCount } : p
        ));
      }
    } catch {
      setPosts(prev => prev.map(p =>
        p._id === postId ? { ...p, is_reposted_by_user: wasReposted, repost_count: oldCount } : p
      ));
    }
  };

  const handleSharePost = async (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pulse',
          text: 'Check out this post on Pulse',
          url: url,
        });
      } catch (err) {
        if (err.name !== 'AbortError' && navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => toast("Link copied to clipboard"));
        }
      }
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => toast("Link copied to clipboard"));
    } else {
      toast("Could not copy link", "error");
    }
  };

  // Action handlers for repost tab (targets original_post inside repost)
  const handleRepostLike = async (repostId, originalPostId) => {
    const repost = reposts.find(r => r._id === repostId);
    if (!repost?.original_post) return;
    const wasLiked = repost.original_post.is_liked_by_user;
    setReposts(prev => prev.map(r =>
      r._id === repostId ? { ...r, original_post: { ...r.original_post, is_liked_by_user: !wasLiked, likes: wasLiked ? r.original_post.likes - 1 : r.original_post.likes + 1 } } : r
    ));
    try {
      const res = await fetch(`${API}/likes/${originalPostId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReposts(prev => prev.map(r =>
          r._id === repostId ? { ...r, original_post: { ...r.original_post, is_liked_by_user: data.liked, likes: data.likes } } : r
        ));
      } else {
        setReposts(prev => prev.map(r =>
          r._id === repostId ? { ...r, original_post: { ...r.original_post, is_liked_by_user: wasLiked, likes: repost.original_post.likes } } : r
        ));
      }
    } catch {
      setReposts(prev => prev.map(r =>
        r._id === repostId ? { ...r, original_post: { ...r.original_post, is_liked_by_user: wasLiked, likes: repost.original_post.likes } } : r
      ));
    }
  };

  const handleRepostBookmark = async (repostId, originalPostId) => {
    try {
      const res = await fetch(`${API}/bookmarks/${originalPostId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReposts(prev => prev.map(r =>
          r._id === repostId ? { ...r, original_post: { ...r.original_post, is_bookmarked: data.bookmarked } } : r
        ));
      }
    } catch {
      toast("Bookmark failed", "error");
    }
  };

  // Handle profile picture selection
  const handlePictureSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setTempImageSrc(URL.createObjectURL(file));
      setShowCropper(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCropComplete = (croppedBlob) => {
    setEditPicture(croppedBlob);
    setPicturePreview(URL.createObjectURL(croppedBlob));
    setShowCropper(false);
    setTempImageSrc(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempImageSrc(null);
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
        formData.append("profile_picture", editPicture, "profile.jpg");
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
        toast(err.detail || "Failed to update profile", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    fetchReposts();
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

      {/* TABS */}
      <div style={styles.tabBar}>
        <button style={activeTab === "posts" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("posts")}>Posts</button>
        <button style={activeTab === "reposts" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("reposts")}>Reposts</button>
      </div>

      {/* TAB CONTENT */}
      <div style={styles.feedList}>
        {activeTab === "posts" ? (
          <>
            {isLoadingPosts ? (
              <>
                <PostLoader />
                <PostLoader />
              </>
            ) : posts.length === 0 ? (
              <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px", color: t.textSecondary}}>
                <svg viewBox="0 0 24 24" width="40" height="40" fill={t.textSecondary} style={{marginBottom: 10, opacity: 0.4}}>
                  <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/>
                </svg>
                <span style={{fontSize: 15, fontWeight: 600}}>No posts yet</span>
              </div>
            ) : (
              posts.map((p) => (
              <div key={p._id} style={styles.postCard} onClick={() => navigate(`/post/${p._id}`)}>
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
                <p style={styles.postContent}>{parseContent(p.content, { navigate, accentColor: t.accentBlue })}</p>
                {p.media_url && (
                  <div style={styles.mediaContainer}>
                    {p.media_type === "video" ? (
                      <video src={p.media_url} controls style={styles.mediaVideo} />
                    ) : (
                      <img src={p.media_url} alt="Post media" style={styles.mediaImage} />
                    )}
                  </div>
                )}
                {p.gif_url && !p.media_url && (
                  <div style={styles.mediaContainer}>
                    <img src={p.gif_url} alt="GIF" style={styles.mediaImage} />
                  </div>
                )}
                <div style={styles.entityContainer}>
                    {p.entities?.map((e, idx) => (
                      <span key={idx} style={styles.tag}>{e.text}</span>
                    ))}
                </div>
                <div style={styles.postActions} onClick={(e) => e.stopPropagation()}>
                  <LikeButton
                    isLiked={p.is_liked_by_user}
                    count={p.likes || 0}
                    onLike={() => handleLike(p._id)}
                  />
                  <CommentButton
                    onClick={() => navigate(`/post/${p._id}`)}
                    count={p.comment_count || 0}
                  />
                  <RepostButton
                    isReposted={p.is_reposted_by_user}
                    count={p.repost_count || 0}
                    onRepost={() => handleRepost(p._id)}
                    onQuoteRepost={() => navigate(`/compose?quote=${p._id}`)}
                  />
                  <BookmarkButton
                    isBookmarked={p.is_bookmarked}
                    onToggle={() => handleBookmark(p._id)}
                  />
                  <button
                    onClick={() => handleSharePost(p._id)}
                    style={styles.shareBtn}
                    aria-label="Share post"
                    title="Copy link"
                    onMouseEnter={(e) => e.currentTarget.style.color = t.accentBlue}
                    onMouseLeave={(e) => e.currentTarget.style.color = t.textSecondary}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
            )}
          </>
        ) : (
          <>
            {isLoadingReposts ? (
              <>
                <PostLoader />
                <PostLoader />
              </>
            ) : reposts.length === 0 ? (
              <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px", color: t.textSecondary}}>
                <svg viewBox="0 0 24 24" width="40" height="40" fill={t.textSecondary} style={{marginBottom: 10, opacity: 0.4}}>
                  <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/>
                </svg>
                <span style={{fontSize: 15, fontWeight: 600}}>No reposts yet</span>
              </div>
            ) : (
              reposts.map((r) => (
              <div key={r._id} style={styles.postCard} onClick={() => navigate(`/post/${r.original_post_id}`)}>
                <div style={{display: "flex", alignItems: "center", gap: 6, color: "#00ba7c", fontSize: 13, fontWeight: 600, marginBottom: 8}}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#00ba7c"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
                  @{r.username} reposted
                </div>
                {r.is_quote && r.quote_content && (
                  <p style={styles.postContent}>{r.quote_content}</p>
                )}
                {r.original_post && (
                  <div style={{...styles.postCard, border: `1px solid ${t.border}`, marginTop: 4, borderRadius: 12, cursor: "default"}} onClick={(e) => e.stopPropagation()}>
                    <div style={styles.postHeader}>
                      <strong style={styles.username}>@{r.original_post.username}</strong>
                    </div>
                    <p style={{...styles.postContent, fontSize: 14}}>{parseContent(r.original_post.content, { navigate, accentColor: t.accentBlue })}</p>
                    {r.original_post.media_url && (
                      <div style={styles.mediaContainer}>
                        {r.original_post.media_type === "video" ? (
                          <video src={r.original_post.media_url} controls style={styles.mediaVideo} />
                        ) : (
                          <img src={r.original_post.media_url} alt="Post media" style={styles.mediaImage} />
                        )}
                      </div>
                    )}
                    {r.original_post.gif_url && !r.original_post.media_url && (
                      <div style={styles.mediaContainer}>
                        <img src={r.original_post.gif_url} alt="GIF" style={styles.mediaImage} />
                      </div>
                    )}
                  </div>
                )}
                <div style={styles.postActions} onClick={(e) => e.stopPropagation()}>
                  <LikeButton
                    isLiked={r.original_post?.is_liked_by_user}
                    count={r.original_post?.likes || 0}
                    onLike={() => handleRepostLike(r._id, r.original_post_id)}
                  />
                  <CommentButton
                    onClick={() => navigate(`/post/${r.original_post_id}`)}
                    count={r.original_post?.comment_count || 0}
                  />
                  <BookmarkButton
                    isBookmarked={r.original_post?.is_bookmarked}
                    onToggle={() => handleRepostBookmark(r._id, r.original_post_id)}
                  />
                  <button
                    onClick={() => handleSharePost(r.original_post_id)}
                    style={styles.shareBtn}
                    aria-label="Share post"
                    title="Copy link"
                    onMouseEnter={(e) => e.currentTarget.style.color = t.accentBlue}
                    onMouseLeave={(e) => e.currentTarget.style.color = t.textSecondary}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
            )}
          </>
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

      {/* CROP MODAL */}
      {showCropper && tempImageSrc && (
        <ImageCropperPopup
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          theme={t}
        />
      )}
    </div>
  );
}

function getStyles(t, m, bg) {
  const glass = bg && bg !== "none";
  return {
  fullScreenWrapper: { flex: 1, display: "flex", flexDirection: "column", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: "hidden", color: t.text },
  navBar: { height: "53px", backgroundColor: glass ? "rgba(255,255,255,0.14)" : t.headerBg, borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 100, backdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)", WebkitBackdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)", transition: "background-color 0.3s" },
  navContent: { width: "100%", maxWidth: "600px", display: "flex", alignItems: "center", gap: m ? "12px" : "20px", padding: m ? "0 12px" : "0 20px" },
  backButton: { background: "none", border: "none", cursor: "pointer", padding: "8px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: t.text, flexShrink: 0 },
  scrollArea: { flex: 1, overflowY: "auto", paddingBottom: m ? "70px" : "0", maxWidth: m ? "none" : "600px", width: "100%", margin: "0 auto", borderLeft: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`, borderRight: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`, ...(glass && { backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", backgroundColor: "rgba(255,255,255,0.1)" }) },
  
  profileHeader: { borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.12)" : t.border}`, paddingBottom: "20px", maxWidth: "600px", margin: "0 auto", width: "100%" },
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
  tabBar: { display: "flex", borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.15)" : t.border}`, maxWidth: "600px", margin: "0 auto", width: "100%" },
  tab: { flex: 1, padding: "16px 0", background: "none", border: "none", borderBottom: "2px solid transparent", color: t.textSecondary, fontSize: "15px", fontWeight: "600", cursor: "pointer", textAlign: "center", transition: "all 0.2s" },
  tabActive: { flex: 1, padding: "16px 0", background: "none", border: "none", borderBottom: `2px solid ${t.accentBlue}`, color: t.text, fontSize: "15px", fontWeight: "700", cursor: "pointer", textAlign: "center", transition: "all 0.2s" },
  postCard: { backgroundColor: glass ? "rgba(255,255,255,0.1)" : t.cardBg, borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.15)" : t.border}`, padding: m ? "12px 16px" : "16px 20px", transition: "background-color 0.15s", cursor: "pointer" },
  postHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" },
  avatarSmall: { width: "32px", height: "32px", borderRadius: "50%", backgroundColor: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "#1a1a1a", flexShrink: 0, overflow: "hidden" },
  username: { fontSize: "15px", fontWeight: "700", color: t.text },
  postContent: { fontSize: "15px", lineHeight: "1.5", margin: "4px 0", color: t.text, wordBreak: "break-word" },
  entityContainer: { display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" },
  tag: { backgroundColor: t.tagBg, color: t.tagText, padding: "3px 10px", borderRadius: "9999px", fontSize: m ? "12px" : "13px", fontWeight: "500" },
  // Action buttons
  postActions: { display: "flex", alignItems: "center", gap: m ? "16px" : "24px", marginTop: "8px", paddingTop: "4px" },
  shareBtn: { background: "none", border: "none", cursor: "pointer", color: t.textSecondary, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px", borderRadius: "50%", transition: "color 0.2s" },
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