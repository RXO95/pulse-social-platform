import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import GifPicker from "../components/GifPicker";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";
import { parseContent } from "../utils/parseContent";

const SCREEN_WIDTH = Dimensions.get("window").width;

// Auto-sizing GIF component
const AutoGif = ({ uri, style }) => {
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    if (uri) {
      Image.getSize(
        uri,
        (w, h) => { if (w && h) setRatio(w / h); },
        () => { }
      );
    }
  }, [uri]);
  const maxW = SCREEN_WIDTH - 64;
  const height = Math.min(maxW / ratio, 400);
  return (
    <Image
      source={{ uri }}
      style={[style, { height, width: "100%" }]}
      resizeMode="contain"
    />
  );
};

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuPostId, setMenuPostId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedGif, setSelectedGif] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [repostMenuPostId, setRepostMenuPostId] = useState(null);
  const [quotePostId, setQuotePostId] = useState(null);
  const [quoteContent, setQuoteContent] = useState("");
  const [isQuoting, setIsQuoting] = useState(false);

  // Edit post state
  const [editPostId, setEditPostId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // Double-tap to like
  const lastTapRef = useRef({});
  const heartScale = useRef(new Animated.Value(0)).current;
  const [doubleTapPostId, setDoubleTapPostId] = useState(null);

  // Scroll-to-top & new posts banner
  const flatListRef = useRef(null);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const latestPostIdRef = useRef(null);
  const searchTimerRef = useRef(null);

  const { darkMode, accentColor } = useTheme();
  const t = getTheme(darkMode, accentColor);
  const toast = useToast();

  // ─── Fetch Data ───
  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/users/me");
      setCurrentUser(res.data);
    } catch { }
  };

  const fetchPosts = async (showLoader = true) => {
    // Don't overwrite search results
    if (searchQuery.trim()) return;
    try {
      if (showLoader) setIsLoading(true);
      const res = await api.get("/posts/");
      setPosts(
        res.data.map((p) => ({
          ...p,
          translatedText: null,
          showTranslation: false,
        }))
      );
    } catch {
      toast("Failed to load feed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchCurrentUser();
    fetchPosts();
    fetchDrafts();
  }, []);

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
        const res = await api.get("/feed/latest-id");
        const latestId = res.data?.latest_id;
        if (latestId && latestId !== latestPostIdRef.current) {
          setHasNewPosts(true);
        }
      } catch { }
    }, 30000);
    return () => clearInterval(interval);
  }, [searchQuery]);

  // ─── Double-tap to like ───
  const handleCardPress = (postId) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[postId] || 0;

    if (now - lastTap < 300) {
      // Double tap → like
      clearTimeout(lastTapRef.current[`${postId}_t`]);
      const post = posts.find((p) => p._id === postId);
      if (post && !post.is_liked_by_user) {
        handleLike(postId);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDoubleTapPostId(postId);
      heartScale.setValue(0);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 3 }),
        Animated.delay(600),
        Animated.timing(heartScale, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setDoubleTapPostId(null));
      lastTapRef.current[postId] = 0;
    } else {
      lastTapRef.current[postId] = now;
      lastTapRef.current[`${postId}_t`] = setTimeout(() => {
        if (lastTapRef.current[postId] === now) {
          navigation.navigate("PostDetail", { postId });
          lastTapRef.current[postId] = 0;
        }
      }, 280);
    }
  };

  // ─── Share post ───
  const handleShare = async (postId) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        message: `https://webpulse.social/post/${postId}`,
        url: `https://webpulse.social/post/${postId}`,
      });
    } catch { }
  };

  // ─── Skeleton loader ───
  const SkeletonPost = () => {
    const shimmer = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }, []);
    const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
    return (
      <View style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Animated.View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.border, opacity }} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Animated.View style={{ width: 100, height: 14, borderRadius: 6, backgroundColor: t.border, opacity, marginBottom: 6 }} />
            <Animated.View style={{ width: 60, height: 10, borderRadius: 6, backgroundColor: t.border, opacity }} />
          </View>
        </View>
        <Animated.View style={{ width: "100%", height: 14, borderRadius: 6, backgroundColor: t.border, opacity, marginBottom: 8 }} />
        <Animated.View style={{ width: "80%", height: 14, borderRadius: 6, backgroundColor: t.border, opacity, marginBottom: 8 }} />
        <Animated.View style={{ width: "55%", height: 14, borderRadius: 6, backgroundColor: t.border, opacity, marginBottom: 12 }} />
        <View style={{ flexDirection: "row", gap: 24, marginTop: 4, paddingTop: 10, borderTopWidth: 0.5, borderColor: t.border }}>
          <Animated.View style={{ width: 40, height: 16, borderRadius: 6, backgroundColor: t.border, opacity }} />
          <Animated.View style={{ width: 40, height: 16, borderRadius: 6, backgroundColor: t.border, opacity }} />
          <Animated.View style={{ width: 40, height: 16, borderRadius: 6, backgroundColor: t.border, opacity }} />
        </View>
      </View>
    );
  };

  // ─── Actions ───
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access to upload images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSelectedImage(result.assets[0]);
      setSelectedGif(null); // clear gif if image selected
    }
  };

  const handleGifSelect = (url, preview) => {
    setSelectedGif({ url, preview });
    setSelectedImage(null); // clear image if gif selected
  };

  const handlePost = async () => {
    if (!content.trim() && !selectedImage && !selectedGif) return;
    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      if (selectedImage) {
        const uri = selectedImage.uri;
        const name = uri.split("/").pop() || "upload.jpg";
        const ext = name.split(".").pop()?.toLowerCase() || "jpg";
        const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime" };
        formData.append("file", { uri, name, type: mimeMap[ext] || "image/jpeg" });
      }
      if (selectedGif) {
        formData.append("gif_url", selectedGif.url);
      }
      await api.post("/posts/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setContent("");
      setSelectedImage(null);
      setSelectedGif(null);
      fetchPosts(false);
    } catch {
      toast("Failed to create post", "error");
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId) => {
    const post = posts.find((p) => p._id === postId);
    if (!post) return;
    const wasLiked = post.is_liked_by_user;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? {
            ...p,
            is_liked_by_user: !wasLiked,
            likes: wasLiked ? p.likes - 1 : p.likes + 1,
          }
          : p
      )
    );

    try {
      const res = await api.post(`/likes/${postId}`);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, is_liked_by_user: res.data.liked, likes: res.data.likes }
            : p
        )
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, is_liked_by_user: wasLiked, likes: post.likes }
            : p
        )
      );
    }
  };

  const handleBookmark = async (postId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await api.post(`/bookmarks/${postId}`);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, is_bookmarked: res.data.bookmarked } : p
        )
      );
    } catch {
      toast("Bookmark failed", "error");
    }
  };

  const handleRepost = async (postId) => {
    setRepostMenuPostId(null);
    const post = posts.find((p) => p._id === postId);
    if (!post) return;
    const wasReposted = post.is_reposted_by_user;

    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? {
            ...p,
            is_reposted_by_user: !wasReposted,
            repost_count: wasReposted
              ? (p.repost_count || 1) - 1
              : (p.repost_count || 0) + 1,
          }
          : p
      )
    );

    try {
      const res = await api.post(`/reposts/${postId}`);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? {
              ...p,
              is_reposted_by_user: res.data.reposted,
              repost_count: res.data.repost_count,
            }
            : p
        )
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? {
              ...p,
              is_reposted_by_user: wasReposted,
              repost_count: post.repost_count || 0,
            }
            : p
        )
      );
    }
  };

  const openQuoteRepost = (postId) => {
    setRepostMenuPostId(null);
    setQuotePostId(postId);
    setQuoteContent("");
  };

  const submitQuoteRepost = async () => {
    if (!quoteContent.trim() || !quotePostId) return;
    setIsQuoting(true);
    try {
      await api.post(`/reposts/${quotePostId}/quote`, { content: quoteContent.trim() });
      setQuotePostId(null);
      setQuoteContent("");
      fetchPosts(false);
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to quote repost", "error");
    } finally {
      setIsQuoting(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      fetchPosts(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/?q=${encodeURIComponent(query)}`);
        setPosts(res.data.results || []);
      } catch {
        toast("Search failed", "error");
      }
    }, 350);
  };

  const handleDelete = async (postId) => {
    setMenuPostId(null);
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/posts/${postId}`);
            setPosts((prev) => prev.filter((p) => p._id !== postId));
          } catch {
            toast("Failed to delete post", "error");
          }
        },
      },
    ]);
  };

  // ─── Edit Post ───
  const openEditModal = (post) => {
    setMenuPostId(null);
    setEditPostId(post._id);
    setEditContent(post.content || "");
  };

  const handleEditPost = async () => {
    if (!editContent.trim() || !editPostId) return;
    setIsEditSaving(true);
    try {
      await api.put(`/posts/${editPostId}`, { content: editContent.trim() });
      setPosts((prev) =>
        prev.map((p) =>
          p._id === editPostId
            ? { ...p, content: editContent.trim(), is_edited: true }
            : p
        )
      );
      setEditPostId(null);
      setEditContent("");
    } catch (err) {
      toast(err.response?.data?.detail?.message || err.response?.data?.detail || "Failed to edit post", "error");
    } finally {
      setIsEditSaving(false);
    }
  };

  // ─── Drafts ───
  const fetchDrafts = async () => {
    try {
      const res = await api.get("/drafts/");
      setDrafts(res.data);
    } catch { }
  };

  const saveDraft = async () => {
    if (!content.trim() && !selectedGif) return;
    try {
      await api.post("/drafts/", { content: content.trim(), gif_url: selectedGif?.url || null });
      setContent("");
      setSelectedGif(null);
      setSelectedImage(null);
      fetchDrafts();
      toast("Draft saved", "success");
    } catch { toast("Could not save draft", "error"); }
  };

  const loadDraft = (draft) => {
    setContent(draft.content || "");
    if (draft.gif_url) setSelectedGif({ url: draft.gif_url, preview: draft.gif_url });
    setShowDrafts(false);
    api.delete(`/drafts/${draft._id}`).then(() => fetchDrafts()).catch(() => { });
  };

  const deleteDraft = (draftId) => {
    api.delete(`/drafts/${draftId}`).then(() => fetchDrafts()).catch(() => { });
  };

  const handleFollowToggle = async (postAuthorId, isFollowing) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.user_id === postAuthorId
          ? { ...p, is_followed_by_user: !isFollowing }
          : p
      )
    );

    try {
      const method = isFollowing ? "delete" : "post";
      await api[method](`/follow/${postAuthorId}`);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.user_id === postAuthorId
            ? { ...p, is_followed_by_user: isFollowing }
            : p
        )
      );
    }
  };

  const handleTranslate = async (postId, originalText) => {
    const postIndex = posts.findIndex((p) => p._id === postId);
    if (postIndex === -1) return;
    const post = posts[postIndex];

    if (post.translatedText) {
      setPosts((prev) => {
        const updated = [...prev];
        updated[postIndex] = {
          ...updated[postIndex],
          showTranslation: !updated[postIndex].showTranslation,
        };
        return updated;
      });
      return;
    }

    try {
      const res = await api.post("/translate/", {
        text: originalText,
        target_lang: "en",
      });
      setPosts((prev) => {
        const updated = [...prev];
        updated[postIndex] = {
          ...updated[postIndex],
          translatedText: res.data.translated_text,
          showTranslation: true,
        };
        return updated;
      });
    } catch {
      toast("Translation failed", "error");
    }
  };

  // ─── Render Post Card ───
  const renderPost = ({ item: post }) => {
    const isAdmin = currentUser?.username === "Zuckk";
    const isMine = currentUser && (post.username === currentUser.username || isAdmin);
    const isOtherUser = currentUser && post.username !== currentUser.username;

    return (
      <View
        style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
      >
        {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile", { username: post.username })}
          >
            <View style={[styles.avatar, { backgroundColor: t.avatarBg }]}>
              {post.profile_pic_url ? (
                <Image source={{ uri: post.profile_pic_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>
                  {(post.username || "?")[0].toUpperCase()}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.postMeta}>
            <View style={styles.usernameRow}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("Profile", { username: post.username })
                }
              >
                <Text style={[styles.username, { color: t.text }]}>
                  @{post.username}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.timestamp, { color: t.textSecondary }]}>
                · {timeAgo(post.created_at)}
              </Text>
            </View>

            {/* Follow button */}
            {isOtherUser && (
              <TouchableOpacity
                onPress={() =>
                  handleFollowToggle(post.user_id, post.is_followed_by_user)
                }
                style={[
                  styles.followBtnSmall,
                  post.is_followed_by_user
                    ? { backgroundColor: "transparent", borderWidth: 1, borderColor: t.border }
                    : { backgroundColor: t.accentBlue },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: post.is_followed_by_user ? t.text : "#fff",
                  }}
                >
                  {post.is_followed_by_user ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 3-dot menu for own posts */}
          {isMine && (
            <TouchableOpacity
              onPress={() => setMenuPostId(post._id)}
              style={styles.menuBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={t.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Double-tap zone: Content + Media */}
        <Pressable onPress={() => handleCardPress(post._id)} style={{ position: "relative" }}>
          {/* Content */}
          <Text style={[styles.postContent, { color: t.text }]}>
            {parseContent(post.showTranslation ? post.translatedText : post.content, { navigation, accentColor: t.accentBlue })}
            {post.is_edited && (
              <Text style={{ fontSize: 12, fontStyle: "italic", color: t.textSecondary }}> (edited)</Text>
            )}
          </Text>

          {/* Media */}
          {post.media_url && (
            <Image
              source={{ uri: post.media_url }}
              style={styles.postMedia}
              resizeMode="cover"
            />
          )}

          {/* GIF */}
          {post.gif_url && !post.media_url && (
            <View style={styles.gifPostWrap}>
              <AutoGif uri={post.gif_url} style={styles.postMediaGif} />
              <View style={styles.gifPostBadge}>
                <Text style={styles.gifBadgeText}>GIF</Text>
              </View>
            </View>
          )}

          {/* Heart overlay animation */}
          {doubleTapPostId === post._id && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: "center",
                alignItems: "center",
                transform: [{ scale: heartScale }],
                opacity: heartScale,
              }}
            >
              <Ionicons name="heart" size={80} color="#f91880" />
            </Animated.View>
          )}
        </Pressable>

        {/* Translate button */}
        <TouchableOpacity
          onPress={() => handleTranslate(post._id, post.content)}
          style={{ marginBottom: 8 }}
        >
          <Text style={{ color: t.accentBlue, fontSize: 13, fontWeight: "500" }}>
            {post.showTranslation ? "See Original" : "Translate Post"}
          </Text>
        </TouchableOpacity>

        {/* Risk badge */}
        {post.risk_score > 0.6 && (
          <View style={[styles.riskBadge, { backgroundColor: t.riskBg }]}>
            <Text style={{ color: t.riskText, fontSize: 12, fontWeight: "600" }}>
              ⚠ High Risk Content
            </Text>
          </View>
        )}

        {/* Entity tags */}
        {post.entities && post.entities.length > 0 && (
          <View style={styles.entityRow}>
            {post.entities.slice(0, 5).map((ent, idx) => {
              const isMention =
                ent.source === "mention" || ent.text.startsWith("@");
              const isHashtag =
                ent.source === "hashtag" || ent.text.startsWith("#");

              let tagBg = t.tagBg;
              let tagColor = t.tagText;
              if (isMention) {
                tagBg = t.mentionTagBg;
                tagColor = t.mentionTagText;
              } else if (isHashtag) {
                tagBg = t.hashtagTagBg;
                tagColor = t.hashtagTagText;
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.entityTag, { backgroundColor: tagBg }]}
                  onPress={() => {
                    if (isMention) {
                      navigation.navigate("Profile", {
                        username: ent.text.replace("@", ""),
                      });
                    } else {
                      const entityName =
                        ent.identified_as || ent.text.replace("#", "");
                      navigation.navigate("EntityExplore", {
                        entityText: entityName,
                      });
                    }
                  }}
                >
                  <Text style={[styles.entityTagText, { color: tagColor }]}>
                    {ent.text}
                  </Text>
                  {ent.label ? (
                    <Text
                      style={{
                        color: t.textSecondary,
                        fontSize: 10,
                        marginLeft: 3,
                      }}
                    >
                      {ent.label}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Action bar */}
        <View style={[styles.actionBar, { borderTopColor: t.border }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleLike(post._id)}
          >
            <Ionicons
              name={post.is_liked_by_user ? "heart" : "heart-outline"}
              size={22}
              color={post.is_liked_by_user ? "#f91880" : t.textSecondary}
            />
            <Text style={[styles.actionCount, { color: t.textSecondary }]}>
              {post.likes || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate("PostDetail", { postId: post._id })
            }
          >
            <Ionicons name="chatbubble-outline" size={20} color={t.accentBlue} />
            <Text style={[styles.actionCount, { color: t.textSecondary }]}>
              {post.comment_count || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setRepostMenuPostId(post._id)}
          >
            <Ionicons
              name={post.is_reposted_by_user ? "repeat" : "repeat-outline"}
              size={22}
              color={post.is_reposted_by_user ? "#00ba7c" : t.textSecondary}
            />
            <Text style={[styles.actionCount, { color: post.is_reposted_by_user ? "#00ba7c" : t.textSecondary }]}>
              {post.repost_count || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleBookmark(post._id)}
          >
            <Ionicons
              name={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
              size={20}
              color={post.is_bookmarked ? t.accentBlue : t.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleShare(post._id)}
          >
            <Ionicons name="share-outline" size={20} color={t.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Compose Header ───
  const ListHeader = () => (
    <View>
      {/* Search bar */}
      <View
        style={[
          styles.searchRow,
          { backgroundColor: t.inputBg, borderColor: t.inputBorder },
        ]}
      >
        <Ionicons name="search" size={18} color={t.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: t.text }]}
          placeholder="Search posts…"
          placeholderTextColor={t.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Compose */}
      <View
        style={[
          styles.composeCard,
          { backgroundColor: t.cardBg, borderColor: t.border },
        ]}
      >
        <TextInput
          style={[
            styles.composeInput,
            { color: t.text, backgroundColor: t.inputBg },
          ]}
          placeholder="What's happening?"
          placeholderTextColor={t.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={1000}
        />
        {content.length > 0 && (
          <Text style={{ textAlign: "right", fontSize: 12, color: content.length > 900 ? (content.length > 980 ? "#f4212e" : "#ff9800") : t.textSecondary, marginTop: -4, marginBottom: 4, opacity: 0.8 }}>
            {content.length}/1000
          </Text>
        )}

        {/* Image / GIF preview */}
        {selectedImage && (
          <View style={styles.mediaPreviewWrap}>
            <Image source={{ uri: selectedImage.uri }} style={styles.mediaPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => setSelectedImage(null)}>
              <Ionicons name="close-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        {selectedGif && (
          <View style={styles.mediaPreviewWrap}>
            <Image source={{ uri: selectedGif.preview || selectedGif.url }} style={styles.mediaPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => setSelectedGif(null)}>
              <Ionicons name="close-circle" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.gifBadge}>
              <Text style={styles.gifBadgeText}>GIF</Text>
            </View>
          </View>
        )}

        {/* Toolbar row */}
        <View style={styles.composeToolbar}>
          <View style={styles.composeTools}>
            <TouchableOpacity onPress={pickImage} style={styles.toolBtn}>
              <Ionicons name="image-outline" size={22} color={t.accentBlue} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowGifPicker(true)} style={[styles.toolBtn, styles.gifBtn]}>
              <Text style={[styles.gifLabel, { color: t.accentBlue, borderColor: t.accentBlue }]}>GIF</Text>
            </TouchableOpacity>
            {drafts.length > 0 && (
              <TouchableOpacity onPress={() => setShowDrafts(true)} style={styles.toolBtn}>
                <Text style={{ fontSize: 12, color: t.accentBlue, fontWeight: "600" }}>Drafts ({drafts.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {(content.trim() || selectedGif) && (
              <TouchableOpacity onPress={saveDraft} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: t.textSecondary, fontSize: 13, fontWeight: "600" }}>Draft</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.postButton, { backgroundColor: t.accentBlue }, (!content.trim() && !selectedImage && !selectedGif) && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={(!content.trim() && !selectedImage && !selectedGif) || isPosting}
              activeOpacity={0.8}
            >
              {isPosting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Nav Header – tap to scroll to top */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}
      >
        <Text style={[styles.navTitle, { color: t.text }]}>Pulse</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Notifications")} hitSlop={12}>
          <Ionicons name="notifications-outline" size={24} color={t.text} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* New posts available banner */}
      {hasNewPosts && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.newPostsBanner, { backgroundColor: t.accentBlue }]}
          onPress={() => {
            setHasNewPosts(false);
            onRefresh();
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
        >
          <Ionicons name="arrow-up" size={14} color="#fff" />
          <Text style={styles.newPostsBannerText}>New posts available</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <SkeletonPost />
          <SkeletonPost />
          <SkeletonPost />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={renderPost}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accentBlue}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color={t.textSecondary}
              />
              <Text style={[styles.emptyText, { color: t.textSecondary }]}>
                No posts yet. Be the first!
              </Text>
            </View>
          }
        />
      )}

      {/* GIF Picker */}
      <GifPicker
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
        theme={t}
      />

      {/* 3-dot menu bottom sheet */}
      <Modal
        visible={!!menuPostId}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuPostId(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuPostId(null)}>
          <View style={[styles.menuSheet, { backgroundColor: t.cardBg }]}>
            {/* Edit Post - only for own posts (not admin deleting others) */}
            {(() => {
              const menuPost = posts.find(p => p._id === menuPostId);
              if (menuPost && currentUser && menuPost.username === currentUser.username) {
                return (
                  <TouchableOpacity
                    style={styles.menuSheetItem}
                    onPress={() => openEditModal(menuPost)}
                  >
                    <Ionicons name="create-outline" size={20} color={t.accentBlue} />
                    <Text style={[styles.menuSheetText, { color: t.text }]}>
                      Edit Post
                    </Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })()}
            <TouchableOpacity
              style={styles.menuSheetItem}
              onPress={() => handleDelete(menuPostId)}
            >
              <Ionicons name="trash-outline" size={20} color={t.riskText} />
              <Text style={[styles.menuSheetText, { color: t.riskText }]}>
                Delete Post
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuSheetItem, { borderBottomWidth: 0 }]}
              onPress={() => setMenuPostId(null)}
            >
              <Ionicons name="close" size={20} color={t.textSecondary} />
              <Text style={[styles.menuSheetText, { color: t.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Repost menu bottom sheet */}
      <Modal
        visible={!!repostMenuPostId}
        transparent
        animationType="slide"
        onRequestClose={() => setRepostMenuPostId(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setRepostMenuPostId(null)}>
          <View style={[styles.menuSheet, { backgroundColor: t.cardBg }]}>
            <TouchableOpacity
              style={styles.menuSheetItem}
              onPress={() => handleRepost(repostMenuPostId)}
            >
              <Ionicons name="repeat" size={20} color="#00ba7c" />
              <Text style={[styles.menuSheetText, { color: t.text }]}>
                {posts.find(p => p._id === repostMenuPostId)?.is_reposted_by_user ? "Undo Repost" : "Repost"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuSheetItem}
              onPress={() => openQuoteRepost(repostMenuPostId)}
            >
              <Ionicons name="create-outline" size={20} color="#00ba7c" />
              <Text style={[styles.menuSheetText, { color: t.text }]}>
                Quote Repost
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuSheetItem, { borderBottomWidth: 0 }]}
              onPress={() => setRepostMenuPostId(null)}
            >
              <Ionicons name="close" size={20} color={t.textSecondary} />
              <Text style={[styles.menuSheetText, { color: t.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Quote repost modal */}
      <Modal
        visible={!!quotePostId}
        transparent
        animationType="slide"
        onRequestClose={() => setQuotePostId(null)}
      >
        <View style={[styles.quoteOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.quoteSheet, { backgroundColor: t.cardBg }]}>
            <View style={styles.quoteHeader}>
              <Text style={[styles.quoteTitle, { color: t.text }]}>Quote Repost</Text>
              <TouchableOpacity onPress={() => setQuotePostId(null)}>
                <Ionicons name="close" size={24} color={t.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.quoteInput, { color: t.text, borderColor: t.border }]}
              placeholder="Add your thoughts..."
              placeholderTextColor={t.textSecondary}
              value={quoteContent}
              onChangeText={setQuoteContent}
              multiline
              maxLength={1000}
            />
            {quoteContent.length > 0 && (
              <Text style={{ textAlign: "right", fontSize: 12, color: quoteContent.length > 900 ? (quoteContent.length > 980 ? "#f4212e" : "#ff9800") : t.textSecondary, marginTop: 2, opacity: 0.8 }}>
                {quoteContent.length}/1000
              </Text>
            )}
            {(() => {
              const qPost = posts.find(p => p._id === quotePostId);
              if (!qPost) return null;
              return (
                <View style={[styles.quotePreview, { borderColor: t.border }]}>
                  <Text style={[styles.quotePreviewUser, { color: t.accent }]}>@{qPost.username}</Text>
                  <Text style={[styles.quotePreviewText, { color: t.textSecondary }]} numberOfLines={3}>{parseContent(qPost.content, { navigation, accentColor: t.accentBlue })}</Text>
                </View>
              );
            })()}
            <TouchableOpacity
              style={[styles.quoteSubmitBtn, { opacity: quoteContent.trim() ? 1 : 0.5 }]}
              onPress={submitQuoteRepost}
              disabled={!quoteContent.trim() || isQuoting}
            >
              <Text style={styles.quoteSubmitText}>{isQuoting ? "Posting..." : "Post"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit post modal */}
      <Modal
        visible={!!editPostId}
        transparent
        animationType="slide"
        onRequestClose={() => setEditPostId(null)}
      >
        <View style={[styles.quoteOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.quoteSheet, { backgroundColor: t.cardBg }]}>
            <View style={styles.quoteHeader}>
              <Text style={[styles.quoteTitle, { color: t.text }]}>Edit Post</Text>
              <TouchableOpacity onPress={() => setEditPostId(null)}>
                <Ionicons name="close" size={24} color={t.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.quoteInput, { color: t.text, borderColor: t.border, minHeight: 120 }]}
              placeholder="Edit your post..."
              placeholderTextColor={t.textSecondary}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.quoteSubmitBtn, { opacity: editContent.trim() ? 1 : 0.5 }]}
              onPress={handleEditPost}
              disabled={!editContent.trim() || isEditSaving}
            >
              <Text style={styles.quoteSubmitText}>{isEditSaving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drafts bottom sheet */}
      <Modal
        visible={showDrafts}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDrafts(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowDrafts(false)}>
          <View style={[styles.menuSheet, { backgroundColor: t.cardBg, maxHeight: 400 }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: t.text, padding: 16, borderBottomWidth: 1, borderBottomColor: t.border }}>
              Your Drafts
            </Text>
            {drafts.length === 0 ? (
              <Text style={{ color: t.textSecondary, padding: 16, textAlign: "center" }}>No drafts saved</Text>
            ) : (
              drafts.map((d) => (
                <View key={d._id} style={{ flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: t.border }}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => loadDraft(d)}>
                    <Text style={{ color: t.text, fontSize: 14 }} numberOfLines={2}>
                      {d.content || "(GIF only)"}
                    </Text>
                    <Text style={{ color: t.textSecondary, fontSize: 11, marginTop: 4 }}>
                      Tap to load
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteDraft(d._id)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={t.riskText} />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity
              style={[styles.menuSheetItem, { borderBottomWidth: 0 }]}
              onPress={() => setShowDrafts(false)}
            >
              <Text style={[styles.menuSheetText, { color: t.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 22, fontWeight: "800" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },

  composeCard: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  composeInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: "top",
  },
  composeToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  composeTools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  toolBtn: {
    padding: 8,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  gifBtn: {
    height: 38,
    width: 38,
    padding: 0,
  },
  gifLabel: {
    fontSize: 11,
    fontWeight: "800",
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  mediaPreviewWrap: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  mediaPreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  mediaRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  gifBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gifBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  gifPostWrap: {
    position: "relative",
    marginBottom: 8,
  },
  gifPostBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  postButton: {
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: "flex-end",
    marginTop: 10,
  },
  postButtonDisabled: { opacity: 0.4 },
  postButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  postCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  postHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  postMeta: { marginLeft: 10, flex: 1 },
  usernameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  username: { fontWeight: "700", fontSize: 15 },
  timestamp: { fontSize: 12, marginLeft: 4 },
  followBtnSmall: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    alignSelf: "flex-start",
    marginTop: 3,
    minHeight: 32,
    justifyContent: "center",
  },
  menuBtn: { padding: 10 },

  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  postMedia: { width: "100%", height: 200, borderRadius: 12, marginBottom: 8 },
  postMediaGif: { borderRadius: 12, marginBottom: 8 },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },

  entityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  entityTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  entityTagText: { fontSize: 12, fontWeight: "600" },

  actionBar: {
    flexDirection: "row",
    gap: 24,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionCount: { fontSize: 13, fontWeight: "600" },

  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 15 },

  newPostsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginHorizontal: 40,
    marginTop: 8,
    borderRadius: 9999,
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  newPostsBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Menu modal
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 8,
    paddingBottom: 30,
  },
  menuSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
    borderBottomWidth: 0.5,
    borderColor: "rgba(128,128,128,0.15)",
  },
  menuSheetText: { fontSize: 16, fontWeight: "600" },
  quoteOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  quoteSheet: { width: "90%", borderRadius: 16, padding: 20 },
  quoteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  quoteTitle: { fontSize: 18, fontWeight: "700" },
  quoteInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: "top", marginBottom: 12 },
  quotePreview: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  quotePreviewUser: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  quotePreviewText: { fontSize: 13 },
  quoteSubmitBtn: { backgroundColor: "#00ba7c", borderRadius: 20, paddingVertical: 12, alignItems: "center" },
  quoteSubmitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
