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

export default function FollowListScreen({ navigation, route }) {
  const { username, userId, tab = "followers" } = route.params;

  const [activeTab, setActiveTab] = useState(tab);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  const fetchFollowers = async () => {
    try {
      const res = await api.get(`/follow/${userId}/followers`);
      setFollowers(res.data);
    } catch {}
  };

  const fetchFollowing = async () => {
    try {
      const res = await api.get(`/follow/${userId}/following`);
      setFollowing(res.data);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchFollowers(), fetchFollowing()]);
      setIsLoading(false);
    })();
  }, [userId]);

  const data = activeTab === "followers" ? followers : following;

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={[styles.userRow, { borderColor: t.border }]}
      onPress={() => navigation.push("Profile", { username: item.username })}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: t.avatarBg }]}>
        {item.profile_pic_url ? (
          <Image source={{ uri: item.profile_pic_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>
            {(item.username || "?")[0].toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.username, { color: t.text }]}>@{item.username}</Text>
        {item.bio ? (
          <Text
            style={{ color: t.textSecondary, fontSize: 13, marginTop: 2 }}
            numberOfLines={1}
          >
            {item.bio}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Nav */}
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.text }]}>@{username}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderColor: t.border }]}>
        {["followers", "following"].map((t2) => (
          <TouchableOpacity
            key={t2}
            style={[
              styles.tabBtn,
              activeTab === t2 && { borderBottomColor: t.accentBlue, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(t2)}
          >
            <Text
              style={{
                fontWeight: activeTab === t2 ? "700" : "500",
                color: activeTab === t2 ? t.text : t.textSecondary,
                fontSize: 15,
                textTransform: "capitalize",
              }}
            >
              {t2}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={t.accentBlue} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.user_id || item._id || item.username}
          renderItem={renderUser}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={t.textSecondary} />
              <Text style={{ color: t.textSecondary, marginTop: 12 }}>
                No {activeTab} yet
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
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
  },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  username: { fontWeight: "700", fontSize: 15 },
  emptyWrap: { alignItems: "center", marginTop: 60 },
});
