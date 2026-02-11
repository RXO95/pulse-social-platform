import React, { useEffect, useState, useCallback } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuPostId, setMenuPostId] = useState(null);

  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  // ─── Fetch Data ───
  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/users/me");
      setCurrentUser(res.data);
    } catch {}
  };

  const fetchPosts = async (showLoader = true) => {
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
      Alert.alert("Error", "Failed to load feed");
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
  }, []);

  // ─── Actions ───
  const handlePost = async () => {
    if (!content.trim()) return;
    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      await api.post("/posts/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setContent("");
      fetchPosts(false);
    } catch {
      Alert.alert("Error", "Failed to create post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId) => {
    const post = posts.find((p) => p._id === postId);
    if (!post) return;
    const wasLiked = post.is_liked_by_user;

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
    try {
      const res = await api.post(`/bookmarks/${postId}`);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, is_bookmarked: res.data.bookmarked } : p
        )
      );
    } catch {}
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchPosts(false);
      return;
    }
    try {
      const res = await api.get(`/search/?q=${encodeURIComponent(query)}`);
      setPosts(res.data.results || []);
    } catch {
      Alert.alert("Error", "Search failed");
    }
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
            Alert.alert("Error", "Failed to delete post");
          }
        },
      },
    ]);
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
      Alert.alert("Error", "Translation failed");
    }
  };

  // ─── Render Post Card ───
  const renderPost = ({ item: post }) => {
    const isMine = currentUser && post.username === currentUser.username;
    const isOtherUser = currentUser && post.username !== currentUser.username;

    return (
      <TouchableOpacity
        style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("PostDetail", { postId: post._id })}
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

        {/* Content */}
        <Text style={[styles.postContent, { color: t.text }]}>
          {post.showTranslation ? post.translatedText : post.content}
        </Text>

        {/* Media */}
        {post.media_url && (
          <Image
            source={{ uri: post.media_url }}
            style={styles.postMedia}
            resizeMode="cover"
          />
        )}

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
            onPress={() => handleBookmark(post._id)}
          >
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
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.postButton, !content.trim() && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={!content.trim() || isPosting}
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
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Nav Header */}
      <View
        style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}
      >
        <Text style={[styles.navTitle, { color: t.text }]}>Pulse</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={t.accentBlue} />
        </View>
      ) : (
        <FlatList
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

      {/* 3-dot menu bottom sheet */}
      <Modal
        visible={!!menuPostId}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPostId(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuPostId(null)}>
          <View style={[styles.menuSheet, { backgroundColor: t.cardBg }]}>
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
  postButton: {
    backgroundColor: "#1d9bf0",
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
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: "flex-start",
    marginTop: 3,
  },
  menuBtn: { padding: 6 },

  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  postMedia: { width: "100%", height: 200, borderRadius: 12, marginBottom: 8 },
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
    borderColor: "rgba(128,128,128,0.2)",
  },
  menuSheetText: { fontSize: 16, fontWeight: "600" },
});
