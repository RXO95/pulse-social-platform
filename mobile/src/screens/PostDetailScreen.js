import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";

export default function PostDetailScreen({ navigation, route }) {
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRegeneratingContext, setIsRegeneratingContext] = useState(false);

  // Translation state
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  const fetchPost = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/posts/${postId}`);
      setPost(res.data);
    } catch {
      Alert.alert("Error", "Post not found");
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/comments/${postId}`);
      setComments(res.data);
    } catch {}
  };

  const handleLike = async () => {
    if (!post) return;
    const wasLiked = post.is_liked_by_user;
    setPost((p) => ({
      ...p,
      is_liked_by_user: !wasLiked,
      likes: wasLiked ? p.likes - 1 : p.likes + 1,
    }));
    try {
      const res = await api.post(`/likes/${postId}`);
      setPost((p) => ({ ...p, is_liked_by_user: res.data.liked, likes: res.data.likes }));
    } catch {
      setPost((p) => ({ ...p, is_liked_by_user: wasLiked, likes: post.likes }));
    }
  };

  const handleBookmark = async () => {
    if (!post) return;
    try {
      const res = await api.post(`/bookmarks/${postId}`);
      setPost((p) => ({ ...p, is_bookmarked: res.data.bookmarked }));
    } catch {}
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/comments/${postId}`, { content: newComment });
      setNewComment("");
      fetchComments();
    } catch {
      Alert.alert("Error", "Failed to add comment");
    }
  };

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }
    try {
      const res = await api.post("/translate/", {
        text: post.content,
        target_lang: "en",
      });
      setTranslatedText(res.data.translated_text);
      setShowTranslation(true);
    } catch {
      Alert.alert("Error", "Translation failed");
    }
  };

  const handleRegenerateContext = async () => {
    if (isRegeneratingContext) return;
    setIsRegeneratingContext(true);
    try {
      const res = await api.post(`/posts/${postId}/regenerate-context`);
      setPost((prev) => ({
        ...prev,
        context_data: res.data.context_data,
      }));
    } catch {
      Alert.alert("Error", "Failed to regenerate context");
    } finally {
      setIsRegeneratingContext(false);
    }
  };

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [postId]);

  if (isLoading || !post) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accentBlue} />
      </View>
    );
  }

  // ─── Pulse Context Box ───
  const renderContextBox = () => {
    const ctx = post.context_data;
    const hasContext = ctx && ctx.is_generated;
    const hasEntities = post.entities && post.entities.length > 0;

    // Show generate button if no context but has entities
    if (!hasContext && hasEntities) {
      return (
        <View style={[styles.contextBox, { backgroundColor: t.contextBg, borderColor: t.contextBorder }]}>
          <View style={[styles.contextHeader, { borderBottomColor: t.contextBorder }]}>
            <Ionicons name="information-circle" size={18} color={t.text} />
            <Text style={[styles.contextHeaderText, { color: t.text }]}>Pulse Context</Text>
          </View>
          <Text style={{ color: t.textSecondary, fontSize: 14, marginVertical: 8 }}>
            Generate Wikipedia info and related news for:
          </Text>
          <View style={styles.contextEntityWrap}>
            {post.entities.map((ent, idx) => (
              <View key={idx} style={[styles.contextEntityTag, { backgroundColor: t.tagBg }]}>
                <Text style={{ color: t.tagText, fontSize: 13, fontWeight: "500" }}>{ent.text}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: t.accentBlue }]}
            onPress={handleRegenerateContext}
            disabled={isRegeneratingContext}
          >
            {isRegeneratingContext ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.generateBtnText}>Generate Pulse Context</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (!hasContext) return null;

    return (
      <View style={[styles.contextBox, { backgroundColor: t.contextBg, borderColor: t.contextBorder }]}>
        {/* Header */}
        <View style={[styles.contextHeader, { borderBottomColor: t.contextBorder }]}>
          <Ionicons name="information-circle" size={18} color={t.text} />
          <Text style={[styles.contextHeaderText, { color: t.text }]}>Pulse Context</Text>
          <TouchableOpacity
            onPress={handleRegenerateContext}
            disabled={isRegeneratingContext}
            style={styles.refreshBtn}
          >
            {isRegeneratingContext ? (
              <ActivityIndicator size="small" color={t.accentBlue} />
            ) : (
              <Ionicons name="refresh" size={16} color={t.accentBlue} />
            )}
          </TouchableOpacity>
        </View>

        {/* Disambiguation Section */}
        {ctx.disambiguation && ctx.disambiguation.length > 0 && (
          <View style={styles.contextSection}>
            <Text style={[styles.contextLabel, { color: t.textSecondary }]}>
              ENTITY CLARIFICATION:
            </Text>
            {ctx.disambiguation.map((item, idx) => (
              <View key={idx} style={styles.disambigItem}>
                <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>
                  <Text style={{ fontWeight: "700" }}>{item.entity}</Text>
                  {" is identified as "}
                  <Text style={{ fontWeight: "700" }}>{item.identified_as}</Text>
                </Text>
                {item.description ? (
                  <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* News Section */}
        {ctx.news && (
          <View style={styles.contextSection}>
            <Text style={[styles.contextLabel, { color: t.textSecondary }]}>
              RELATED CONTEXT:
            </Text>
            <TouchableOpacity
              style={[styles.newsCard, { backgroundColor: t.newsBg, borderColor: t.border }]}
              onPress={() => {
                if (ctx.news.url) Linking.openURL(ctx.news.url);
              }}
            >
              <Text style={{ color: t.accentBlue, fontWeight: "600", fontSize: 14, lineHeight: 20 }}>
                {ctx.news.headline}
              </Text>
              <Text style={{ color: t.textSecondary, fontSize: 11, marginTop: 4 }}>
                Source: Google News
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderComment = ({ item }) => (
    <View style={[styles.commentCard, { borderColor: t.border }]}>
      <View style={[styles.commentAvatar, { backgroundColor: t.avatarBg }]}>
        <Text style={styles.commentAvatarText}>
          {(item.username || "?")[0].toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={styles.commentHeader}>
          <Text style={[styles.commentUser, { color: t.text }]}>@{item.username}</Text>
          <Text style={{ color: t.textSecondary, fontSize: 12 }}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
        <Text style={[styles.commentContent, { color: t.text }]}>{item.content}</Text>
      </View>
    </View>
  );

  const PostHeader = () => (
    <View style={[styles.postSection, { backgroundColor: t.cardBg, borderColor: t.border }]}>
      {/* Author */}
      <TouchableOpacity
        style={styles.authorRow}
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
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.username, { color: t.text }]}>@{post.username}</Text>
          <Text style={{ color: t.textSecondary, fontSize: 12 }}>
            {timeAgo(post.created_at)}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Content */}
      <Text style={[styles.postContent, { color: t.text }]}>
        {showTranslation ? translatedText : post.content}
      </Text>

      {post.media_url && (
        <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
      )}

      {/* Translate button */}
      <TouchableOpacity onPress={handleTranslate} style={{ marginBottom: 12 }}>
        <Text style={{ color: t.accentBlue, fontSize: 13, fontWeight: "500" }}>
          {showTranslation ? "See Original" : "Translate Post"}
        </Text>
      </TouchableOpacity>

      {/* Entities */}
      {post.entities && post.entities.length > 0 && (
        <View style={styles.entityRow}>
          {post.entities.map((ent, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.entityTag, { backgroundColor: t.tagBg }]}
              onPress={() => navigation.navigate("EntityExplore", { entityText: ent.text })}
            >
              <Text style={[styles.entityTagText, { color: t.tagText }]}>{ent.text}</Text>
              {ent.label ? (
                <Text style={{ color: t.textSecondary, fontSize: 10, marginLeft: 3 }}>{ent.label}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Pulse Context Box */}
      {renderContextBox()}

      {/* Actions */}
      <View style={[styles.actionBar, { borderTopColor: t.border }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Ionicons
            name={post.is_liked_by_user ? "heart" : "heart-outline"}
            size={24}
            color={post.is_liked_by_user ? "#f91880" : t.textSecondary}
          />
          <Text style={[styles.actionCount, { color: t.textSecondary }]}>
            {post.likes || 0}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={22} color={t.accentBlue} />
          <Text style={[styles.actionCount, { color: t.textSecondary }]}>
            {comments.length}
          </Text>
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark}>
          <Ionicons
            name={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
            size={22}
            color={post.is_bookmarked ? t.accentBlue : t.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Timestamp */}
      <View style={[styles.timestampFull, { borderTopColor: t.border }]}>
        <Text style={{ color: t.textSecondary, fontSize: 12 }}>
          {new Date(post.created_at).toLocaleString()}
        </Text>
      </View>

      {/* Comments Header */}
      <View style={[styles.commentsHeader, { borderColor: t.border }]}>
        <Text style={[styles.commentsTitle, { color: t.text }]}>
          Comments ({comments.length})
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Nav */}
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.text }]}>Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderComment}
          ListHeaderComponent={PostHeader}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ color: t.textSecondary }}>No comments yet. Be the first!</Text>
            </View>
          }
        />

        {/* Comment Input */}
        <View style={[styles.commentInputBar, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          <TextInput
            style={[styles.commentInput, { color: t.text, backgroundColor: t.inputBg }]}
            placeholder="Add a comment…"
            placeholderTextColor={t.textSecondary}
            value={newComment}
            onChangeText={setNewComment}
          />
          <TouchableOpacity onPress={submitComment} disabled={!newComment.trim()}>
            <Ionicons
              name="send"
              size={22}
              color={newComment.trim() ? t.accentBlue : t.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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

  postSection: { padding: 16, borderBottomWidth: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  username: { fontWeight: "700", fontSize: 16 },

  postContent: { fontSize: 17, lineHeight: 26, marginBottom: 10 },
  postMedia: { width: "100%", height: 220, borderRadius: 12, marginBottom: 10 },

  entityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  entityTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  entityTagText: { fontSize: 13, fontWeight: "600" },

  // ─── Context Box ───
  contextBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  contextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  contextHeaderText: { fontSize: 15, fontWeight: "700", flex: 1 },
  refreshBtn: {
    padding: 4,
  },
  contextSection: { marginBottom: 12 },
  contextLabel: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  disambigItem: {
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(29,155,240,0.3)",
  },
  contextEntityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  contextEntityTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  newsCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  generateBtn: {
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  generateBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  // ─── Actions ───
  actionBar: {
    flexDirection: "row",
    gap: 28,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 0.5,
    marginBottom: 4,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14, fontWeight: "600" },
  timestampFull: {
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 0.5,
  },

  commentsHeader: { borderTopWidth: 1, paddingTop: 14, marginTop: 12 },
  commentsTitle: { fontSize: 16, fontWeight: "700" },

  commentCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentUser: { fontWeight: "600", fontSize: 14 },
  commentContent: { fontSize: 14, lineHeight: 20 },

  emptyWrap: { alignItems: "center", marginTop: 30 },

  commentInputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
});
