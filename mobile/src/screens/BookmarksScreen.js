import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import * as Haptics from "expo-haptics";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";
import { parseContent } from "../utils/parseContent";

export default function BookmarksScreen({ navigation }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { darkMode, accentColor } = useTheme();
  const t = getTheme(darkMode, accentColor);
  const toast = useToast();

  const fetchBookmarks = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/bookmarks/");
      setBookmarks(res.data.bookmarks || []);
    } catch {
      toast("Could not load bookmarks", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookmarks();
    setRefreshing(false);
  }, []);

  const handleRemoveBookmark = async (postId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.post(`/bookmarks/${postId}`);
      setBookmarks((prev) => prev.filter((b) => b._id !== postId));
    } catch {
      toast("Could not remove bookmark", "error");
    }
  };

  const handleLike = async (postId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await api.post(`/likes/${postId}`);
      setBookmarks((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, is_liked_by_user: res.data.liked, likes: res.data.likes }
            : p
        )
      );
    } catch {
      toast("Could not update like", "error");
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const renderBookmark = ({ item: post }) => (
    <TouchableOpacity
      style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
      onPress={() => navigation.navigate("PostDetail", { postId: post._id })}
      activeOpacity={0.8}
    >
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
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.username, { color: t.text }]}>@{post.username}</Text>
          <Text style={{ color: t.textSecondary, fontSize: 12 }}>
            {timeAgo(post.created_at)}
          </Text>
        </View>
      </View>

      <Text style={[styles.postContent, { color: t.text }]}>{parseContent(post.content, { navigation, accentColor: t.accentBlue })}</Text>

      {post.media_url && (
        <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
      )}

      {/* Entity Tags */}
      {post.entities?.length > 0 && (
        <View style={styles.entityRow}>
          {post.entities.map((e, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.entityTag, { backgroundColor: t.tagBg }]}
              onPress={() => navigation.navigate("EntityExplore", { entityText: e.text })}
            >
              <Text style={[styles.entityTagText, { color: t.tagText }]}>{e.text} <Text style={{ fontSize: 10, color: t.textSecondary }}>{e.label}</Text></Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(post._id)}>
          <Ionicons
            name={post.is_liked_by_user ? "heart" : "heart-outline"}
            size={20}
            color={post.is_liked_by_user ? "#f91880" : t.textSecondary}
          />
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>{post.likes || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("PostDetail", { postId: post._id })}>
          <Ionicons name="chatbubble-outline" size={19} color={t.textSecondary} />
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>{post.comment_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemoveBookmark(post._id)}>
          <Ionicons name="bookmark" size={20} color={t.accentBlue} />
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>Remove</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <Text style={[styles.navTitle, { color: t.text }]}>Bookmarks</Text>
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={t.accentBlue} />
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item._id}
          renderItem={renderBookmark}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="bookmark-outline" size={48} color={t.textSecondary} />
              <Text style={{ color: t.textSecondary, marginTop: 12, fontSize: 15 }}>
                No bookmarks yet
              </Text>
              <TouchableOpacity
                style={{ marginTop: 20, backgroundColor: t.accentBlue, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 9999 }}
                onPress={() => navigation.navigate("Feed")}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Browse Feed</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 22, fontWeight: "800" },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  username: { fontWeight: "700", fontSize: 15 },
  postContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  postMedia: { width: "100%", height: 180, borderRadius: 12, marginBottom: 8 },
  actionBar: { flexDirection: "row", gap: 20, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  entityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 4 },
  entityTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
  entityTagText: { fontSize: 13, fontWeight: "500" },
  emptyWrap: { alignItems: "center", marginTop: 60 },
});
