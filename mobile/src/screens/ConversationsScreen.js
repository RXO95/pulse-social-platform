import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useTheme, getTheme } from "../context/ThemeContext";
import api, { BASE_URL } from "../api/client";
import { timeAgo } from "../utils/helpers";
import { getPublicKeyJwk } from "../utils/crypto";

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const { darkMode, accentColor } = useTheme();
  const t = getTheme(darkMode, accentColor);
  const styles = useMemo(() => s(t), [darkMode, accentColor]);

  // ─── Init: register public key & fetch data ───
  useEffect(() => {
    (async () => {
      try {
        const pubKey = await getPublicKeyJwk();
        await api.post("/messages/keys", { public_key: pubKey });
        const meRes = await api.get("/users/me");
        setCurrentUser(meRes.data);
        await fetchConversations();
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── WebSocket for real-time updates ───
  useEffect(() => {
    let closed = false;
    let reconnectTimeout;

    async function connect() {
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      const wsUrl = BASE_URL.replace(/^http/, "ws") + `/api/messages/ws/${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = () => {
        // Any new message → refresh the conversation list
        fetchConversations();
      };

      ws.onclose = () => {
        if (!closed) reconnectTimeout = setTimeout(connect, 3000);
      };

      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25000);

      wsRef.current = { ws, ping };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        clearInterval(wsRef.current.ping);
        wsRef.current.ws.close();
      }
    };
  }, []);

  // ─── Poll conversations every 5s ───
  useEffect(() => {
    pollRef.current = setInterval(fetchConversations, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  // ─── Refresh when app comes to foreground ───
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        fetchConversations();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ─── Also refresh when screen focuses (navigation) ───
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchConversations();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchConversations = async () => {
    try {
      const res = await api.get("/messages/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("fetchConversations:", err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, []);

  // ─── Search users ───
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/search/users?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } catch { }
  };

  const openChat = (conv) => {
    navigation.navigate("Chat", {
      conversationId: conv._id,
      otherUser: conv.other_user,
    });
  };

  const startChatWith = async (user) => {
    try {
      const res = await api.post(`/messages/conversations/${user._id}`);
      setSearchQuery("");
      setSearchResults([]);
      navigation.navigate("Chat", {
        conversationId: res.data._id,
        otherUser: res.data.other_user || { user_id: user._id, username: user.username, profile_pic_url: user.profile_pic_url },
      });
      fetchConversations();
    } catch (err) {
      console.error("startChatWith:", err);
    }
  };

  // ─── Render conversation item ───
  const renderConversation = ({ item }) => (
    <TouchableOpacity style={styles.convItem} onPress={() => openChat(item)} activeOpacity={0.7}>
      <View style={styles.avatar}>
        {item.other_user?.profile_pic_url ? (
          <Image source={{ uri: item.other_user.profile_pic_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>
            {item.other_user?.username?.[0]?.toUpperCase() || "?"}
          </Text>
        )}
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convTop}>
          <Text style={styles.convUsername} numberOfLines={1}>
            @{item.other_user?.username}
          </Text>
          <Text style={styles.convTime}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <View style={styles.convBottom}>
          <Ionicons name="lock-closed" size={12} color={t.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.convPreview} numberOfLines={1}>Encrypted message</Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ─── Render search result ───
  const renderSearchResult = ({ item }) => (
    <TouchableOpacity style={styles.convItem} onPress={() => startChatWith(item)} activeOpacity={0.7}>
      <View style={styles.avatar}>
        {item.profile_pic_url ? (
          <Image source={{ uri: item.profile_pic_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>
            {item.username?.[0]?.toUpperCase() || "?"}
          </Text>
        )}
      </View>
      <Text style={styles.convUsername}>@{item.username}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={t.accentBlue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={t.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users to message..."
          placeholderTextColor={t.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Search results or conversations */}
      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id}
          renderItem={renderSearchResult}
        />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={t.textSecondary} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Search for a user to start a conversation</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={renderConversation}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = (t) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    headerTitle: { fontSize: 20, fontWeight: "800", color: t.text },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      margin: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: t.inputBg,
      borderWidth: 1,
      borderColor: t.inputBorder || t.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: t.text, padding: 0 },

    convItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    convInfo: { flex: 1, marginLeft: 12 },
    convTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    convUsername: { fontWeight: "700", fontSize: 15, color: t.text },
    convTime: { fontSize: 13, color: t.textSecondary },
    convBottom: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 3,
    },
    convPreview: { fontSize: 13, color: t.textSecondary, flex: 1 },
    unreadBadge: {
      backgroundColor: t.accentBlue,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
      marginLeft: 8,
    },
    unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },

    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.avatarBg || "#ffd700",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    avatarImg: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { fontSize: 18, fontWeight: "800", color: "#000" },

    empty: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    emptyText: { fontSize: 16, color: t.textSecondary },
    emptySubtext: { fontSize: 13, color: t.textSecondary, marginTop: 4 },
  });
