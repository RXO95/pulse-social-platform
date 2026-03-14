import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useFeed } from "../context/FeedContext";
import { parseContent } from "../utils/parseContent";
import LikeButton from "../components/LikeButton";
import CommentButton from "../components/CommentButton";
import BookmarkButton from "../components/BookmarkButton";
import RepostButton from "../components/RepostButton";
import GifPicker from "../components/GifPicker";
import PostLoader from "../components/PostLoader";
import DarkModeToggle from "../components/DarkModeToggle";
import PulseLogo from "../components/PulseLogo";
import useIsMobile from "../hooks/useIsMobile";
import WeatherWidget from "../components/WeatherWidget";
import NewsWidget from "../components/NewsWidget";
import WhoToFollow from "../components/WhoToFollow";
import { timeAgo } from "../utils/timeAgo";

/* ─── Swipeable Widget Carousel ─── */
function WidgetCarousel({ theme: t }) {
  const [active, setActive] = useState(0);
  const scrollRef = useRef(null);
  const WIDGETS = ["weather", "news"];

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setActive(idx);
  };

  const goTo = (idx) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.offsetWidth, behavior: "smooth" });
    setActive(idx);
  };

  const LABELS = ["🌤️ Weather", "📰 News"];

  return (
    <div style={{ marginTop: 16 }}>
      {/* Tab selector with arrows */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 4, marginBottom: 10,
      }}>
        {/* Left arrow */}
        <button
          onClick={() => goTo(Math.max(0, active - 1))}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: active === 0 ? (t.border || "#444") : (t.text || "#fff"),
            fontSize: 18, padding: "6px 8px", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.2s",
          }}
          aria-label="Previous widget"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
        </button>

        {/* Tab buttons */}
        {WIDGETS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              padding: "7px 16px",
              borderRadius: 9999,
              border: "none",
              fontSize: 13,
              fontWeight: active === i ? 700 : 500,
              cursor: "pointer",
              background: active === i ? (t.accentBlue || "#1d9bf0") : (t.inputBg || "rgba(255,255,255,0.08)"),
              color: active === i ? "#fff" : (t.textSecondary || "#888"),
              transition: "all 0.25s",
              whiteSpace: "nowrap",
            }}
          >
            {LABELS[i]}
          </button>
        ))}

        {/* Right arrow */}
        <button
          onClick={() => goTo(Math.min(WIDGETS.length - 1, active + 1))}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: active === WIDGETS.length - 1 ? (t.border || "#444") : (t.text || "#fff"),
            fontSize: 18, padding: "6px 8px", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.2s",
          }}
          aria-label="Next widget"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" /></svg>
        </button>
      </div>

      {/* Scroll-snap container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="widget-carousel-scroll"
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          borderRadius: 16,
          gap: 0,
        }}
      >
        <style>{`.widget-carousel-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div style={{
          flex: "0 0 100%", scrollSnapAlign: "start", minWidth: "100%",
        }}>
          <WeatherWidget theme={t} />
        </div>
        <div style={{
          flex: "0 0 100%", scrollSnapAlign: "start", minWidth: "100%",
        }}>
          <NewsWidget theme={t} />
        </div>
      </div>
    </div>
  );
}

export default function Feed() {
  const toast = useToast();
  const confirm = useConfirm();
  const { posts, setPosts, hasFetched, setHasFetched, scrollPosition, setScrollPosition, nextCursor, setNextCursor, hasMore, setHasMore } = useFeed();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [trending, setTrending] = useState([]);
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(!hasFetched);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isPosting, setIsPosting] = useState(false);

  // Edit post state
  const [editPostId, setEditPostId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // Media upload state
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [gifUrl, setGifUrl] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const mediaInputRef = useRef(null);

  // Double-tap to like
  const lastTapRef = useRef({});
  const [doubleTapHeart, setDoubleTapHeart] = useState(null);

  // New posts banner
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const latestPostIdRef = useRef(null);

  const { logout } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const mobile = useIsMobile();
  const glass = background && background !== "none";
  const styles = getStyles(t, mobile, background);

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
    if (searchQuery) return; // Don't overwrite search results
    try {
      if (showLoader && !hasFetched) setIsLoading(true);
      const res = await fetch(`${API}/feed/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { logout(); return; }
      const data = await res.json();
      // Initialize translation properties for each post
      const processedPosts = (data.posts || []).map(p => ({
        ...p,
        translatedText: null,
        showTranslation: false
      }));
      setPosts(processedPosts);
      setNextCursor(data.next_cursor || null);
      setHasMore(data.has_more ?? false);
      setHasFetched(true);
    } catch {
      toast("Failed to load feed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || !nextCursor || searchQuery) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`${API}/feed/?cursor=${nextCursor}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const morePosts = (data.posts || []).map(p => ({
        ...p,
        translatedText: null,
        showTranslation: false
      }));
      setPosts(prev => [...prev, ...morePosts]);
      setNextCursor(data.next_cursor || null);
      setHasMore(data.has_more ?? false);
    } catch {
      toast("Could not load more posts", "error");
    } finally {
      setIsLoadingMore(false);
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

  // --- DRAFTS ---
  const fetchDrafts = async () => {
    try {
      const res = await fetch(`${API}/drafts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setDrafts(await res.json());
    } catch { }
  };

  const saveDraft = async () => {
    if (!content.trim() && !gifUrl) return;
    try {
      await fetch(`${API}/drafts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: content.trim(), gif_url: gifUrl || null })
      });
      setContent("");
      clearMedia();
      setGifUrl(null);
      fetchDrafts();
    } catch { toast("Could not save draft", "error"); }
  };

  const loadDraft = (draft) => {
    setContent(draft.content || "");
    setGifUrl(draft.gif_url || null);
    setShowDrafts(false);
    // Delete the draft once loaded
    fetch(`${API}/drafts/${draft._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }).then(() => fetchDrafts()).catch(() => { });
  };

  const deleteDraft = async (draftId) => {
    try {
      await fetch(`${API}/drafts/${draftId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDrafts();
    } catch { }
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
        toast("Search failed. Please try again.", "error");
        return;
      }

      const data = await res.json();
      console.log("Search results:", data);
      setPosts(data.results || []);
    } catch (error) {
      console.error("Search error:", error);
      toast("Search failed", "error");
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
        toast(data.message || "Action failed", "error");
      }
    } catch {
      // Revert on error
      setPosts(prev => prev.map(p =>
        p.user_id === postAuthorId
          ? { ...p, is_followed_by_user: isFollowing }
          : p
      ));
      toast("Network error", "error");
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
      toast("Translation failed", "error");
    }
  };

  // --- NEW: HANDLE DELETE POST ---
  const handleDeletePost = async (postId) => {
    const ok = await confirm("Are you sure you want to delete this post?", { title: "Delete Post", confirmText: "Delete" });
    if (!ok) return;

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
        toast(data.detail || "Failed to delete post", "error");
      }
    } catch {
      toast("Could not delete post", "error");
    }
  };

  // --- HANDLE EDIT POST ---
  const openEditModal = (post) => {
    setEditPostId(post._id);
    setEditContent(post.content);
    setOpenMenuId(null);
  };

  const handleEditPost = async () => {
    if (!editContent.trim() || !editPostId) return;
    setIsEditing(true);
    try {
      const res = await fetch(`${API}/posts/${editPostId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p._id === editPostId
              ? { ...p, content: data.content, is_edited: true }
              : p
          )
        );
        setEditPostId(null);
        setEditContent("");
      } else {
        const data = await res.json();
        toast(data.detail || "Failed to edit post", "error");
      }
    } catch {
      toast("Could not edit post", "error");
    } finally {
      setIsEditing(false);
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
      toast("Bookmark failed", "error");
    }
  };

  // --- HANDLE REPOST ---
  const handleRepost = async (postId) => {
    const post = posts.find(p => p._id === postId);
    if (!post) return;
    const wasReposted = post.is_reposted_by_user;
    const oldCount = post.repost_count || 0;

    setPosts(prev => prev.map(p =>
      p._id === postId
        ? { ...p, is_reposted_by_user: !wasReposted, repost_count: wasReposted ? oldCount - 1 : oldCount + 1 }
        : p
    ));

    try {
      const res = await fetch(`${API}/reposts/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p =>
          p._id === postId
            ? { ...p, is_reposted_by_user: data.reposted, repost_count: data.repost_count }
            : p
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

  useEffect(() => {
    fetchTrending();
    fetchCurrentUser();
    fetchDrafts();

    if (!hasFetched) {
      fetchPosts();
    } else {
      const handler = setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 0);
      return () => clearTimeout(handler);
    }

    return () => {
      setScrollPosition(window.scrollY);
    };
    // eslint-disable-next-line
  }, [hasFetched, scrollPosition]);

  // Infinite scroll – load more when near bottom
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 600 &&
        !isLoadingMore && hasMore && !searchQuery
      ) {
        loadMorePosts();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line
  }, [isLoadingMore, hasMore, nextCursor, searchQuery]);

  // Track latest post ID for new-posts banner
  useEffect(() => {
    if (posts.length > 0) {
      latestPostIdRef.current = posts[0]._id;
    }
  }, [posts]);

  // Poll for new posts every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!latestPostIdRef.current || searchQuery) return;
      try {
        const res = await fetch(`${API}/feed/latest-id`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.latest_id && data.latest_id !== latestPostIdRef.current) {
            setHasNewPosts(true);
          }
        }
      } catch { }
    }, 30000);
    return () => clearInterval(interval);
  }, [searchQuery]);

  // Double-tap handler for post cards
  const handleDoubleTap = (postId) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[postId] || 0;
    if (now - lastTap < 300) {
      clearTimeout(lastTapRef.current[`${postId}_t`]);
      const post = posts.find((p) => p._id === postId);
      if (post && !post.is_liked_by_user) {
        handleLike(postId);
      }
      setDoubleTapHeart(postId);
      setTimeout(() => setDoubleTapHeart(null), 900);
      lastTapRef.current[postId] = 0;
    } else {
      lastTapRef.current[postId] = now;
      lastTapRef.current[`${postId}_t`] = setTimeout(() => {
        if (lastTapRef.current[postId] === now) {
          navigate(`/post/${postId}`);
          lastTapRef.current[postId] = 0;
        }
      }, 280);
    }
  };

  // Share / copy link handler
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
        // Use JSON for text-only or GIF posts
        const payload = { content: content.trim() || " " };
        if (gifUrl) payload.gif_url = gifUrl;
        res = await fetch(`${API}/posts/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const data = await res.json();
        toast(data.detail?.message || data.detail || "Post blocked", "error");
        return;
      }
      setContent("");
      clearMedia();
      setGifUrl(null);
      await fetchPosts(false);
      fetchTrending();

      // Ensure loader shows for at least 1 second
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(r => setTimeout(r, 1000 - elapsed));
      }
    } catch {
      toast("Could not create post", "error");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div style={styles.pageRoot}>
      {/* Heart animation keyframes */}
      <style>{`
        @keyframes heartPop {
          0% { transform: scale(0); opacity: 0; }
          15% { transform: scale(1.3); opacity: 1; }
          30% { transform: scale(0.95); opacity: 1; }
          45% { transform: scale(1.05); opacity: 1; }
          60% { transform: scale(1); opacity: 1; }
          80% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
      {/* Mobile-only header */}
      {mobile && (
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.logoGroup}>
              <PulseLogo height={28} color={t.text} />
            </div>

            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={styles.searchInput}
            />

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <DarkModeToggle />
              <button
                onClick={() => navigate("/messages")}
                style={styles.iconBtn}
                aria-label="Messages"
                title="Messages"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill={t.text}>
                  <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.14 8-5.14V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 4.971l-8 5.14-8-5.14V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.529z" />
                </svg>
              </button>
              <button onClick={logout} style={styles.logoutBtn}>Exit</button>
            </div>
          </div>
        </header>
      )}

      <div style={styles.layoutBody}>

        <main style={styles.mainContent}>
          {/* Sticky tab header like X (desktop only) */}
          {!mobile && (
            <div style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              backgroundColor: glass ? "rgba(255,255,255,0.14)" : t.headerBg,
              backdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)",
              WebkitBackdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)",
              borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.12)" : t.border}`,
            }}>
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: 53,
                fontWeight: "700",
                fontSize: "15px",
                color: t.text,
                position: "relative",
              }}>
                <span>For you</span>
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  width: 56,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: t.accentBlue,
                }} />
              </div>
            </div>
          )}
          <div style={styles.card}>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={styles.composeAvatar}>
                {currentUser?.profile_pic_url ? (
                  <img src={currentUser.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  currentUser?.username?.charAt(0).toUpperCase() || "?"
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <textarea
                  placeholder="What's happening?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={styles.textarea}
                  maxLength={1000}
                />
                {content.length > 0 && (
                  <div style={{ textAlign: "right", fontSize: "12px", color: content.length > 900 ? (content.length > 980 ? "#f4212e" : "#ff9800") : t.textSecondary, marginTop: "-4px", marginBottom: "4px", opacity: 0.8 }}>
                    {content.length}/1000
                  </div>
                )}

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

                {/* GIF Preview */}
                {gifUrl && !mediaPreview && (
                  <div style={styles.mediaPreviewContainer}>
                    <button onClick={() => setGifUrl(null)} style={styles.removeMediaBtn}>✕</button>
                    <img src={gifUrl} alt="GIF" style={styles.mediaPreview} />
                  </div>
                )}

                <div style={styles.buttonContainer}>
                  {/* Media Upload Button */}
                  <input
                    type="file"
                    ref={mediaInputRef}
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => mediaInputRef.current?.click()}
                    style={styles.mediaBtn}
                    title="Add image or video"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7C8.784 7 8 7.784 8 8.75s.784 1.75 1.75 1.75 1.75-.784 1.75-1.75S10.716 7 9.75 7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowGifPicker(true)}
                    style={styles.mediaBtn}
                    title="Add GIF"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M3 5.5A2.5 2.5 0 015.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13zM5.5 5c-.28 0-.5.22-.5.5v13c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-13c0-.28-.22-.5-.5-.5h-13zM8 10h1.5v4H8v-4zm2.5 0H13c.55 0 1 .45 1 1v.5h-1.5v-.25h-1v2.5h1v-.25H14v.5c0 .55-.45 1-1 1h-2.5v-5zm4.5 0h3v1.25h-1.75v.5H18v1.25h-1.75V14H14.5v-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={createPost}
                    style={{ ...styles.postButton, opacity: (content.trim() || mediaFile || gifUrl) ? 1 : 0.5 }}
                    disabled={!content.trim() && !mediaFile && !gifUrl}
                  >
                    {isPosting ? "Posting..." : "Post"}
                  </button>
                  {(content.trim() || gifUrl) && (
                    <button onClick={saveDraft} style={styles.saveDraftBtn} title="Save as draft">
                      Draft
                    </button>
                  )}
                  {drafts.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setShowDrafts(!showDrafts)} style={styles.draftsIndicator} title="Load a draft">
                        Drafts ({drafts.length})
                      </button>
                      {showDrafts && (
                        <div style={styles.draftsDropdown}>
                          <div style={styles.draftsHeader}>Drafts</div>
                          {drafts.map((d) => (
                            <div key={d._id} style={styles.draftItem}>
                              <div style={styles.draftContent} onClick={() => loadDraft(d)}>
                                {d.content?.length > 60 ? d.content.slice(0, 60) + "..." : d.content || "(GIF only)"}
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); deleteDraft(d._id); }} style={styles.draftDeleteBtn}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.feedList}>
            {isPosting && <PostLoader />}
            {/* New posts available banner */}
            {hasNewPosts && (
              <div
                style={styles.newPostsBanner}
                onClick={async () => {
                  setHasNewPosts(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  // Fetch the latest page of posts
                  try {
                    const res = await fetch(`${API}/feed/`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                      const data = await res.json();
                      const freshPosts = (data.posts || []).map(p => ({
                        ...p, translatedText: null, showTranslation: false,
                      }));
                      // Find truly new posts by comparing IDs
                      const existingIds = new Set(posts.map(p => p._id));
                      const newPosts = freshPosts.filter(p => !existingIds.has(p._id));
                      if (newPosts.length > 0) {
                        setPosts(prev => [...newPosts, ...prev]);
                      }
                    }
                  } catch {}
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
                New posts available
              </div>
            )}

            {isLoading ? (
              <>
                <PostLoader />
                <PostLoader />
                <PostLoader />
                <PostLoader />
              </>
            ) : posts.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: t.textSecondary }}>
                <svg viewBox="0 0 24 24" width="48" height="48" fill={t.textSecondary} style={{ marginBottom: 12, opacity: 0.5 }}>
                  <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                </svg>
                <span style={{ fontSize: 16, fontWeight: 600 }}>No posts yet</span>
                <span style={{ fontSize: 14, marginTop: 4, opacity: 0.7 }}>Be the first to share something</span>
              </div>
            ) : (
              posts.map((p) => (
                <div key={p._id} style={styles.postCard}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = glass ? "rgba(255,255,255,0.14)" : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)")}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = glass ? "rgba(255,255,255,0.1)" : t.cardBg}
                >
                  <div style={styles.postHeader}>
                    <div style={styles.avatar}>
                      {p.profile_pic_url ? (
                        <img src={p.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        p.username?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={styles.userMeta}>
                      <div style={styles.usernameRow}>
                        <strong
                          style={{ ...styles.username, cursor: "pointer" }}
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

                    {/* 3-Dot Menu for Post Owner or Admin */}
                    {currentUser && (p.username === currentUser.username || currentUser.username === "Zuckk") && (
                      <div style={styles.menuContainer} data-menu>
                        <button
                          style={styles.menuButton}
                          aria-label="Post options"
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
                            {p.username === currentUser.username && (
                              <button
                                style={styles.editBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(p);
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.hoverBg}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                              >
                                Edit Post
                              </button>
                            )}
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

                  {/* --- CLICKABLE POST AREA (double-tap to like) --- */}
                  <div
                    style={{ cursor: "pointer", position: "relative", userSelect: "none" }}
                    onClick={() => handleDoubleTap(p._id)}
                  >
                    {/* Toggle between Original and Translated Text */}
                    <p style={styles.postContent}>
                      {parseContent(p.showTranslation ? p.translatedText : p.content, { navigate, accentColor: t.accentBlue })}
                      {p.is_edited && <span style={{ color: t.textSecondary, fontSize: "12px", marginLeft: "6px", fontStyle: "italic" }}>(edited)</span>}
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

                    {/* --- POST GIF --- */}
                    {p.gif_url && !p.media_url && (
                      <div style={styles.postMediaContainer} onClick={e => e.stopPropagation()}>
                        <img src={p.gif_url} alt="GIF" style={styles.postMedia} />
                      </div>
                    )}

                    {/* Heart overlay on double-tap */}
                    {doubleTapHeart === p._id && (
                      <div style={styles.heartOverlay}>
                        <svg viewBox="0 0 24 24" width="80" height="80" style={styles.heartSvg}>
                          <path fill="#f91880" d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.45-4.92-.334-6.98C3.907 4.19 6.043 3 8.399 3c1.837 0 3.238.84 4.1 1.78A5.61 5.61 0 0 1 16.6 3c2.358 0 4.494 1.19 5.617 3.21 1.116 2.06 1.026 4.48-.333 6.98z" />
                        </svg>
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
                      onClick={(e) => { e.stopPropagation(); handleSharePost(p._id); }}
                      style={styles.shareBtn}
                      aria-label="Share post"
                      title="Copy link"
                      onMouseEnter={(e) => e.currentTarget.style.color = t.accentBlue}
                      onMouseLeave={(e) => e.currentTarget.style.color = t.textSecondary}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Infinite Scroll Loading Indicator */}
            {isLoadingMore && (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <div style={{
                  width: 28, height: 28,
                  border: `3px solid ${t.border}`,
                  borderTop: `3px solid ${t.accentBlue}`,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* End of feed */}
            {!hasMore && posts.length > 0 && !searchQuery && (
              <div style={{
                textAlign: "center", padding: "24px 0", color: t.textSecondary,
                fontSize: "13px", fontStyle: "italic",
              }}>
                You've reached the end of the feed ✨
              </div>
            )}
          </div>
        </main>

        <aside style={styles.sidebar}>
          {/* Search bar – desktop only (like X right sidebar) */}
          <div style={{ position: "sticky", top: 0, paddingTop: 8, paddingBottom: 12, backgroundColor: glass ? "transparent" : t.bg, zIndex: 2 }}>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.trendingCard}>
            <h3
              style={{ ...styles.trendingTitle, cursor: "pointer" }}
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
              <p style={{ fontSize: "14px", color: t.textSecondary, textAlign: "center", padding: "24px 16px", margin: 0 }}>Nothing trending yet...</p>
            )}
          </div>

          {/* ── Who to Follow ── */}
          <WhoToFollow theme={t} />

          {/* ── Swipeable Widget Carousel ── */}
          <WidgetCarousel theme={t} />
        </aside>
      </div>

      {showGifPicker && (
        <GifPicker
          onSelect={(url) => { setGifUrl(url); setShowGifPicker(false); clearMedia(); }}
          onClose={() => setShowGifPicker(false)}
          theme={t}
        />
      )}

      {/* Edit Post Modal */}
      {editPostId && (
        <div style={styles.editOverlay} onClick={() => setEditPostId(null)}>
          <div style={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.editHeader}>
              <h3 style={{ margin: 0, color: t.text, fontSize: "18px" }}>Edit Post</h3>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: t.textSecondary }}
                onClick={() => setEditPostId(null)}
              >✕</button>
            </div>
            <textarea
              style={styles.editTextarea}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={1000}
              autoFocus
            />
            {editContent.length > 0 && (
              <div style={{ textAlign: "right", fontSize: "12px", color: editContent.length > 900 ? (editContent.length > 980 ? "#f4212e" : "#ff9800") : t.textSecondary, marginTop: "4px", opacity: 0.8 }}>
                {editContent.length}/1000
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button
                style={styles.editCancelBtn}
                onClick={() => setEditPostId(null)}
              >Cancel</button>
              <button
                style={{ ...styles.editSaveBtn, opacity: editContent.trim() ? 1 : 0.5 }}
                onClick={handleEditPost}
                disabled={!editContent.trim() || isEditing}
              >{isEditing ? "Saving..." : "Save"}</button>
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
    pageRoot: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: "hidden",
      height: "100%",
    },
    header: {
      height: "53px",
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
      padding: "0 12px",
      gap: "8px"
    },
    layoutBody: {
      display: "flex",
      justifyContent: "center",
      width: "100%",
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
      width: "100%",
      padding: m ? "8px 12px" : "10px 16px",
      borderRadius: "9999px",
      border: "none",
      backgroundColor: t.inputBg,
      color: t.text,
      outline: "none",
      fontSize: "15px",
      transition: "background-color 0.3s",
      boxSizing: "border-box",
    },
    title: { fontSize: "22px", fontWeight: "800", margin: 0, color: t.accent },
    logoutBtn: {
      background: "transparent",
      border: `1px solid ${t.border}`,
      borderRadius: "9999px",
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      color: t.text,
      flexShrink: 0,
      transition: "all 0.2s"
    },
    iconBtn: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "6px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background-color 0.2s",
      flexShrink: 0
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
      borderLeft: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.12)" : t.border}`,
      borderRight: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.12)" : t.border}`,
      ...(glass && {
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        backgroundColor: "rgba(255,255,255,0.1)",
      }),
    },
    sidebar: {
      width: "350px",
      padding: "0 24px",
      display: m ? "none" : "block",
      overflowY: "auto",
      ...(glass && {
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderLeft: "1px solid rgba(255,255,255,0.18)",
      }),
    },
    trendingCard: {
      backgroundColor: glass ? "rgba(255,255,255,0.1)" : t.cardBg,
      borderRadius: "16px",
      padding: "12px 0",
      transition: "background-color 0.3s",
      overflow: "hidden",
      ...(glass && {
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }),
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
    saveDraftBtn: { backgroundColor: "transparent", color: t.textSecondary, border: `1px solid ${t.border}`, padding: m ? "8px 14px" : "10px 18px", borderRadius: "9999px", fontWeight: "600", fontSize: "13px", cursor: "pointer", transition: "all 0.2s" },
    draftsIndicator: { background: "none", border: "none", color: t.accentBlue, cursor: "pointer", fontSize: "13px", fontWeight: "600", padding: "6px 8px", borderRadius: 8 },
    draftsDropdown: { position: "absolute", top: "100%", right: 0, minWidth: 260, maxHeight: 300, overflowY: "auto", backgroundColor: glass ? "rgba(30,30,30,0.92)" : t.cardBg, border: `1px solid ${glass ? "rgba(255,255,255,0.2)" : t.border}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 100, backdropFilter: glass ? "blur(40px)" : undefined },
    draftsHeader: { padding: "10px 14px", fontWeight: "700", fontSize: 14, color: t.text, borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.15)" : t.border}` },
    draftItem: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.08)" : t.border}`, cursor: "pointer", transition: "background 0.15s" },
    draftContent: { flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    draftDeleteBtn: { background: "none", border: "none", color: t.riskText || "#e0245e", cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0 },
    feedList: { display: "flex", flexDirection: "column", gap: "0", paddingBottom: "100px" },
    postCard: { backgroundColor: glass ? "rgba(255,255,255,0.1)" : t.cardBg, padding: m ? "12px 12px 4px" : "16px 16px 4px", borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.15)" : t.border}`, transition: "background-color 0.15s" },
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
    heartOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: 5,
    },
    heartSvg: {
      animation: "heartPop 0.9s ease-out forwards",
      filter: "drop-shadow(0 2px 8px rgba(249, 24, 128, 0.5))",
    },
    shareBtn: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: t.textSecondary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "6px",
      borderRadius: "50%",
      transition: "color 0.2s",
    },
    newPostsBanner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      padding: "10px 20px",
      margin: "0 auto",
      marginTop: "8px",
      width: "fit-content",
      borderRadius: "9999px",
      backgroundColor: t.accentBlue,
      color: "#fff",
      fontSize: "13px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 2px 12px rgba(29,155,240,0.4)",
      transition: "transform 0.2s, box-shadow 0.2s",
      zIndex: 5,
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
    },
    editBtn: {
      width: "100%",
      border: "none",
      background: "transparent",
      padding: "12px 16px",
      textAlign: "left",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "500",
      color: t.text,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "background 0.2s",
      borderRadius: "12px"
    },
    editOverlay: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    editModal: {
      backgroundColor: t.cardBg,
      borderRadius: "16px",
      padding: "24px",
      width: "90%",
      maxWidth: "500px",
      border: `1px solid ${t.border}`,
    },
    editHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },
    editTextarea: {
      width: "100%",
      minHeight: "120px",
      borderRadius: "12px",
      border: `1px solid ${t.border}`,
      backgroundColor: t.bg,
      color: t.text,
      padding: "12px",
      fontSize: "15px",
      resize: "vertical",
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box",
    },
    editCancelBtn: {
      padding: "8px 20px",
      borderRadius: "20px",
      border: `1px solid ${t.border}`,
      background: "transparent",
      color: t.text,
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
    },
    editSaveBtn: {
      padding: "8px 24px",
      borderRadius: "20px",
      border: "none",
      backgroundColor: t.accentBlue,
      color: "#fff",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
    },
  };
}