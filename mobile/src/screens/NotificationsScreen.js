import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import api from "../api/client";

/* ─── helpers ─── */
function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  let raw = String(dateString);
  if (!raw.endsWith("Z") && !raw.includes("+")) raw += "Z";
  const date = new Date(raw);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 0) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_CFG = {
  like:         { icon: "heart",             color: "#f91880" },
  comment:      { icon: "chatbubble",        color: "#1d9bf0" },
  follow:       { icon: "person-add",        color: "#7856ff" },
  repost:       { icon: "repeat",            color: "#00ba7c" },
  quote_repost: { icon: "chatbubble-ellipses", color: "#ff7a00" },
};

export default function NotificationsScreen({ navigation }) {
  const { darkMode, accentColor } = useTheme();
  const t = getTheme(darkMode, accentColor);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications/?limit=100");
      setItems(res.data || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const onTap = (n) => {
    if (n.type === "follow") {
      navigation.push("Profile", { username: n.actor_username });
    } else if (n.post_id) {
      navigation.push("PostDetail", { postId: n.post_id });
    }
  };

  const messageText = (n) => {
    switch (n.type) {
      case "like":
        return `liked your post${n.post_preview ? `: "${n.post_preview.slice(0, 40)}…"` : ""}`;
      case "comment":
        return `commented${n.comment_preview ? `: "${n.comment_preview.slice(0, 40)}…"` : " on your post"}`;
      case "follow":
        return "started following you";
      case "repost":
        return `reposted your post${n.post_preview ? `: "${n.post_preview.slice(0, 40)}…"` : ""}`;
      case "quote_repost":
        return `quoted your post${n.quote_content ? `: "${n.quote_content.slice(0, 40)}…"` : ""}`;
      default:
        return "interacted with your content";
    }
  };

  const renderNotification = ({ item: n }) => {
    const cfg = TYPE_CFG[n.type] || TYPE_CFG.like;
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: t.border }]}
        activeOpacity={0.6}
        onPress={() => onTap(n)}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {n.actor_pic ? (
            <Image source={{ uri: n.actor_pic }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: t.accentBlue, justifyContent: "center", alignItems: "center" }]}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                {(n.actor_username || "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
          {/* Type badge */}
          <View style={[styles.typeBadge, { backgroundColor: t.cardBg, borderColor: t.bg }]}>
            <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          </View>
        </View>

        {/* Content */}
        <View style={styles.textWrap}>
          <Text style={[styles.msgText, { color: t.textSecondary }]}>
            <Text style={{ fontWeight: "700", color: t.text }}>@{n.actor_username}</Text>
            {" "}{messageText(n)}
          </Text>
          <Text style={[styles.timeText, { color: t.textSecondary }]}>{timeAgo(n.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.text }]}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.accentBlue} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color={t.textSecondary} />
          <Text style={{ color: t.textSecondary, marginTop: 12, fontSize: 16 }}>
            No notifications yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
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
  navTitle: { fontSize: 18, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: { position: "relative", marginRight: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  typeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  textWrap: { flex: 1, paddingTop: 2 },
  msgText: { fontSize: 14, lineHeight: 20 },
  timeText: { fontSize: 12, marginTop: 4, opacity: 0.7 },
});
