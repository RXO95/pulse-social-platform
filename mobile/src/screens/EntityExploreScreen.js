import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";

export default function EntityExploreScreen({ navigation, route }) {
  const { entityText } = route.params;

  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/search/?q=${encodeURIComponent(entityText)}`);
        setPosts(res.data.results || []);
      } catch {} finally {
        setIsLoading(false);
      }
    })();
  }, [entityText]);

  const renderPost = ({ item: post }) => (
    <TouchableOpacity
      style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
      onPress={() => navigation.navigate("PostDetail", { postId: post._id })}
      activeOpacity={0.8}
    >
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: t.avatarBg }]}>
          {post.profile_pic_url ? (
            <Image source={{ uri: post.profile_pic_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>
              {(post.username || "?")[0].toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.username, { color: t.text }]}>@{post.username}</Text>
          <Text style={{ color: t.textSecondary, fontSize: 12 }}>
            {timeAgo(post.created_at)}
          </Text>
        </View>
      </View>
      <Text style={[styles.postContent, { color: t.text }]}>{post.content}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.text }]}>{entityText}</Text>
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
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={48} color={t.textSecondary} />
              <Text style={{ color: t.textSecondary, marginTop: 12 }}>
                No posts mentioning "{entityText}"
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
  navTitle: { fontSize: 17, fontWeight: "700" },
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
  postContent: { fontSize: 15, lineHeight: 22 },
  emptyWrap: { alignItems: "center", marginTop: 60 },
});
