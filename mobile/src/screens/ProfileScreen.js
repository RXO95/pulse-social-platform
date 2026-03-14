import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";
import { parseContent } from "../utils/parseContent";

export default function ProfileScreen({ navigation, route }) {
  const usernameParam = route.params?.username;

  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuPostId, setMenuPostId] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [reposts, setReposts] = useState([]);
  const [isLoadingReposts, setIsLoadingReposts] = useState(false);
  const [repostMenuPostId, setRepostMenuPostId] = useState(null);
  const [quotePostId, setQuotePostId] = useState(null);
  const [quoteContent, setQuoteContent] = useState("");
  const [isQuoting, setIsQuoting] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPicture, setEditPicture] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { darkMode, toggleDarkMode, accentColor } = useTheme();
  const { logout } = useAuth();
  const t = getTheme(darkMode, accentColor);
  const toast = useToast();

  const isOwnProfile = currentUser && profile && currentUser.username === profile.username;

  // Sidebar
  const [showSidebar, setShowSidebar] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(Dimensions.get("window").width)).current;

  const openSidebar = () => {
    setShowSidebar(true);
    Animated.spring(sidebarAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };
  const closeSidebar = () => {
    Animated.timing(sidebarAnim, { toValue: Dimensions.get("window").width, duration: 250, useNativeDriver: true }).start(() => setShowSidebar(false));
  };

  // ─── Fetch ───
  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/users/me");
      setCurrentUser(res.data);
    } catch {}
  };

  const fetchProfile = async () => {
    const uname = usernameParam || currentUser?.username;
    if (!uname) return;
    setIsLoadingProfile(true);
    try {
      const res = await api.get(`/users/${uname}`);
      setProfile(res.data);
    } catch {
      toast("Failed to load profile", "error");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchUserPosts = async () => {
    const uname = usernameParam || currentUser?.username;
    if (!uname) return;
    setIsLoadingPosts(true);
    try {
      const res = await api.get("/posts/");
      setPosts(
        res.data
          .filter((p) => p.username === uname)
          .map((p) => ({ ...p, translatedText: null, showTranslation: false }))
      );
    } catch {
      toast("Could not load posts", "error");
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const fetchReposts = async () => {
    const uname = usernameParam || currentUser?.username;
    if (!uname) return;
    setIsLoadingReposts(true);
    try {
      const res = await api.get(`/reposts/user/${uname}`);
      setReposts(res.data);
    } catch {
      toast("Could not load reposts", "error");
    } finally {
      setIsLoadingReposts(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchUserPosts(), fetchReposts()]);
    setRefreshing(false);
  }, [usernameParam, currentUser]);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (usernameParam || currentUser) {
      fetchProfile();
      fetchUserPosts();
      fetchReposts();
    }
  }, [usernameParam, currentUser?.username]);

  // ─── Follow ───
  const handleFollowToggle = async () => {
    if (!profile) return;
    const method = profile.is_followed_by_user ? "delete" : "post";
    try {
      await api[method](`/follow/${profile.user_id}`);
      fetchProfile();
    } catch {
      toast("Action failed", "error");
    }
  };

  // ─── Like ───
  const handleLike = async (postId) => {
    const post = posts.find((p) => p._id === postId);
    if (!post) return;
    const wasLiked = post.is_liked_by_user;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? { ...p, is_liked_by_user: !wasLiked, likes: (p.likes || 0) + (wasLiked ? -1 : 1) }
          : p
      )
    );
    try {
      if (wasLiked) {
        await api.delete(`/likes/${postId}`);
      } else {
        await api.post(`/likes/${postId}`);
      }
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, is_liked_by_user: wasLiked, likes: (p.likes || 0) + (wasLiked ? 1 : -1) }
            : p
        )
      );
    }
  };

  // ─── Delete ───
  const handleDelete = (postId) => {
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

  const handleBookmark = async (postId) => {
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
            ? { ...p, is_reposted_by_user: res.data.reposted, repost_count: res.data.repost_count }
            : p
        )
      );
      fetchReposts();
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, is_reposted_by_user: wasReposted, repost_count: post.repost_count || 0 }
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
      fetchReposts();
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to quote repost", "error");
    } finally {
      setIsQuoting(false);
    }
  };

  const handleTranslate = async (postId, originalText) => {
    const idx = posts.findIndex((p) => p._id === postId);
    if (idx === -1) return;
    const post = posts[idx];
    if (post.translatedText) {
      setPosts((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], showTranslation: !updated[idx].showTranslation };
        return updated;
      });
      return;
    }
    try {
      const res = await api.post("/translate/", { text: originalText, target_lang: "en" });
      setPosts((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], translatedText: res.data.translated_text, showTranslation: true };
        return updated;
      });
    } catch {
      toast("Translation failed", "error");
    }
  };

  // ─── Edit Profile ───
  const openEdit = () => {
    setEditUsername(profile.username || "");
    setEditBio(profile.bio || "");
    setEditPicture(null);
    setIsEditing(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setEditPicture(result.assets[0]);
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      if (editUsername.trim() && editUsername !== profile.username) {
        formData.append("username", editUsername.trim());
      }
      formData.append("bio", editBio);
      if (editPicture) {
        formData.append("profile_picture", {
          uri: editPicture.uri,
          name: "profile.jpg",
          type: "image/jpeg",
        });
      }
      const res = await api.put("/users/me", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setIsEditing(false);
      if (res.data.user.username !== profile.username) {
        navigation.setParams({ username: res.data.user.username });
      }
      fetchProfile();
      fetchCurrentUser();
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to update", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ───
  if (isLoadingProfile || !profile) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accentBlue} />
      </View>
    );
  }

  const renderPost = ({ item: post }) => {
    const isMine = isOwnProfile || currentUser?.username === "Zuckk";

    return (
      <TouchableOpacity
        style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
        onPress={() => navigation.navigate("PostDetail", { postId: post._id })}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => navigation.navigate("Profile", { username: post.username })}>
            <View style={[styles.avatar, { backgroundColor: t.avatarBg }]}>
              {post.profile_pic_url ? (
                <Image source={{ uri: post.profile_pic_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(post.username || "?")[0].toUpperCase()}</Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.postMeta}>
            <View style={styles.usernameRow}>
              <TouchableOpacity onPress={() => navigation.navigate("Profile", { username: post.username })}>
                <Text style={[styles.username, { color: t.text }]}>@{post.username}</Text>
              </TouchableOpacity>
              <Text style={[styles.timestamp, { color: t.textSecondary }]}>· {timeAgo(post.created_at)}</Text>
            </View>
          </View>
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

        {/* Content */}
        <Text style={[styles.postContent, { color: t.text }]}>
          {parseContent(post.showTranslation ? post.translatedText : post.content, { navigation, accentColor: t.accentBlue })}
        </Text>

        {/* Media */}
        {post.media_url && (
          <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
        )}

        {/* GIF */}
        {post.gif_url && !post.media_url && (
          <View style={styles.gifPostWrap}>
            <Image source={{ uri: post.gif_url }} style={styles.postMedia} resizeMode="cover" />
            <View style={styles.gifPostBadge}>
              <Text style={styles.gifBadgeText}>GIF</Text>
            </View>
          </View>
        )}

        {/* Translate */}
        <TouchableOpacity onPress={() => handleTranslate(post._id, post.content)} style={{ marginBottom: 8 }}>
          <Text style={{ color: t.accentBlue, fontSize: 13, fontWeight: "500" }}>
            {post.showTranslation ? "See Original" : "Translate Post"}
          </Text>
        </TouchableOpacity>

        {/* Entity tags */}
        {post.entities && post.entities.length > 0 && (
          <View style={styles.entityRow}>
            {post.entities.slice(0, 5).map((ent, idx) => {
              const isMention = ent.source === "mention" || ent.text.startsWith("@");
              const isHashtag = ent.source === "hashtag" || ent.text.startsWith("#");
              let tagBg = t.tagBg;
              let tagColor = t.tagText;
              if (isMention) { tagBg = t.mentionTagBg; tagColor = t.mentionTagText; }
              else if (isHashtag) { tagBg = t.hashtagTagBg; tagColor = t.hashtagTagText; }
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.entityTag, { backgroundColor: tagBg }]}
                  onPress={() => {
                    if (isMention) {
                      navigation.navigate("Profile", { username: ent.text.replace("@", "") });
                    } else {
                      navigation.navigate("EntityExplore", { entityText: ent.identified_as || ent.text.replace("#", "") });
                    }
                  }}
                >
                  <Text style={[styles.entityTagText, { color: tagColor }]}>{ent.text}</Text>
                  {ent.label ? (
                    <Text style={{ color: t.textSecondary, fontSize: 10, marginLeft: 3 }}>{ent.label}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Action bar */}
        <View style={[styles.actionBar, { borderTopColor: t.border }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(post._id)}>
            <Ionicons
              name={post.is_liked_by_user ? "heart" : "heart-outline"}
              size={22}
              color={post.is_liked_by_user ? "#f91880" : t.textSecondary}
            />
            <Text style={[styles.actionCount, { color: t.textSecondary }]}>{post.likes || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("PostDetail", { postId: post._id })}>
            <Ionicons name="chatbubble-outline" size={20} color={t.accentBlue} />
            <Text style={[styles.actionCount, { color: t.textSecondary }]}>{post.comment_count || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setRepostMenuPostId(post._id)}>
            <Ionicons
              name={post.is_reposted_by_user ? "repeat" : "repeat-outline"}
              size={22}
              color={post.is_reposted_by_user ? "#00ba7c" : t.textSecondary}
            />
            <Text style={[styles.actionCount, { color: post.is_reposted_by_user ? "#00ba7c" : t.textSecondary }]}>
              {post.repost_count || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => handleBookmark(post._id)}>
            <Ionicons
              name={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
              size={20}
              color={post.is_bookmarked ? t.accentBlue : t.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRepost = ({ item: repost }) => {
    const orig = repost.original_post || {};
    return (
      <View style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        {/* Repost label */}
        <View style={styles.repostLabel}>
          <Ionicons name="repeat" size={14} color="#00ba7c" />
          <Text style={[styles.repostLabelText, { color: "#00ba7c" }]}>@{repost.username} reposted</Text>
        </View>

        {/* Quote content */}
        {repost.is_quote && repost.quote_content ? (
          <Text style={[styles.postContent, { color: t.text }]}>{repost.quote_content}</Text>
        ) : null}

        {/* Embedded original post */}
        <TouchableOpacity
          style={[styles.quotedPostCard, { borderColor: t.border }]}
          onPress={() => navigation.navigate("PostDetail", { postId: orig._id || repost.post_id })}
          activeOpacity={0.8}
        >
          <View style={styles.postHeader}>
            <View style={[styles.avatar, { backgroundColor: t.avatarBg, width: 30, height: 30, borderRadius: 15 }]}>
              {orig.profile_pic_url ? (
                <Image source={{ uri: orig.profile_pic_url }} style={{ width: 30, height: 30, borderRadius: 15 }} />
              ) : (
                <Text style={[styles.avatarText, { fontSize: 13 }]}>{(orig.username || "?")[0].toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.postMeta}>
              <View style={styles.usernameRow}>
                <Text style={[styles.username, { color: t.text, fontSize: 13 }]}>@{orig.username || "unknown"}</Text>
                <Text style={[styles.timestamp, { color: t.textSecondary }]}>· {timeAgo(orig.created_at || repost.created_at)}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.postContent, { color: t.text, fontSize: 14 }]} numberOfLines={4}>
            {parseContent(orig.content || "", { navigation, accentColor: t.accentBlue })}
          </Text>
          {orig.media_url ? (
            <Image source={{ uri: orig.media_url }} style={[styles.postMedia, { height: 150 }]} resizeMode="cover" />
          ) : null}
        </TouchableOpacity>

        {/* Timestamp */}
        <Text style={[styles.timestamp, { color: t.textSecondary, marginTop: 6 }]}>{timeAgo(repost.created_at)}</Text>
      </View>
    );
  };

  const ProfileHeader = () => (
    <View>
      {/* Cover gradient */}
      <View style={[styles.coverGradient, { backgroundColor: t.accentBlue }]} />

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarLarge, { backgroundColor: t.avatarBg }]}>
          {profile.profile_pic_url ? (
            <Image source={{ uri: profile.profile_pic_url }} style={styles.avatarLargeImg} />
          ) : (
            <Text style={styles.avatarLargeText}>
              {(profile.username || "?")[0].toUpperCase()}
            </Text>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoSection}>
        <Text style={[styles.profileName, { color: t.text }]}>@{profile.username}</Text>
        {profile.bio ? (
          <Text style={[styles.bio, { color: t.textSecondary }]}>{profile.bio}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View>
            <Text style={[styles.statText, { color: t.text }]}>
              <Text style={styles.statNumber}>{profile.stats?.posts ?? 0}</Text> Posts
            </Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("FollowList", {
                username: profile.username,
                userId: profile.user_id,
                tab: "followers",
              })
            }
          >
            <Text style={[styles.statText, { color: t.text }]}>
              <Text style={styles.statNumber}>{profile.stats?.followers ?? 0}</Text> Followers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("FollowList", {
                username: profile.username,
                userId: profile.user_id,
                tab: "following",
              })
            }
          >
            <Text style={[styles.statText, { color: t.text }]}>
              <Text style={styles.statNumber}>{profile.stats?.following ?? 0}</Text> Following
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action button */}
        {isOwnProfile ? (
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: t.border }]}
            onPress={openEdit}
          >
            <Text style={{ color: t.text, fontWeight: "600" }}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.followBtn,
                { backgroundColor: t.accentBlue },
                profile.is_followed_by_user && { backgroundColor: "transparent", borderColor: t.border, borderWidth: 1 },
              ]}
              onPress={handleFollowToggle}
            >
              <Text
                style={{
                  color: profile.is_followed_by_user ? t.text : "#fff",
                  fontWeight: "700",
                }}
              >
                {profile.is_followed_by_user ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.followBtn, { backgroundColor: "transparent", borderColor: t.border, borderWidth: 1 }]}
              onPress={() => navigation.navigate("Chat", { conversationId: null, otherUser: { user_id: profile.user_id, username: profile.username, profile_pic_url: profile.profile_pic_url } })}
            >
              <Ionicons name="chatbubble-outline" size={16} color={t.text} style={{ marginRight: 4 }} />
              <Text style={{ color: t.text, fontWeight: "700" }}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderColor: t.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "posts" && styles.tabActive, activeTab === "posts" && { borderBottomColor: t.accentBlue }]}
          onPress={() => setActiveTab("posts")}
        >
          <Text style={[styles.tabText, { color: activeTab === "posts" ? t.text : t.textSecondary }]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "reposts" && styles.tabActive, activeTab === "reposts" && { borderBottomColor: t.accentBlue }]}
          onPress={() => setActiveTab("reposts")}
        >
          <Text style={[styles.tabText, { color: activeTab === "reposts" ? t.text : t.textSecondary }]}>Reposts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Nav */}
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Feed")} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.text }]}>@{profile.username}</Text>
        {isOwnProfile ? (
          <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={26} color={t.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <FlatList
        data={activeTab === "posts" ? posts : reposts}
        keyExtractor={(item) => item._id}
        renderItem={activeTab === "posts" ? renderPost : renderRepost}
        ListHeaderComponent={ProfileHeader}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
        }
        ListEmptyComponent={
          (activeTab === "posts" ? isLoadingPosts : isLoadingReposts) ? (
            <ActivityIndicator size="large" color={t.accentBlue} style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name={activeTab === "posts" ? "document-text-outline" : "repeat-outline"} size={40} color={t.textSecondary} />
              <Text style={{ color: t.textSecondary, marginTop: 8 }}>
                {activeTab === "posts" ? "No posts yet" : "No reposts yet"}
              </Text>
            </View>
          )
        }
      />

      {/* ─── Edit Profile Modal ─── */}
      {isEditing && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.cardBg }]}>
            <Text style={[styles.modalTitle, { color: t.text }]}>Edit Profile</Text>

            <TouchableOpacity onPress={pickImage} style={styles.pickImageBtn}>
              {editPicture ? (
                <Image source={{ uri: editPicture.uri }} style={styles.pickImagePreview} />
              ) : profile.profile_pic_url ? (
                <Image source={{ uri: profile.profile_pic_url }} style={styles.pickImagePreview} />
              ) : (
                <Ionicons name="camera" size={32} color={t.textSecondary} />
              )}
              <Text style={{ color: t.accentBlue, marginTop: 6, fontSize: 13 }}>Change Photo</Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.modalInput, { color: t.text, backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Username"
              placeholderTextColor={t.textSecondary}
            />
            <TextInput
              style={[styles.modalInput, styles.bioInput, { color: t.text, backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Bio"
              placeholderTextColor={t.textSecondary}
              multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: t.border }]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={{ color: t.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: t.accentBlue }]} onPress={saveProfile} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 3-dot menu modal */}
      <Modal
        visible={!!menuPostId}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuPostId(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuPostId(null)}>
          <View style={[styles.menuSheet, { backgroundColor: t.cardBg }]}>
            <TouchableOpacity
              style={styles.menuSheetItem}
              onPress={() => handleDelete(menuPostId)}
            >
              <Ionicons name="trash-outline" size={20} color={t.riskText} />
              <Text style={[styles.menuSheetText, { color: t.riskText }]}>Delete Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuSheetItem, { borderBottomWidth: 0 }]}
              onPress={() => setMenuPostId(null)}
            >
              <Ionicons name="close" size={20} color={t.textSecondary} />
              <Text style={[styles.menuSheetText, { color: t.textSecondary }]}>Cancel</Text>
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
              <Text style={[styles.menuSheetText, { color: t.text }]}>Quote Repost</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuSheetItem, { borderBottomWidth: 0 }]}
              onPress={() => setRepostMenuPostId(null)}
            >
              <Ionicons name="close" size={20} color={t.textSecondary} />
              <Text style={[styles.menuSheetText, { color: t.textSecondary }]}>Cancel</Text>
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
              maxLength={500}
            />
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
              style={[styles.quoteSubmitBtn, { backgroundColor: "#00ba7c", opacity: quoteContent.trim() ? 1 : 0.5 }]}
              onPress={submitQuoteRepost}
              disabled={!quoteContent.trim() || isQuoting}
            >
              <Text style={styles.quoteSubmitText}>{isQuoting ? "Posting..." : "Post"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Sidebar Drawer ─── */}
      {showSidebar && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.sidebarBackdrop} onPress={closeSidebar} />
          <Animated.View style={[styles.sidebarContainer, { backgroundColor: t.cardBg, transform: [{ translateX: sidebarAnim }] }]}>
            {/* Sidebar header */}
            <View style={styles.sidebarHeader}>
              <View style={[styles.sidebarAvatar, { backgroundColor: t.avatarBg }]}>
                {profile?.profile_pic_url ? (
                  <Image source={{ uri: profile.profile_pic_url }} style={styles.sidebarAvatarImg} />
                ) : (
                  <Text style={styles.sidebarAvatarText}>{(profile?.username || "?")[0].toUpperCase()}</Text>
                )}
              </View>
              <Text style={[styles.sidebarName, { color: t.text }]}>@{profile?.username}</Text>
              <TouchableOpacity onPress={closeSidebar} style={styles.sidebarClose}>
                <Ionicons name="close" size={24} color={t.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.sidebarDivider, { backgroundColor: t.border }]} />

            {/* Sidebar items */}
            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => { closeSidebar(); navigation.navigate("Bookmarks"); }}
            >
              <Ionicons name="bookmark-outline" size={22} color={t.text} />
              <Text style={[styles.sidebarItemText, { color: t.text }]}>Bookmarks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => { closeSidebar(); navigation.navigate("Settings"); }}
            >
              <Ionicons name="settings-outline" size={22} color={t.text} />
              <Text style={[styles.sidebarItemText, { color: t.text }]}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={toggleDarkMode}
            >
              <Ionicons name={darkMode ? "sunny-outline" : "moon-outline"} size={22} color={t.text} />
              <Text style={[styles.sidebarItemText, { color: t.text }]}>{darkMode ? "Light Mode" : "Dark Mode"}</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />
            <View style={[styles.sidebarDivider, { backgroundColor: t.border }]} />
            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => {
                closeSidebar();
                Alert.alert("Logout", "Are you sure you want to logout?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Logout", style: "destructive", onPress: logout },
                ]);
              }}
            >
              <Ionicons name="log-out-outline" size={22} color={t.riskText} />
              <Text style={[styles.sidebarItemText, { color: t.riskText }]}>Logout</Text>
            </TouchableOpacity>
            <View style={{ height: 30 }} />
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 17, fontWeight: "700" },

  coverGradient: {
    height: 120,
  },
  avatarContainer: { alignItems: "center", marginTop: -40 },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    overflow: "hidden",
  },
  avatarLargeImg: { width: 80, height: 80, borderRadius: 40 },
  avatarLargeText: { fontSize: 28, fontWeight: "700", color: "#fff" },

  infoSection: { alignItems: "center", paddingHorizontal: 20, paddingTop: 12 },
  profileName: { fontSize: 20, fontWeight: "800" },
  bio: { fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 24, marginTop: 14 },
  statText: { fontSize: 14 },
  statNumber: { fontWeight: "800" },

  editBtn: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  settingsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 20,
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9999,
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  followBtn: {
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 14,
  },

  postsHeader: { borderBottomWidth: 1, paddingVertical: 14, paddingHorizontal: 16, marginTop: 16 },
  postsHeaderText: { fontSize: 16, fontWeight: "700" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginTop: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 15, fontWeight: "700" },

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
  menuBtn: { padding: 10 },
  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  postMedia: { width: "100%", height: 200, borderRadius: 12, marginBottom: 8 },
  gifPostWrap: { position: "relative", marginBottom: 8 },
  gifPostBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gifBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
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

  emptyWrap: { alignItems: "center", marginTop: 40 },

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

  // Repost card
  repostLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  repostLabelText: { fontSize: 13, fontWeight: "600" },
  quotedPostCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 4 },

  // Quote repost modal
  quoteOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  quoteSheet: { width: "90%", borderRadius: 16, padding: 20 },
  quoteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  quoteTitle: { fontSize: 18, fontWeight: "700" },
  quoteInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: "top", marginBottom: 12 },
  quotePreview: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  quotePreviewUser: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  quotePreviewText: { fontSize: 13 },
  quoteSubmitBtn: { borderRadius: 20, paddingVertical: 12, alignItems: "center" },
  quoteSubmitText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Edit Profile Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  pickImageBtn: { alignItems: "center", marginBottom: 16 },
  pickImagePreview: { width: 72, height: 72, borderRadius: 36 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  bioInput: { minHeight: 80, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSaveBtn: {
    flex: 1,
    borderRadius: 9999,
    paddingVertical: 12,
    alignItems: "center",
  },

  // Sidebar drawer
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sidebarContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: Dimensions.get("window").width * 0.72,
    paddingTop: 60,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sidebarAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  sidebarAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  sidebarAvatarText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  sidebarName: { fontSize: 16, fontWeight: "700", marginLeft: 12, flex: 1 },
  sidebarClose: { padding: 4 },
  sidebarDivider: { height: 1, marginVertical: 8 },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  sidebarItemText: { fontSize: 16, fontWeight: "600" },
});
