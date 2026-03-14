import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  RefreshControl,
  Alert,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import * as Haptics from "expo-haptics";
import GifPicker from "../components/GifPicker";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";
import { parseContent } from "../utils/parseContent";

const SCREEN_WIDTH = Dimensions.get("window").width;

const AutoGif = ({ uri, style }) => {
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    if (uri) {
      Image.getSize(
        uri,
        (w, h) => { if (w && h) setRatio(w / h); },
        () => {}
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

export default function PostDetailScreen({ navigation, route }) {
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentGif, setCommentGif] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegeneratingContext, setIsRegeneratingContext] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Translation state
  const [translatedText, setTranslatedText] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);

  // Repost menu / quote repost state
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteContent, setQuoteContent] = useState("");
  const [isQuoting, setIsQuoting] = useState(false);

  const { darkMode, accentColor } = useTheme();
  const t = getTheme(darkMode, accentColor);
  const toast = useToast();

  const fetchPost = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/posts/${postId}`);
      setPost(res.data);
    } catch {
      toast("Post not found", "error");
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        api.get(`/posts/${postId}`),
        api.get(`/comments/${postId}`),
      ]);
      setPost(postRes.data);
      setComments(commentsRes.data);
    } catch {
      toast("Could not refresh", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/comments/${postId}`);
      setComments(res.data);
    } catch {
      toast("Could not load comments", "error");
    }
  };

  const handleLike = async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await api.post(`/bookmarks/${postId}`);
      setPost((p) => ({ ...p, is_bookmarked: res.data.bookmarked }));
    } catch {
      toast("Bookmark failed", "error");
    }
  };

  const handleRepost = async () => {
    setShowRepostMenu(false);
    if (!post) return;
    const wasReposted = post.is_reposted_by_user;
    setPost((p) => ({
      ...p,
      is_reposted_by_user: !wasReposted,
      repost_count: wasReposted
        ? (p.repost_count || 1) - 1
        : (p.repost_count || 0) + 1,
    }));
    try {
      const res = await api.post(`/reposts/${postId}`);
      setPost((p) => ({
        ...p,
        is_reposted_by_user: res.data.reposted,
        repost_count: res.data.repost_count,
      }));
    } catch {
      setPost((p) => ({
        ...p,
        is_reposted_by_user: wasReposted,
        repost_count: post.repost_count || 0,
      }));
    }
  };

  const openQuoteRepost = () => {
    setShowRepostMenu(false);
    setQuoteContent("");
    setShowQuoteModal(true);
  };

  const submitQuoteRepost = async () => {
    if (!quoteContent.trim()) return;
    setIsQuoting(true);
    try {
      await api.post(`/reposts/${postId}/quote`, { content: quoteContent.trim() });
      setShowQuoteModal(false);
      setQuoteContent("");
      fetchPost();
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to quote repost", "error");
    } finally {
      setIsQuoting(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() && !commentGif) return;
    try {
      const body = { content: newComment };
      if (commentGif) body.gif_url = commentGif.url;
      await api.post(`/comments/${postId}`, body);
      setNewComment("");
      setCommentGif(null);
      fetchComments();
    } catch {
      toast("Failed to add comment", "error");
    }
  };

  const handleCommentGifSelect = (url, preview) => {
    setCommentGif({ url, preview });
  };

  // ─── Comment Like ───
  const handleCommentLike = async (commentId) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c._id !== commentId) return c;
        return {
          ...c,
          is_liked_by_user: !c.is_liked_by_user,
          likes: c.is_liked_by_user ? (c.likes || 1) - 1 : (c.likes || 0) + 1,
        };
      })
    );
    try {
      const res = await api.post(`/comments/${commentId}/like`);
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          return { ...c, is_liked_by_user: res.data.liked, likes: res.data.likes };
        })
      );
    } catch {
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          return {
            ...c,
            is_liked_by_user: !c.is_liked_by_user,
            likes: c.is_liked_by_user ? (c.likes || 1) - 1 : (c.likes || 0) + 1,
          };
        })
      );
    }
  };

  // ─── Comment Bookmark ───
  const handleCommentBookmark = async (commentId) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c._id !== commentId) return c;
        return { ...c, is_bookmarked_by_user: !c.is_bookmarked_by_user };
      })
    );
    try {
      const res = await api.post(`/comments/${commentId}/bookmark`);
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          return { ...c, is_bookmarked_by_user: res.data.bookmarked };
        })
      );
    } catch {
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          return { ...c, is_bookmarked_by_user: !c.is_bookmarked_by_user };
        })
      );
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
      toast("Translation failed", "error");
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
      toast("Failed to regenerate context", "error");
    } finally {
      setIsRegeneratingContext(false);
    }
  };

  const handleShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        message: `https://webpulse.social/post/${postId}`,
        url: `https://webpulse.social/post/${postId}`,
      });
    } catch { }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/users/me");
      setCurrentUser(res.data);
    } catch {}
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert("Delete Comment", "Delete this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/comments/${commentId}`);
            setComments((prev) => prev.filter((c) => c._id !== commentId));
          } catch {
            toast("Failed to delete comment", "error");
          }
        },
      },
    ]);
  };

  useEffect(() => {
    fetchPost();
    fetchComments();
    fetchCurrentUser();
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: t.textSecondary, fontSize: 12 }}>
              {timeAgo(item.created_at)}
            </Text>
            {currentUser && currentUser.username === item.username && (
              <TouchableOpacity onPress={() => handleDeleteComment(item._id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={14} color={t.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {item.content ? (
          <Text style={[styles.commentContent, { color: t.text }]}>{parseContent(item.content, { navigation, accentColor: t.accentBlue })}</Text>
        ) : null}
        {item.gif_url && (
          <View style={{ position: "relative", marginTop: 6 }}>
            <AutoGif uri={item.gif_url} style={styles.commentGifImg} />
            <View style={styles.commentGifBadge}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>GIF</Text>
            </View>
          </View>
        )}
        {/* Comment Action Buttons */}
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentActionBtn}
            onPress={() => handleCommentLike(item._id)}
          >
            <Ionicons
              name={item.is_liked_by_user ? "heart" : "heart-outline"}
              size={16}
              color={item.is_liked_by_user ? "#f91880" : t.textSecondary}
            />
            {(item.likes || 0) > 0 && (
              <Text style={[styles.commentActionCount, { color: item.is_liked_by_user ? "#f91880" : t.textSecondary }]}>
                {item.likes}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.commentActionBtn}
            onPress={() => setNewComment(`@${item.username} `)}
          >
            <Ionicons name="chatbubble-outline" size={15} color={t.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.commentActionBtn}
            onPress={() => handleCommentBookmark(item._id)}
          >
            <Ionicons
              name={item.is_bookmarked_by_user ? "bookmark" : "bookmark-outline"}
              size={16}
              color={item.is_bookmarked_by_user ? t.accentBlue : t.textSecondary}
            />
          </TouchableOpacity>
        </View>
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
        {parseContent(showTranslation ? translatedText : post.content, { navigation, accentColor: t.accentBlue })}
        {post.is_edited && (
          <Text style={{ fontSize: 12, fontStyle: "italic", color: t.textSecondary }}> (edited)</Text>
        )}
      </Text>

      {post.media_url && (
        <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
      )}

      {post.gif_url && !post.media_url && (
        <View style={{ position: "relative", marginBottom: 10 }}>
          <AutoGif uri={post.gif_url} style={styles.postMediaGif} />
          <View style={styles.gifPostBadge}>
            <Text style={styles.gifBadgeText}>GIF</Text>
          </View>
        </View>
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

        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowRepostMenu(true)}>
          <Ionicons
            name={post.is_reposted_by_user ? "repeat" : "repeat-outline"}
            size={22}
            color={post.is_reposted_by_user ? "#00ba7c" : t.textSecondary}
          />
          <Text style={[styles.actionCount, { color: post.is_reposted_by_user ? "#00ba7c" : t.textSecondary }]}>
            {post.repost_count || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark}>
          <Ionicons
            name={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
            size={22}
            color={post.is_bookmarked ? t.accentBlue : t.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={t.textSecondary} />
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
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accentBlue}
              colors={[t.accentBlue]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ color: t.textSecondary }}>No comments yet. Be the first!</Text>
            </View>
          }
        />

        {/* Comment Input */}
        <View style={[styles.commentInputBar, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          {commentGif && (
            <View style={styles.commentGifPreview}>
              <Image source={{ uri: commentGif.preview || commentGif.url }} style={styles.commentGifThumb} resizeMode="cover" />
              <TouchableOpacity style={styles.commentGifRemove} onPress={() => setCommentGif(null)}>
                <Ionicons name="close-circle" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TouchableOpacity onPress={() => setShowGifPicker(true)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: t.accentBlue, borderWidth: 1.5, borderColor: t.accentBlue, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: "hidden" }}>GIF</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.commentInput, { color: t.text, backgroundColor: t.inputBg }]}
              placeholder="Add a comment…"
              placeholderTextColor={t.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity onPress={submitComment} disabled={!newComment.trim() && !commentGif}>
              <Ionicons
                name="send"
                size={22}
                color={(newComment.trim() || commentGif) ? t.accentBlue : t.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* GIF Picker for comments */}
        <GifPicker
          visible={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          onSelect={handleCommentGifSelect}
          theme={t}
        />
      </KeyboardAvoidingView>

      {/* Repost menu bottom sheet */}
      <Modal visible={showRepostMenu} transparent animationType="slide" onRequestClose={() => setShowRepostMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowRepostMenu(false)}>
          <View style={[styles.menuSheet, { backgroundColor: t.cardBg }]}>
            <TouchableOpacity style={styles.menuSheetItem} onPress={handleRepost}>
              <Ionicons name="repeat" size={20} color="#00ba7c" />
              <Text style={[styles.menuSheetText, { color: t.text }]}>
                {post?.is_reposted_by_user ? "Undo Repost" : "Repost"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuSheetItem} onPress={openQuoteRepost}>
              <Ionicons name="create-outline" size={20} color="#00ba7c" />
              <Text style={[styles.menuSheetText, { color: t.text }]}>Quote Repost</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuSheetItem, { borderBottomWidth: 0 }]} onPress={() => setShowRepostMenu(false)}>
              <Ionicons name="close" size={20} color={t.textSecondary} />
              <Text style={[styles.menuSheetText, { color: t.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Quote repost modal */}
      <Modal visible={showQuoteModal} transparent animationType="slide" onRequestClose={() => setShowQuoteModal(false)}>
        <View style={[styles.quoteOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.quoteSheet, { backgroundColor: t.cardBg }]}>
            <View style={styles.quoteHeader}>
              <Text style={[styles.quoteTitle, { color: t.text }]}>Quote Repost</Text>
              <TouchableOpacity onPress={() => setShowQuoteModal(false)}>
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
            {post && (
              <View style={[styles.quotePreview, { borderColor: t.border }]}>
                <Text style={[styles.quotePreviewUser, { color: t.accent }]}>@{post.username}</Text>
                <Text style={[styles.quotePreviewText, { color: t.textSecondary }]} numberOfLines={3}>{parseContent(post.content, { navigation, accentColor: t.accentBlue })}</Text>
              </View>
            )}
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
  postMediaGif: { borderRadius: 12, marginBottom: 10 },

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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  commentGifPreview: {
    position: "relative",
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  commentGifThumb: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  commentGifRemove: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 9,
  },
  commentGifImg: {
    borderRadius: 10,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 8,
  },
  commentActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  commentActionCount: {
    fontSize: 12,
  },
  commentGifBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
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
  gifBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  menuOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  menuSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, paddingTop: 8 },
  menuSheetItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 24, gap: 12, borderBottomWidth: 0.5, borderColor: "rgba(128,128,128,0.15)" },
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
