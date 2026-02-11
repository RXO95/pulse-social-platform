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
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
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

  const { logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
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

    // Optimistic update
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
      // revert
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
    Alert.alert("Delete Post", "Are you sure?", [
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

  // ─── Render Post Card ───
  const renderPost = ({ item: post }) => (
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
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile", { username: post.username })}
          >
            <Text style={[styles.username, { color: t.text }]}>
              @{post.username}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.timestamp, { color: t.textSecondary }]}>
            {timeAgo(post.created_at)}
          </Text>
        </View>

        {currentUser && post.username === currentUser.username && (
          <TouchableOpacity
            onPress={() => handleDelete(post._id)}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={18} color={t.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <Text style={[styles.postContent, { color: t.text }]}>{post.content}</Text>

      {/* Media */}
      {post.media_url && (
        <Image
          source={{ uri: post.media_url }}
          style={styles.postMedia}
          resizeMode="cover"
        />
      )}

      {/* Entity tags */}
      {post.entities && post.entities.length > 0 && (
        <View style={styles.entityRow}>
          {post.entities.slice(0, 5).map((ent, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.entityTag, { backgroundColor: t.tagBg }]}
              onPress={() =>
                navigation.navigate("EntityExplore", { entityText: ent.text })
              }
            >
              <Text style={[styles.entityTagText, { color: t.tagText }]}>
                {ent.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Action bar */}
      <View style={styles.actionBar}>
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
          onPress={() => navigation.navigate("PostDetail", { postId: post._id })}
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

  // ─── Compose Header ───
  const ListHeader = () => (
    <View>
      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
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
      <View style={[styles.composeCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        <TextInput
          style={[styles.composeInput, { color: t.text, backgroundColor: t.inputBg }]}
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
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <Text style={[styles.navTitle, { color: t.text }]}>Pulse</Text>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={toggleDarkMode} style={styles.iconBtn}>
            <Ionicons
              name={darkMode ? "sunny" : "moon"}
              size={22}
              color={t.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={22} color={t.textSecondary} />
          </TouchableOpacity>
        </View>
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color={t.textSecondary} />
              <Text style={[styles.emptyText, { color: t.textSecondary }]}>
                No posts yet. Be the first!
              </Text>
            </View>
          }
        />
      )}
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
  navRight: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 4 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
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
    backgroundColor: "#0f1419",
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
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
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
  username: { fontWeight: "700", fontSize: 15 },
  timestamp: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 6 },

  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  postMedia: { width: "100%", height: 200, borderRadius: 12, marginBottom: 8 },

  entityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  entityTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  entityTagText: { fontSize: 12, fontWeight: "600" },

  actionBar: { flexDirection: "row", gap: 20, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionCount: { fontSize: 13, fontWeight: "600" },

  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyWrap: { alignItems: "center", marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 15 },
});
