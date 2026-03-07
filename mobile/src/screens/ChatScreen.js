import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Audio } from "expo-av";
import { useTheme, getTheme } from "../context/ThemeContext";
import api, { BASE_URL } from "../api/client";
import { timeAgo } from "../utils/helpers";
import { encryptMessage, decryptMessage, getPublicKeyJwk } from "../utils/crypto";

// Pre-load sound assets
const sendSoundFile = require("../../assets/happy-pop-2.mp3");
const recvSoundFile = require("../../assets/happy-pop-3.mp3");

async function playSound(file) {
  try {
    const { sound } = await Audio.Sound.createAsync(file);
    await sound.playAsync();
    // Unload after playback finishes
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync();
    });
  } catch {}
}

export default function ChatScreen({ route, navigation }) {
  const { otherUser } = route.params;
  const [convId, setConvId] = useState(route.params.conversationId);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [recipientKey, setRecipientKey] = useState(null);
  const [decryptedCache, setDecryptedCache] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const flatListRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const emojiSections = [
    { label: "Smileys", emojis: ["😀","😂","🤣","😊","😍","🥰","😘","😎","🤩","🥳","😜","🤗","🤔","😏","😢","😭","😤","🤯","🥺","😴"] },
    { label: "Gestures", emojis: ["👍","👎","👏","🙌","🤝","✌️","🤞","💪","🫶","🫡","👋","🤙","🙏","🫂","👀","🤌"] },
    { label: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❤️‍🔥","💕","💗","💖","💘","💝"] },
    { label: "Animals", emojis: ["🐶","🐱","🐼","🦊","🦁","🐸","🐵","🦄","🐝","🦋","🐢","🐬","🐧","🦜","🐻"] },
    { label: "Food", emojis: ["🍕","🍔","🌮","🍣","🍩","🍪","🎂","☕","🍺","🥂","🍷","🍑","🍓","🥑","🔥"] },
    { label: "Activities", emojis: ["⚽","🏀","🎮","🎵","🎬","📸","✈️","🚀","🌍","⭐","🎉","🎊","🏆","💡","💯"] },
  ];

  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  // ─── Init ───
  useEffect(() => {
    (async () => {
      try {
        const meRes = await api.get("/users/me");
        setCurrentUser(meRes.data);

        // If no conversationId yet, create/get the conversation
        let cid = convId;
        if (!cid) {
          const convRes = await api.post(`/messages/conversations/${otherUser.user_id}`);
          cid = convRes.data._id;
          setConvId(cid);
        }
        await fetchMessages(cid);
        await fetchRecipientKey();
      } catch (err) {
        console.error("Chat init error:", err);
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── WebSocket (with auto-reconnect) ───
  useEffect(() => {
    let closed = false;
    let pingInterval;

    async function connect() {
      const token = await SecureStore.getItemAsync("token");
      if (!token || closed) return;

      const wsUrl = BASE_URL.replace(/^http/, "ws") + `/api/messages/ws/${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" && data.conversation_id === convId) {
            setMessages((prev) => {
              if (prev.some((m) => m._id === data.message._id)) return prev;
              playSound(recvSoundFile);
              return [...prev, data.message];
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        if (!closed) reconnectRef.current = setTimeout(connect, 3000);
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      closed = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [convId]);

  // ─── Auto-poll messages every 4s ───
  useEffect(() => {
    if (!convId) return;
    const id = setInterval(() => fetchMessages(convId), 4000);
    return () => clearInterval(id);
  }, [convId]);

  const fetchMessages = async (cid) => {
    try {
      const id = cid || convId;
      if (!id) return;
      const res = await api.get(`/messages/conversations/${id}/messages?limit=100`);
      const fetched = res.data.reverse();
      setMessages((prev) => {
        if (prev.length === 0) return fetched;
        const existingIds = new Set(prev.map((m) => m._id));
        const newMsgs = fetched.filter((m) => !existingIds.has(m._id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs];
      });
    } catch (err) {
      console.error("fetchMessages:", err);
    }
  };

  const fetchRecipientKey = async () => {
    try {
      const res = await api.get(`/messages/keys/${otherUser.user_id}`);
      setRecipientKey(res.data.public_key);
    } catch {
      setRecipientKey(null);
    }
  };

  // ─── Send encrypted message ───
  const handleSend = async () => {
    if (!draft.trim() || isSending) return;

    if (!recipientKey) {
      alert("Recipient hasn't registered their encryption key yet.");
      return;
    }

    setIsSending(true);
    try {
      const { ciphertext, iv } = await encryptMessage(draft.trim(), recipientKey);
      const senderPubKey = await getPublicKeyJwk();

      const res = await api.post("/messages/send", {
        recipient_id: otherUser.user_id,
        ciphertext,
        iv,
        sender_public_key: senderPubKey,
      });

      setDecryptedCache((prev) => ({ ...prev, [res.data._id]: draft.trim() }));
      setMessages((prev) => [...prev, res.data]);
      setDraft("");
      playSound(sendSoundFile);
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setIsSending(false);
    }
  };

  // ─── Decrypt a message ───
  const getDecryptedText = useCallback(
    async (msg) => {
      if (decryptedCache[msg._id]) return decryptedCache[msg._id];

      // For received messages: prefer per-message sender key, then fallback to server key
      const isMine = msg.sender_id === currentUser?._id;
      let otherPubKey = null;

      if (!isMine && msg.sender_public_key) {
        otherPubKey = msg.sender_public_key;
      } else if (recipientKey) {
        otherPubKey = recipientKey;
      }

      if (!otherPubKey) return "[encrypted]";

      try {
        const plain = await decryptMessage(msg.ciphertext, msg.iv, otherPubKey);
        setDecryptedCache((prev) => ({ ...prev, [msg._id]: plain }));
        return plain;
      } catch {
        // Fallback: try server's current key
        if (!isMine && msg.sender_public_key && recipientKey && msg.sender_public_key !== recipientKey) {
          try {
            const plain = await decryptMessage(msg.ciphertext, msg.iv, recipientKey);
            setDecryptedCache((prev) => ({ ...prev, [msg._id]: plain }));
            return plain;
          } catch { /* both failed */ }
        }
        return "[unable to decrypt]";
      }
    },
    [recipientKey, decryptedCache, currentUser]
  );

  // ─── Message bubble ───
  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === currentUser?._id;
    return (
      <MessageBubble
        msg={item}
        isMine={isMine}
        getDecryptedText={getDecryptedText}
        theme={t}
      />
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[st(t).container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={t.accentBlue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st(t).container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={st(t).header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st(t).backBtn}>
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={st(t).headerInfo}
          onPress={() => navigation.navigate("Profile", { username: otherUser.username })}
          activeOpacity={0.7}
        >
          <View style={st(t).headerAvatar}>
            {otherUser.profile_pic_url ? (
              <Image source={{ uri: otherUser.profile_pic_url }} style={st(t).headerAvatarImg} />
            ) : (
              <Text style={st(t).headerAvatarText}>
                {otherUser.username?.[0]?.toUpperCase() || "?"}
              </Text>
            )}
          </View>
          <View>
            <Text style={st(t).headerUsername}>@{otherUser.username}</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="lock-closed" size={11} color="#00ba7c" style={{ marginRight: 3 }} />
              <Text style={st(t).e2eLabel}>End-to-end encrypted</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* E2E banner */}
      <View style={st(t).e2eBanner}>
        <Ionicons name="lock-closed" size={14} color={t.textSecondary} style={{ marginRight: 6 }} />
        <Text style={st(t).e2eBannerText}>
          Messages are end-to-end encrypted. No one outside of this chat can read them.
        </Text>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Emoji picker */}
        {showEmoji && (
          <View style={st(t).emojiPicker}>
            <ScrollView>
              {emojiSections.map((sec) => (
                <View key={sec.label} style={st(t).emojiSection}>
                  <Text style={st(t).emojiSectionLabel}>{sec.label}</Text>
                  <View style={st(t).emojiGrid}>
                    {sec.emojis.map((em) => (
                      <TouchableOpacity
                        key={em}
                        style={st(t).emojiBtn}
                        onPress={() => setDraft((p) => p + em)}
                      >
                        <Text style={{ fontSize: 24 }}>{em}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Compose bar */}
        <View style={st(t).composeBar}>
          <TouchableOpacity
            style={st(t).emojiToggle}
            onPress={() => setShowEmoji((v) => !v)}
          >
            <Ionicons name={showEmoji ? "close-circle" : "happy-outline"} size={26} color={showEmoji ? "#1d9bf0" : t.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={st(t).composeInput}
            placeholder="Type a message…"
            placeholderTextColor={t.textSecondary}
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setShowEmoji(false)}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[st(t).sendBtn, { opacity: draft.trim() ? 1 : 0.4 }]}
            onPress={handleSend}
            disabled={isSending || !draft.trim()}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── MessageBubble (decrypts lazily) ─── */

function MessageBubble({ msg, isMine, getDecryptedText, theme: t }) {
  const [text, setText] = useState("Decrypting…");

  useEffect(() => {
    let cancelled = false;
    getDecryptedText(msg).then((plain) => {
      if (!cancelled) setText(plain);
    });
    return () => { cancelled = true; };
  }, [msg, getDecryptedText]);

  return (
    <View style={{ flexDirection: "row", justifyContent: isMine ? "flex-end" : "flex-start", marginVertical: 2, paddingHorizontal: 8 }}>
      <View
        style={{
          maxWidth: "75%",
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 18,
          borderBottomRightRadius: isMine ? 4 : 18,
          borderBottomLeftRadius: isMine ? 18 : 4,
          backgroundColor: isMine ? "#1d9bf0" : (t.cardBg || "#2f3336"),
        }}
      >
        <Text style={{ color: isMine ? "#fff" : t.text, fontSize: 15, lineHeight: 20 }}>
          {text}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: isMine ? "rgba(255,255,255,0.6)" : t.textSecondary,
            marginTop: 4,
            textAlign: "right",
          }}
        >
          {timeAgo(msg.created_at)}
        </Text>
      </View>
    </View>
  );
}

/* ─── Styles ─── */

const st = (t) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    backBtn: { padding: 8 },
    headerInfo: { flexDirection: "row", alignItems: "center", marginLeft: 4, flex: 1 },
    headerAvatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: t.avatarBg || "#ffd700",
      justifyContent: "center", alignItems: "center",
      overflow: "hidden", marginRight: 10,
    },
    headerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
    headerAvatarText: { fontSize: 14, fontWeight: "700", color: "#000" },
    headerUsername: { fontWeight: "700", fontSize: 15, color: t.text },
    e2eLabel: { fontSize: 11, color: "#00ba7c" },

    e2eBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: 12,
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: t.inputBg || t.cardBg,
    },
    e2eBannerText: { fontSize: 12, color: t.textSecondary, flex: 1, textAlign: "center" },

    composeBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.bg,
    },
    emojiToggle: {
      padding: 6,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 2,
      marginBottom: 6,
    },
    composeInput: {
      flex: 1,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === "ios" ? 10 : 8,
      backgroundColor: t.inputBg || t.cardBg,
      color: t.text,
      fontSize: 15,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: t.inputBorder || t.border,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#1d9bf0",
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 8,
    },

    /* ── Emoji picker ── */
    emojiPicker: {
      maxHeight: 220,
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.cardBg || t.bg,
    },
    emojiSection: {
      paddingHorizontal: 10,
      paddingTop: 6,
    },
    emojiSectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: t.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    emojiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    emojiBtn: {
      padding: 5,
    },
  });
