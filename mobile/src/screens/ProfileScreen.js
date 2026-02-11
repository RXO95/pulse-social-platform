import React, { useEffect, useState, useCallback } from "react";
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
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import api from "../api/client";
import { timeAgo } from "../utils/helpers";

export default function ProfileScreen({ navigation, route }) {
  const usernameParam = route.params?.username;

  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPicture, setEditPicture] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { darkMode, toggleDarkMode } = useTheme();
  const { logout } = useAuth();
  const t = getTheme(darkMode);

  const isOwnProfile = currentUser && profile && currentUser.username === profile.username;

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
      Alert.alert("Error", "Failed to load profile");
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
      setPosts(res.data.filter((p) => p.username === uname));
    } catch {} finally {
      setIsLoadingPosts(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchUserPosts()]);
    setRefreshing(false);
  }, [usernameParam, currentUser]);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (usernameParam || currentUser) {
      fetchProfile();
      fetchUserPosts();
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
      Alert.alert("Error", "Action failed");
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
      Alert.alert("Error", err.response?.data?.detail || "Failed to update");
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

  const renderPost = ({ item: post }) => (
    <TouchableOpacity
      style={[styles.postCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
      onPress={() => navigation.navigate("PostDetail", { postId: post._id })}
      activeOpacity={0.8}
    >
      <Text style={[styles.postContent, { color: t.text }]}>{post.content}</Text>
      {post.media_url && (
        <Image source={{ uri: post.media_url }} style={styles.postMedia} resizeMode="cover" />
      )}
      <View style={styles.postFooter}>
        <Ionicons
          name={post.is_liked_by_user ? "heart" : "heart-outline"}
          size={18}
          color={post.is_liked_by_user ? "#f91880" : t.textSecondary}
        />
        <Text style={{ color: t.textSecondary, fontSize: 13, marginLeft: 4 }}>
          {post.likes || 0}
        </Text>
        <Text style={{ color: t.textSecondary, fontSize: 12, marginLeft: "auto" }}>
          {timeAgo(post.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const ProfileHeader = () => (
    <View>
      {/* Cover gradient */}
      <View style={styles.coverGradient} />

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
              <Text style={styles.statNumber}>{profile.followers_count ?? 0}</Text> Followers
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
              <Text style={styles.statNumber}>{profile.following_count ?? 0}</Text> Following
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action button */}
        {isOwnProfile ? (
          <View style={{ alignItems: "center", width: "100%" }}>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: t.border }]}
              onPress={openEdit}
            >
              <Text style={{ color: t.text, fontWeight: "600" }}>Edit Profile</Text>
            </TouchableOpacity>

            {/* Settings row */}
            <View style={styles.settingsRow}>
              <TouchableOpacity
                style={[styles.settingsBtn, { backgroundColor: t.inputBg }]}
                onPress={toggleDarkMode}
              >
                <Ionicons name={darkMode ? "sunny" : "moon"} size={18} color={t.text} />
                <Text style={[styles.settingsBtnText, { color: t.text }]}>
                  {darkMode ? "Light Mode" : "Dark Mode"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsBtn, { backgroundColor: t.riskBg }]}
                onPress={() =>
                  Alert.alert("Logout", "Are you sure you want to logout?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Logout", style: "destructive", onPress: logout },
                  ])
                }
              >
                <Ionicons name="log-out-outline" size={18} color={t.riskText} />
                <Text style={[styles.settingsBtnText, { color: t.riskText }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.followBtn,
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
        )}
      </View>

      {/* Posts header */}
      <View style={[styles.postsHeader, { borderColor: t.border }]}>
        <Text style={[styles.postsHeaderText, { color: t.text }]}>Posts</Text>
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
        <Text style={[styles.navTitle, { color: t.text }]}>@{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPost}
        ListHeaderComponent={ProfileHeader}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
        }
        ListEmptyComponent={
          isLoadingPosts ? (
            <ActivityIndicator size="large" color={t.accentBlue} style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={40} color={t.textSecondary} />
              <Text style={{ color: t.textSecondary, marginTop: 8 }}>No posts yet</Text>
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
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveProfile} disabled={isSaving}>
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
    backgroundColor: "#764ba2",
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
    backgroundColor: "#0f1419",
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 14,
  },

  postsHeader: { borderBottomWidth: 1, paddingVertical: 14, paddingHorizontal: 16, marginTop: 16 },
  postsHeaderText: { fontSize: 16, fontWeight: "700" },

  postCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  postContent: { fontSize: 15, lineHeight: 22 },
  postMedia: { width: "100%", height: 180, borderRadius: 10, marginTop: 8 },
  postFooter: { flexDirection: "row", alignItems: "center", marginTop: 10 },

  emptyWrap: { alignItems: "center", marginTop: 40 },

  // Modal
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
    backgroundColor: "#0f1419",
    borderRadius: 9999,
    paddingVertical: 12,
    alignItems: "center",
  },
});
