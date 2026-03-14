import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import GifPicker from "../components/GifPicker";

import useIsMobile from "../hooks/useIsMobile";
import { timeAgo } from "../utils/timeAgo";
import {
  getPublicKeyJwk,
  encryptMessage,
  decryptMessage,
  ensureKeys,
  restoreKeys,
} from "../utils/crypto";

/* ──────────────────────────── helpers ──────────────────────────── */

/* Sound effects */
const sendSound = typeof Audio !== "undefined" ? new Audio("/happy-pop-2.mp3") : null;
const recvSound = typeof Audio !== "undefined" ? new Audio("/happy-pop-3.mp3") : null;
if (sendSound) sendSound.volume = 0.5;
if (recvSound) recvSound.volume = 0.5;
function playSend() { try { if (sendSound) { sendSound.currentTime = 0; sendSound.play(); } } catch { } }
function playRecv() { try { if (recvSound) { recvSound.currentTime = 0; recvSound.play(); } } catch { } }

/* ══════════════════════════════════════════════════════════════════
   Messages page — conversation list + inline chat
   ══════════════════════════════════════════════════════════════════ */

export default function Messages() {
  const toast = useToast();
  const confirm = useConfirm();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);      // conversation doc
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);        // people you follow
  const [recipientKey, setRecipientKey] = useState(null);   // JWK string
  const [decryptedCache, setDecryptedCache] = useState({}); // msgId → plaintext
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUser, setTypingUser] = useState(null);       // username of who is typing
  const [replyTo, setReplyTo] = useState(null);             // { msgId, text, senderUsername }
  const [infoModal, setInfoModal] = useState(null);         // { timestamp, isMine } for info display
  const [msgGifUrl, setMsgGifUrl] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const typingTimerRef = useRef(null);
  const lastTypingSent = useRef(0);

  const { logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem("token");
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const mobile = useIsMobile();
  const s = getStyles(t, mobile, background);

  /* ─── bootstrap: ensure E2EE keys + fetch user + conversations ─── */

  useEffect(() => {
    (async () => {
      try {
        // Ensure E2EE keys exist (IndexedDB → server backup → generate new)
        const backupKeyHex = localStorage.getItem("pulse_backup_key");
        await ensureKeys(token, backupKeyHex);

        // Current user
        const meRes = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData);

          // Fetch people you follow as suggestions
          try {
            const followRes = await fetch(`${API}/follow/following/${meData.username}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (followRes.ok) {
              const followData = await followRes.json();
              setSuggestions(followData.slice(0, 10));
            }
          } catch { /* ignore */ }
        }

        // Conversations
        await fetchConversations();
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── WebSocket for real‑time messages (with auto‑reconnect) ─── */

  useEffect(() => {
    if (!token) return;

    let closed = false;
    let pingInterval;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.host;
      const ws = new WebSocket(`${proto}://${host}/api/messages/ws/${token}`);

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message") {
            const msg = data.message;
            const isMine = msg.sender_id === currentUser?._id;
            setMessages((prev) => {
              if (prev.some((m) => m._id === msg._id)) return prev;
              return [...prev, msg];
            });
            if (!isMine) {
              playRecv();
              setTypingUser(null);
              clearTimeout(typingTimerRef.current);
            }
            scrollToBottom();
            fetchConversations();
          }
          if (data.type === "message_deleted") {
            setMessages((prev) => prev.filter((m) => m._id !== data.message_id));
          }
          if (data.type === "reaction") {
            setMessages((prev) => prev.map((m) =>
              m._id === data.message_id ? { ...m, reactions: data.reactions } : m
            ));
          }
          if (data.type === "typing") {
            setTypingUser(data.username || null);
            clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
          }
        } catch { /* ignore non-JSON */ }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        if (!closed) reconnectTimer.current = setTimeout(connect, 3000);
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      closed = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ─── Send typing indicator (throttled to 1 per 2s) ─── */
  const emitTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    if (wsRef.current?.readyState === WebSocket.OPEN && activeConv) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        conversation_id: activeConv._id,
      }));
    }
  };

  /* ─── Auto‑poll conversations every 5s (lightweight) ─── */

  useEffect(() => {
    const id = setInterval(fetchConversations, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Auto‑poll active chat messages every 4s ─── */

  useEffect(() => {
    if (!activeConv) return;
    const id = setInterval(() => fetchMessages(activeConv._id), 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?._id]);

  /* ─── deep‑link: ?userId=... opens/creates a conversation ─── */

  useEffect(() => {
    const targetUserId = searchParams.get("userId");
    if (targetUserId && !isLoading) {
      openConversationWith(targetUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isLoading]);

  /* ─── data fetchers ─── */

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setConversations(await res.json());
    } catch (err) {
      console.error("fetchConversations:", err);
    }
  };

  const openConversation = async (conv) => {
    setActiveConv(conv);
    setDecryptedCache({});
    await fetchMessages(conv._id);
    await fetchRecipientKey(conv.other_user.user_id);
  };

  const openConversationWith = async (userId) => {
    try {
      const res = await fetch(`${API}/messages/conversations/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const conv = await res.json();
        await openConversation(conv);
        await fetchConversations(); // refresh list
      }
    } catch (err) {
      console.error("openConversationWith:", err);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      const res = await fetch(`${API}/messages/conversations/${convId}/messages?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const msgs = (await res.json()).reverse(); // API returns newest first
        setMessages((prev) => {
          // Smart merge: only update if there are new messages
          if (prev.length === 0) { scrollToBottom(); return msgs; }
          const existingIds = new Set(prev.map((m) => m._id));
          const newMsgs = msgs.filter((m) => !existingIds.has(m._id));
          if (newMsgs.length === 0) return prev;
          scrollToBottom();
          return [...prev, ...newMsgs];
        });
      }
    } catch (err) {
      console.error("fetchMessages:", err);
    }
  };

  const fetchRecipientKey = async (userId) => {
    try {
      const res = await fetch(`${API}/messages/keys/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecipientKey(data.public_key);
      } else {
        setRecipientKey(null);
      }
    } catch {
      setRecipientKey(null);
    }
  };

  /* ─── send encrypted message ─── */

  const handleSend = async () => {
    if ((!draft.trim() && !msgGifUrl) || !activeConv || isSending) return;

    const otherUserId = activeConv.other_user.user_id;

    if (!recipientKey) {
      toast("Recipient hasn't registered their encryption key yet", "warning");
      return;
    }

    setIsSending(true);
    try {
      const textToSend = draft.trim() || (msgGifUrl ? "sent a GIF" : "");
      const { ciphertext, iv } = await encryptMessage(textToSend, recipientKey);
      const senderPubKey = await getPublicKeyJwk();

      const body = {
        recipient_id: otherUserId,
        ciphertext,
        iv,
        sender_public_key: senderPubKey,
        recipient_public_key: recipientKey,
        reply_to: replyTo?.msgId || null,
      };
      if (msgGifUrl) body.gif_url = msgGifUrl;

      const res = await fetch(`${API}/messages/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const msg = await res.json();
        const plaintext = draft.trim() || (msgGifUrl ? "sent a GIF" : "");
        playSend();
        // Cache in memory
        setDecryptedCache((prev) => ({ ...prev, [msg._id]: plaintext }));
        // Persist in localStorage so sent messages survive reloads
        try {
          const cacheKey = `pulse_dm_${msg._id}`;
          localStorage.setItem(cacheKey, plaintext);
        } catch { /* quota exceeded, ignore */ }
        setMessages((prev) => [...prev, msg]);
        setDraft("");
        setReplyTo(null);
        setMsgGifUrl(null);
        scrollToBottom();
        fetchConversations();
      }
    } catch (err) {
      console.error("Send failed:", err);
      toast("Failed to send message", "error");
    } finally {
      setIsSending(false);
    }
  };

  /* ─── decrypt a single message (for display) ─── */

  const getDecryptedText = useCallback(
    async (msg) => {
      if (!msg) return "[empty]";

      // Already cached in memory?
      if (decryptedCache[msg._id]) return decryptedCache[msg._id];

      // Check localStorage cache (for our own sent messages across reloads)
      try {
        const cached = localStorage.getItem(`pulse_dm_${msg._id}`);
        if (cached) {
          setDecryptedCache((prev) => ({ ...prev, [msg._id]: cached }));
          return cached;
        }
      } catch { /* ignore */ }

      // Build a list of candidate public keys to try (most likely first)
      const isMine = msg.sender_id === currentUser?._id;
      const candidates = [];

      if (isMine) {
        // For messages I sent: need the recipient's key at time of encryption
        if (msg.recipient_public_key) candidates.push(msg.recipient_public_key);
        if (recipientKey) candidates.push(recipientKey);
        if (msg.sender_public_key) candidates.push(msg.sender_public_key); // fallback
      } else {
        // For messages I received: need the sender's key at time of encryption
        if (msg.sender_public_key) candidates.push(msg.sender_public_key);
        if (recipientKey) candidates.push(recipientKey);
        if (msg.recipient_public_key) candidates.push(msg.recipient_public_key); // fallback
      }

      // Deduplicate candidate keys
      const seen = new Set();
      const uniqueKeys = candidates.filter((k) => {
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      if (uniqueKeys.length === 0) return "[encrypted]";

      // Try each candidate key
      for (const key of uniqueKeys) {
        try {
          const plain = await decryptMessage(msg.ciphertext, msg.iv, key);
          setDecryptedCache((prev) => ({ ...prev, [msg._id]: plain }));
          if (isMine) {
            try { localStorage.setItem(`pulse_dm_${msg._id}`, plain); } catch { }
          }
          return plain;
        } catch {
          continue; // try next key
        }
      }

      // All keys failed — attempt key recovery from server backup, then retry
      const backupKeyHex = localStorage.getItem("pulse_backup_key");
      if (backupKeyHex) {
        try {
          const restored = await restoreKeys(backupKeyHex, token);
          if (restored) {
            // Retry with the first viable key after restoring
            for (const key of uniqueKeys) {
              try {
                const plain = await decryptMessage(msg.ciphertext, msg.iv, key);
                setDecryptedCache((prev) => ({ ...prev, [msg._id]: plain }));
                if (isMine) {
                  try { localStorage.setItem(`pulse_dm_${msg._id}`, plain); } catch { }
                }
                return plain;
              } catch { continue; }
            }
          }
        } catch { /* backup restore failed */ }
      }

      return "[unable to decrypt]";
    },
    [recipientKey, decryptedCache, currentUser, token]
  );

  /* ─── user search for starting new conversations ─── */

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API}/search/users?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSearchResults(await res.json());
    } catch { /* ignore */ }
  };

  /* ─── scroll helper ─── */

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  /* ─── emoji data ─── */

  const emojiSections = [
    { label: "Smileys", emojis: ["😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😜", "🤗", "🤔", "😏", "😢", "😭", "😤", "🤯", "🥺", "😴"] },
    { label: "Gestures", emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "💪", "🫶", "🫡", "👋", "🤙", "🙏", "🫂", "👀", "🤌"] },
    { label: "Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❤️‍🔥", "💕", "💗", "💖", "💘", "💝"] },
    { label: "Animals", emojis: ["🐶", "🐱", "🐼", "🦊", "🦁", "🐸", "🐵", "🦄", "🐝", "🦋", "🐢", "🐬", "🐧", "🦜", "🐻"] },
    { label: "Food", emojis: ["🍕", "🍔", "🌮", "🍣", "🍩", "🍪", "🎂", "☕", "🍺", "🥂", "🍷", "🍑", "🍓", "🥑", "🔥"] },
    { label: "Activities", emojis: ["⚽", "🏀", "🎮", "🎵", "🎬", "📸", "✈️", "🚀", "🌍", "⭐", "🎉", "🎊", "🏆", "💡", "💯"] },
  ];

  const insertEmoji = (emoji) => {
    setDraft((prev) => prev + emoji);
  };

  /* ─── message context menu handlers ─── */

  const handleReply = (msg, plaintext) => {
    const senderName = msg.sender_id === currentUser?._id ? "You" : activeConv?.other_user?.username;
    setReplyTo({ msgId: msg._id, text: plaintext, senderUsername: senderName });
    // Focus the input
    setTimeout(() => document.querySelector('[data-compose-input]')?.focus(), 100);
  };

  const handleReact = async (messageId, emoji) => {
    try {
      const res = await fetch(`${API}/messages/${messageId}/react`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update the message's reactions in state
        setMessages((prev) => prev.map((m) =>
          m._id === messageId ? { ...m, reactions: data.reactions } : m
        ));
      }
    } catch (err) {
      console.error("React failed:", err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const ok = await confirm("Delete this message?", { title: "Delete Message", confirmText: "Delete" });
    if (!ok) return;
    try {
      const res = await fetch(`${API}/messages/${messageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleInfo = (msg, timestamp) => {
    setInfoModal({ timestamp, isMine: msg.sender_id === currentUser?._id, read: msg.read });
  };

  /* ═══════════════════════ RENDER ═══════════════════════ */

  if (isLoading) {
    return (
      <div style={s.pageContainer}>
        <div style={s.loader}>Loading…</div>
      </div>
    );
  }

  /* ────────────── MOBILE: keep toggle behaviour ────────────── */
  if (mobile) {
    if (activeConv) {
      return (
        <div style={s.pageContainer}>
          <div style={s.chatHeader}>
            <button style={s.backBtn} onClick={() => { setActiveConv(null); setMessages([]); setDecryptedCache({}); }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill={t.text}><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></svg>
            </button>
            <div style={s.chatHeaderInfo} onClick={() => navigate(`/profile/${activeConv.other_user.username}`)}>
              <div style={s.chatAvatar}>
                {activeConv.other_user.profile_pic_url ?
                  <img src={activeConv.other_user.profile_pic_url} alt="" style={s.chatAvatarImg} />
                  : (activeConv.other_user.username?.[0]?.toUpperCase() || "?")}
              </div>
              <div>
                <div style={s.chatUsername}>@{activeConv.other_user.username}</div>
                {typingUser ? (
                  <div style={{ fontSize: 12, color: '#00ba7c', fontStyle: 'italic', fontWeight: 500 }}>typing...</div>
                ) : (
                  <div style={s.e2eLabel}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="#00ba7c" style={{ marginRight: 4 }}><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" /></svg>
                    End-to-end encrypted
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={s.messagesArea}>
            <div style={s.e2eBanner}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill={t.textSecondary}><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" /></svg>
              <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
            </div>
            {messages.map((msg) => (
              <MessageBubble key={msg._id} msg={{ ...msg, _replyText: msg.reply_to ? (decryptedCache[msg.reply_to] || null) : null }} isMine={msg.sender_id === currentUser?._id} getDecryptedText={getDecryptedText} theme={t} onReply={handleReply} onReact={handleReact} onDelete={handleDeleteMessage} onInfo={handleInfo} currentUserId={currentUser?._id} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          {showEmoji && <div style={s.emojiPicker}>{emojiSections.map((sec) => (
            <div key={sec.label} style={s.emojiSection}><div style={s.emojiSectionLabel}>{sec.label}</div><div style={s.emojiGrid}>{sec.emojis.map((em) => (
              <button key={em} style={s.emojiBtn} onClick={() => insertEmoji(em)}>{em}</button>
            ))}</div></div>
          ))}</div>}
          {/* Reply bar */}
          {replyTo && (
            <div style={s.replyBar}>
              <div style={s.replyBarContent}>
                <div style={s.replyBarLabel}>Replying to {replyTo.senderUsername}</div>
                <div style={s.replyBarText}>{replyTo.text}</div>
              </div>
              <button style={s.replyBarClose} onClick={() => setReplyTo(null)}>✕</button>
            </div>
          )}
          {/* GIF preview */}
          {msgGifUrl && (
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <img src={msgGifUrl} alt="GIF" style={{ height: 60, borderRadius: 8 }} />
              <button onClick={() => setMsgGifUrl(null)} style={{ background: "none", border: "none", color: t.textSecondary, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
          )}
          <div style={s.composeBar}>
            <button style={s.emojiToggle} onClick={() => setShowEmoji((v) => !v)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill={showEmoji ? t.accentBlue : t.textSecondary}><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm3.5-9c.828 0 1.5-.672 1.5-1.5S16.328 8 15.5 8 14 8.672 14 9.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5S9.328 8 8.5 8 7 8.672 7 9.5 7.672 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>
            </button>
            <button style={{ ...s.emojiToggle, marginLeft: 0 }} onClick={() => setShowGifPicker(true)}>
              <span style={{ fontWeight: 800, fontSize: 13, color: t.textSecondary }}>GIF</span>
            </button>
            <input data-compose-input style={s.composeInput} placeholder="Message…" value={draft}
              onChange={(e) => { setDraft(e.target.value); emitTyping(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              onFocus={() => setShowEmoji(false)} />
            <button style={{ ...s.sendBtn, opacity: (draft.trim() || msgGifUrl) ? 1 : 0.4 }} onClick={handleSend} disabled={isSending || (!draft.trim() && !msgGifUrl)}>
              {isSending ? "…" : <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>}
            </button>
          </div>
          {showGifPicker && <GifPicker theme={t} onSelect={(url) => { setMsgGifUrl(url); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
        </div>
      );
    }

    // Mobile conversation list
    return (
      <div style={s.pageContainer}>
        <div style={s.sidebarHeader}>
          <button style={s.headerBackBtn} onClick={() => navigate("/feed")}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill={t.text}><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></svg>
          </button>
          <h1 style={s.headerTitle}>Messages</h1>
        </div>
        {renderSearchBar()}
        {renderSearchResults()}
        {renderSuggestions()}
        {renderConversationList()}
      </div>
    );
  }

  /* ────────────── DESKTOP: Instagram-style split pane ────────────── */
  return (
    <div style={s.pageContainer}>
      {/* Left sidebar — conversation list */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <h1 style={s.headerTitle}>Messages</h1>
          <button style={s.newChatBtn} title="New message" onClick={() => document.querySelector('[data-search-input]')?.focus()}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill={t.text}><path d="M22 6.01l-4-3.99L6 14.01V18h4L22 6.01zM4 20h16v2H4v-2z" /></svg>
          </button>
        </div>
        {renderSearchBar()}
        {renderSearchResults()}
        <div style={s.sidebarConvList}>
          {renderSuggestions()}
          {renderConversationList()}
        </div>
      </div>

      {/* Right pane — chat or empty state */}
      <div style={s.chatPane}>
        {activeConv ? (
          <>
            <div style={s.chatHeader}>
              <div style={s.chatHeaderInfo} onClick={() => navigate(`/profile/${activeConv.other_user.username}`)}>
                <div style={s.chatAvatar}>
                  {activeConv.other_user.profile_pic_url ?
                    <img src={activeConv.other_user.profile_pic_url} alt="" style={s.chatAvatarImg} />
                    : (activeConv.other_user.username?.[0]?.toUpperCase() || "?")}
                </div>
                <div>
                  <div style={s.chatUsername}>@{activeConv.other_user.username}</div>
                  {typingUser ? (
                    <div style={{ fontSize: 11, color: '#00ba7c', fontStyle: 'italic', fontWeight: 500 }}>typing...</div>
                  ) : (
                    <div style={s.e2eLabel}>
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="#00ba7c" style={{ marginRight: 3 }}><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" /></svg>
                      Encrypted
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={s.messagesArea}>
              <div style={s.e2eBanner}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill={t.textSecondary}><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" /></svg>
                <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
              </div>
              {messages.map((msg) => (
                <MessageBubble key={msg._id} msg={{ ...msg, _replyText: msg.reply_to ? (decryptedCache[msg.reply_to] || null) : null }} isMine={msg.sender_id === currentUser?._id} getDecryptedText={getDecryptedText} theme={t} onReply={handleReply} onReact={handleReact} onDelete={handleDeleteMessage} onInfo={handleInfo} currentUserId={currentUser?._id} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            {showEmoji && <div style={s.emojiPicker}>{emojiSections.map((sec) => (
              <div key={sec.label} style={s.emojiSection}><div style={s.emojiSectionLabel}>{sec.label}</div><div style={s.emojiGrid}>{sec.emojis.map((em) => (
                <button key={em} style={s.emojiBtn} onClick={() => insertEmoji(em)}>{em}</button>
              ))}</div></div>
            ))}</div>}
            {/* Reply bar */}
            {replyTo && (
              <div style={s.replyBar}>
                <div style={s.replyBarContent}>
                  <div style={s.replyBarLabel}>Replying to {replyTo.senderUsername}</div>
                  <div style={s.replyBarText}>{replyTo.text}</div>
                </div>
                <button style={s.replyBarClose} onClick={() => setReplyTo(null)}>✕</button>
              </div>
            )}
            {/* GIF preview */}
            {msgGifUrl && (
              <div style={{ padding: "8px 12px", borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <img src={msgGifUrl} alt="GIF" style={{ height: 60, borderRadius: 8 }} />
                <button onClick={() => setMsgGifUrl(null)} style={{ background: "none", border: "none", color: t.textSecondary, fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>
            )}
            <div style={s.composeBar}>
              <button style={s.emojiToggle} onClick={() => setShowEmoji((v) => !v)}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill={showEmoji ? t.accentBlue : t.textSecondary}><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm3.5-9c.828 0 1.5-.672 1.5-1.5S16.328 8 15.5 8 14 8.672 14 9.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5S9.328 8 8.5 8 7 8.672 7 9.5 7.672 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>
              </button>
              <button style={{ ...s.emojiToggle, marginLeft: 0 }} onClick={() => setShowGifPicker(true)}>
                <span style={{ fontWeight: 800, fontSize: 13, color: t.textSecondary }}>GIF</span>
              </button>
              <input data-compose-input style={s.composeInput} placeholder="Message…" value={draft}
                onChange={(e) => { setDraft(e.target.value); emitTyping(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onFocus={() => setShowEmoji(false)} />
              <button style={{ ...s.sendBtn, opacity: (draft.trim() || msgGifUrl) ? 1 : 0.4 }} onClick={handleSend} disabled={isSending || (!draft.trim() && !msgGifUrl)}>
                {isSending ? "…" : <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>}
              </button>
            </div>
          </>
        ) : (
          <div style={s.chatEmpty}>
            <div style={s.chatEmptyIcon}>
              <svg viewBox="0 0 24 24" width="56" height="56" fill={t.textSecondary} style={{ opacity: 0.3 }}>
                <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v13c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-13c0-.276-.224-.5-.5-.5h-15z" />
                <path d="M5.998 8h12v1.5h-12V8zm0 4h8v1.5h-8V12z" />
              </svg>
            </div>
            <div style={s.chatEmptyTitle}>Your messages</div>
            <div style={s.chatEmptySubtext}>Send a message to start a chat.</div>
          </div>
        )}
      </div>

      {/* Info Modal */}
      {infoModal && (
        <div style={s.infoModalOverlay} onClick={() => setInfoModal(null)}>
          <div style={s.infoModalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: t.text }}>Message Info</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 2 }}>Sent</div>
                <div style={{ fontSize: 15, color: t.text }}>{infoModal.timestamp}</div>
              </div>
              {infoModal.isMine && (
                <div>
                  <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 2 }}>Status</div>
                  <div style={{ fontSize: 15, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                    {infoModal.read ? (
                      <><svg viewBox="0 0 24 24" width="16" height="16" fill={t.accentBlue}><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" /></svg> Read</>
                    ) : (
                      <><svg viewBox="0 0 24 24" width="16" height="16" fill={t.textSecondary}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg> Delivered</>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setInfoModal(null)} style={{ marginTop: 20, width: "100%", padding: "10px", border: "none", borderRadius: 9999, backgroundColor: t.inputBg, color: t.text, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}
      {showGifPicker && <GifPicker theme={t} onSelect={(url) => { setMsgGifUrl(url); setShowGifPicker(false); }} onClose={() => setShowGifPicker(false)} />}
    </div>
  );

  /* ────────────── Shared render helpers ────────────── */
  function renderSearchBar() {
    return (
      <div style={s.searchBar}>
        <div style={s.searchInputWrap}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill={t.textSecondary} style={{ flexShrink: 0 }}>
            <path d="M10.25 3.75a6.5 6.5 0 100 13 6.5 6.5 0 000-13zm-8.5 6.5a8.5 8.5 0 1117 0 8.5 8.5 0 01-17 0z" />
            <path d="M15.44 15.44l4.773 4.773 1.06-1.06-4.773-4.773-1.06 1.06z" />
          </svg>
          <input data-search-input style={s.searchInput} placeholder="Search…" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
          {searchQuery && <button style={s.clearSearchBtn} onClick={() => { setSearchQuery(""); setSearchResults([]); }}>✕</button>}
        </div>
      </div>
    );
  }

  function renderSearchResults() {
    if (searchResults.length === 0) return null;
    return (
      <div style={s.searchResults}>
        {searchResults.map((u) => (
          <div key={u._id} style={s.convItem}
            onClick={() => { openConversationWith(u._id); setSearchQuery(""); setSearchResults([]); }}>
            <div style={s.avatar}>
              {u.profile_pic_url ? <img src={u.profile_pic_url} alt="" style={s.avatarImg} /> : (u.username?.[0]?.toUpperCase() || "?")}
            </div>
            <div style={s.convInfo}>
              <span style={s.convUsername}>@{u.username}</span>
              {u.bio && <div style={s.userBio}>{u.bio}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSuggestions() {
    if (searchQuery || suggestions.length === 0) return null;
    if (conversations.length === 0) {
      return (
        <div style={s.suggestionsSection}>
          <div style={s.sectionLabel}>People you follow</div>
          {suggestions.map((u) => (
            <div key={u._id || u.user_id} style={s.convItem}
              onClick={() => openConversationWith(u.user_id || u._id)}>
              <div style={s.avatar}>
                {u.profile_pic_url ? <img src={u.profile_pic_url} alt="" style={s.avatarImg} /> : (u.username?.[0]?.toUpperCase() || "?")}
              </div>
              <div style={s.convInfo}>
                <span style={s.convUsername}>@{u.username}</span>
                {u.bio && <div style={s.userBio}>{u.bio}</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  }

  function renderConversationList() {
    if (conversations.length === 0 && !searchQuery && suggestions.length === 0) {
      return (
        <div style={s.empty}>
          <p style={{ color: t.textSecondary, fontSize: 14 }}>No messages yet</p>
        </div>
      );
    }
    return (
      <div style={s.convList}>
        {conversations.map((conv) => (
          <div key={conv._id}
            style={{ ...s.convItem, backgroundColor: activeConv?._id === conv._id ? (t.cardBg === "#ffffff" ? "#eff3f4" : "rgba(255,255,255,0.06)") : "transparent" }}
            onClick={() => openConversation(conv)}>
            <div style={s.avatar}>
              {conv.other_user?.profile_pic_url ?
                <img src={conv.other_user.profile_pic_url} alt="" style={s.avatarImg} />
                : (conv.other_user?.username?.[0]?.toUpperCase() || "?")}
            </div>
            <div style={s.convInfo}>
              <div style={s.convTop}>
                <span style={s.convUsername}>@{conv.other_user?.username}</span>
                <span style={s.convTime}>{timeAgo(conv.last_message_at)}</span>
              </div>
              <div style={s.convPreview}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill={t.textSecondary} style={{ marginRight: 4, flexShrink: 0 }}>
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                </svg>
                <span>Encrypted message</span>
                {conv.unread_count > 0 && <span style={s.unreadBadge}>{conv.unread_count}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
}


/* ═══════════════════════════════════════════════════════════════════
   MessageBubble — decrypts lazily and shows plaintext
   Now with WhatsApp-style dropdown context menu
   ═══════════════════════════════════════════════════════════════════ */

function MessageBubble({ msg, isMine, getDecryptedText, theme: t, onReply, onReact, onDelete, onInfo, currentUserId }) {
  const [text, setText] = useState("Decrypting…");
  const [showMenu, setShowMenu] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getDecryptedText(msg).then((plain) => {
      if (!cancelled) setText(plain);
    });
    return () => { cancelled = true; };
  }, [msg, getDecryptedText]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu && !showReactPicker) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowReactPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showReactPicker]);

  const quickReactEmojis = ["❤️", "😂", "😮", "😢", "🙏", "👍"];
  const reactions = msg.reactions || {};
  const reactionEntries = Object.values(reactions);
  const reactionCounts = {};
  reactionEntries.forEach(emoji => { reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1; });
  const hasReactions = reactionEntries.length > 0;

  // Replied message info
  const replyText = msg._replyText; // injected by parent

  const fullTimestamp = (() => {
    if (!msg.created_at) return "";
    let raw = String(msg.created_at);
    if (!raw.endsWith("Z") && !raw.includes("+")) raw += "Z";
    const d = new Date(raw);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  })();

  const menuItems = [
    {
      label: "Reply",
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill={t.text}><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>,
      action: () => { onReply(msg, text); setShowMenu(false); },
    },
    {
      label: "React",
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill={t.text}><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm3.5-9c.828 0 1.5-.672 1.5-1.5S16.328 8 15.5 8 14 8.672 14 9.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5S9.328 8 8.5 8 7 8.672 7 9.5 7.672 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>,
      action: () => { setShowMenu(false); setShowReactPicker(true); },
    },
    {
      label: "Copy",
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill={t.text}><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>,
      action: () => {
        navigator.clipboard?.writeText(text).catch(() => { });
        setShowMenu(false);
      },
    },
    {
      label: "Info",
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill={t.text}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>,
      action: () => { onInfo(msg, fullTimestamp); setShowMenu(false); },
    },
  ];

  // Only show delete for own messages
  if (isMine) {
    menuItems.push({
      label: "Delete",
      icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="#f4212e"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z" /></svg>,
      action: () => { onDelete(msg._id); setShowMenu(false); },
      danger: true,
    });
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: isMine ? "flex-end" : "flex-start",
      padding: "2px 16px",
      position: "relative",
    }} ref={menuRef}>
      <div style={{
        maxWidth: "75%",
        position: "relative",
      }}
        onMouseEnter={(e) => {
          const arrow = e.currentTarget.querySelector('[data-menu-arrow]');
          if (arrow) arrow.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          const arrow = e.currentTarget.querySelector('[data-menu-arrow]');
          if (arrow && !showMenu && !showReactPicker) arrow.style.opacity = "0";
        }}
      >
        {/* Dropdown arrow trigger */}
        <button
          data-menu-arrow
          onClick={() => { setShowMenu(!showMenu); setShowReactPicker(false); }}
          style={{
            position: "absolute",
            top: 4,
            [isMine ? "left" : "right"]: -28,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.15s, background-color 0.15s",
            zIndex: 5,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.inputBg}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill={t.textSecondary}><path d="M7 10l5 5 5-5z" /></svg>
        </button>

        {/* The bubble */}
        <div style={{
          padding: "8px 14px",
          borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          backgroundColor: isMine ? (t.accentBlue || "#1d9bf0") : (t.cardBg === "#ffffff" ? "#eff3f4" : "#2f3336"),
          color: isMine ? "#fff" : t.text,
          fontSize: 15,
          lineHeight: "1.4",
          wordBreak: "break-word",
        }}>
          {/* Reply quote */}
          {replyText && (
            <div style={{
              padding: "6px 10px",
              marginBottom: 6,
              borderRadius: 8,
              borderLeft: `3px solid ${isMine ? "rgba(255,255,255,0.5)" : t.accentBlue}`,
              backgroundColor: isMine ? "rgba(255,255,255,0.15)" : (t.cardBg === "#ffffff" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)"),
              fontSize: 13,
              color: isMine ? "rgba(255,255,255,0.8)" : t.textSecondary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 280,
            }}>
              {replyText}
            </div>
          )}
          {msg.gif_url && (
            <img src={msg.gif_url} alt="GIF" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: text && text !== "sent a GIF" ? 6 : 0 }} />
          )}
          {(!msg.gif_url || (text && text !== "sent a GIF")) && text}
          <div style={{
            fontSize: 11,
            color: isMine ? "rgba(255,255,255,0.6)" : t.textSecondary,
            marginTop: 4,
            textAlign: "right",
          }}>
            {timeAgo(msg.created_at)}
          </div>
        </div>

        {/* Reactions display */}
        {hasReactions && (
          <div style={{
            display: "flex",
            gap: 4,
            marginTop: -8,
            [isMine ? "justifyContent" : ""]: isMine ? "flex-end" : undefined,
            paddingLeft: isMine ? 0 : 8,
            paddingRight: isMine ? 8 : 0,
          }}>
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span key={emoji} style={{
                background: t.cardBg === "#ffffff" ? "#fff" : "#2f3336",
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: "2px 6px",
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }} onClick={() => onReact(msg._id, emoji)}>
                {emoji}{count > 1 ? ` ${count}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Context Menu Dropdown */}
        {showMenu && (
          <div style={{
            position: "absolute",
            top: 28,
            [isMine ? "right" : "left"]: 0,
            backgroundColor: t.cardBg === "#ffffff" ? "#fff" : "#2a2a2a",
            borderRadius: 12,
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            minWidth: 180,
            zIndex: 20,
            overflow: "hidden",
            border: `1px solid ${t.border}`,
          }}>
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                  color: item.danger ? "#f4212e" : t.text,
                  fontWeight: item.danger ? "600" : "400",
                  fontFamily: "inherit",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.inputBg}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick React Picker (shown after clicking React in menu) */}
        {showReactPicker && (
          <div style={{
            position: "absolute",
            top: -48,
            [isMine ? "right" : "left"]: 0,
            backgroundColor: t.cardBg === "#ffffff" ? "#fff" : "#2a2a2a",
            borderRadius: 24,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            padding: "6px 8px",
            display: "flex",
            gap: 2,
            zIndex: 20,
            border: `1px solid ${t.border}`,
          }}>
            {quickReactEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onReact(msg._id, emoji); setShowReactPicker(false); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 24,
                  padding: "4px 6px",
                  borderRadius: 8,
                  transition: "transform 0.12s, background 0.12s",
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.3)"; e.currentTarget.style.backgroundColor = t.inputBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   Styles (inline, matching existing codebase pattern)
   ═══════════════════════════════════════════════════════════════════ */

function getStyles(t, mobile, bg) {
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const glass = bg && bg !== "none";

  /* ── Desktop split-pane dimensions ── */
  const sidebarW = 380;

  return {
    /* ── Page container: flexbox on desktop, column on mobile ── */
    pageContainer: {
      flex: 1,
      fontFamily,
      color: t.text,
      display: "flex",
      flexDirection: mobile ? "column" : "row",
      overflow: "hidden",
      paddingBottom: mobile ? 56 : 0,
    },
    loader: {
      display: "flex", justifyContent: "center", alignItems: "center",
      height: "100%", width: "100%", color: t.textSecondary, fontSize: 15, fontFamily,
    },

    /* ── Left sidebar (desktop) ── */
    sidebar: {
      width: sidebarW,
      minWidth: sidebarW,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      borderRight: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      overflow: "hidden",
      ...(glass && { backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", backgroundColor: "rgba(255,255,255,0.12)" }),
    },
    sidebarHeader: {
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 16px 10px",
      borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.12)" : t.border}`,
    },
    headerBackBtn: {
      background: "none", border: "none", cursor: "pointer",
      padding: 6, display: "flex", borderRadius: "50%",
      transition: "background-color 0.15s",
    },
    headerTitle: {
      fontSize: 20, fontWeight: 800, color: t.text, margin: 0, fontFamily, flex: 1,
    },
    newChatBtn: {
      background: "none", border: "none", cursor: "pointer",
      padding: 6, display: "flex", borderRadius: "50%",
    },
    sidebarConvList: {
      flex: 1, overflowY: "auto",
    },

    /* ── Right chat pane (desktop) ── */
    chatPane: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      position: "relative",
      ...(glass && { backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", backgroundColor: "rgba(255,255,255,0.1)" }),
    },

    /* ── Chat empty state (desktop right pane) ── */
    chatEmpty: {
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      flex: 1, textAlign: "center", padding: 32,
    },
    chatEmptyIcon: { marginBottom: 16 },
    chatEmptyTitle: {
      fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6, fontFamily,
    },
    chatEmptySubtext: {
      fontSize: 14, color: t.textSecondary, fontFamily,
    },

    /* ── Search ── */
    searchBar: {
      padding: "8px 12px",
      borderBottom: `1px solid ${t.border}`,
    },
    searchInputWrap: {
      display: "flex", alignItems: "center", gap: 8,
      padding: "0 12px",
      borderRadius: 9999, border: `1px solid ${t.inputBorder}`,
      backgroundColor: t.inputBg,
    },
    searchInput: {
      flex: 1, padding: "9px 0",
      border: "none", background: "transparent", color: t.text,
      fontSize: 14, outline: "none", fontFamily,
    },
    clearSearchBtn: {
      background: "none", border: "none", cursor: "pointer",
      color: t.textSecondary, fontSize: 13, padding: "4px 2px",
    },
    searchResults: {
      borderBottom: `1px solid ${t.border}`,
      maxHeight: 260, overflowY: "auto",
    },
    sectionLabel: {
      fontSize: 12, fontWeight: 700, color: t.textSecondary,
      padding: "8px 16px 4px", textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    userBio: {
      fontSize: 12, color: t.textSecondary, marginTop: 2,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      maxWidth: mobile ? 180 : 220,
    },

    /* ── Suggestions ── */
    suggestionsSection: {
      borderBottom: `1px solid ${t.border}`,
    },

    /* ── Conversation list ── */
    convList: {},
    convItem: {
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", cursor: "pointer",
      transition: "background 0.15s",
    },
    convInfo: { flex: 1, overflow: "hidden" },
    convTop: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
    },
    convUsername: {
      fontWeight: 700, fontSize: 14, color: t.text, fontFamily,
    },
    convTime: {
      fontSize: 12, color: t.textSecondary, flexShrink: 0,
    },
    convPreview: {
      display: "flex", alignItems: "center",
      fontSize: 12, color: t.textSecondary, marginTop: 2,
    },
    unreadBadge: {
      marginLeft: "auto",
      backgroundColor: t.accentBlue || "#1d9bf0", color: "#fff",
      fontSize: 11, fontWeight: 700,
      padding: "1px 7px", borderRadius: 9999,
      minWidth: 18, textAlign: "center",
    },
    empty: {
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      height: "50vh", textAlign: "center", padding: 24, fontFamily,
    },

    /* ── Avatars ── */
    avatar: {
      width: 48, height: 48, borderRadius: "50%",
      backgroundColor: t.avatarBg || "#ffd700",
      display: "flex", justifyContent: "center", alignItems: "center",
      fontWeight: 800, fontSize: 18, color: "#000",
      overflow: "hidden", flexShrink: 0,
    },
    avatarImg: {
      width: "100%", height: "100%", objectFit: "cover",
    },

    /* ── Chat header ── */
    chatHeader: {
      display: "flex", alignItems: "center", gap: 12,
      padding: mobile ? "8px 16px" : "12px 20px",
      backgroundColor: glass ? "rgba(255,255,255,0.14)" : t.headerBg,
      borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      flexShrink: 0,
      ...(glass && { backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)" }),
    },
    backBtn: {
      background: "none", border: "none", cursor: "pointer",
      padding: 8, display: "flex", borderRadius: "50%",
    },
    chatHeaderInfo: {
      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
    },
    chatAvatar: {
      width: 36, height: 36, borderRadius: "50%",
      backgroundColor: t.avatarBg || "#ffd700",
      display: "flex", justifyContent: "center", alignItems: "center",
      fontWeight: 700, fontSize: 14, color: "#000",
      overflow: "hidden", flexShrink: 0,
    },
    chatAvatarImg: {
      width: "100%", height: "100%", objectFit: "cover",
    },
    chatUsername: {
      fontWeight: 700, fontSize: 15, color: t.text, fontFamily,
    },
    e2eLabel: {
      display: "flex", alignItems: "center",
      fontSize: 11, color: "#00ba7c",
    },

    /* ── Messages area ── */
    messagesArea: {
      flex: 1, overflowY: "auto",
      padding: mobile ? "8px 0 64px" : "8px 0 8px",
    },
    e2eBanner: {
      display: "flex", alignItems: "center", gap: 8,
      justifyContent: "center", padding: "10px 16px",
      margin: "4px 16px 8px", borderRadius: 12,
      backgroundColor: t.inputBg, fontSize: 12,
      color: t.textSecondary, textAlign: "center",
    },

    /* ── Compose bar ── */
    composeBar: {
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 16px",
      backgroundColor: glass ? "rgba(255,255,255,0.14)" : t.headerBg,
      borderTop: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      flexShrink: 0,
      ...(glass && { backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)" }),
      ...(mobile ? { position: "fixed", bottom: 56, left: 0, right: 0, zIndex: 100 } : {}),
    },
    emojiToggle: {
      background: "none", border: "none", cursor: "pointer",
      padding: 6, display: "flex", borderRadius: "50%", flexShrink: 0,
    },
    composeInput: {
      flex: 1, padding: "10px 16px",
      borderRadius: 9999, border: `1px solid ${t.inputBorder}`,
      backgroundColor: t.inputBg, color: t.text,
      fontSize: 15, outline: "none", fontFamily,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: "50%",
      backgroundColor: t.accentBlue || "#1d9bf0", border: "none",
      display: "flex", justifyContent: "center", alignItems: "center",
      cursor: "pointer", flexShrink: 0,
    },

    /* ── Emoji picker ── */
    emojiPicker: {
      maxHeight: 220,
      overflowY: "auto",
      backgroundColor: t.cardBg === "#ffffff" ? "#fff" : (t.cardBg || "#1e1e1e"),
      borderTop: `1px solid ${t.border}`,
      padding: "8px 12px",
      flexShrink: 0,
      ...(mobile ? { position: "fixed", bottom: 112, left: 0, right: 0, zIndex: 101 } : {}),
    },
    emojiSection: {
      marginBottom: 6,
    },
    emojiSectionLabel: {
      fontSize: 11, fontWeight: 700, color: t.textSecondary,
      textTransform: "uppercase", letterSpacing: 0.5,
      padding: "4px 4px 2px", fontFamily,
    },
    emojiGrid: {
      display: "flex", flexWrap: "wrap", gap: 2,
    },
    emojiBtn: {
      background: "none", border: "none", cursor: "pointer",
      fontSize: 22, padding: "3px 5px", borderRadius: 8,
      transition: "background 0.12s",
      lineHeight: 1,
    },

    /* ── Reply bar ── */
    replyBar: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 16px",
      backgroundColor: glass ? "rgba(255,255,255,0.1)" : t.headerBg,
      borderTop: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      flexShrink: 0,
      ...(mobile ? { position: "fixed", bottom: mobile ? 112 : 56, left: 0, right: 0, zIndex: 99 } : {}),
    },
    replyBarContent: {
      flex: 1,
      borderLeft: `3px solid ${t.accentBlue || "#1d9bf0"}`,
      paddingLeft: 10,
      overflow: "hidden",
    },
    replyBarLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: t.accentBlue || "#1d9bf0",
    },
    replyBarText: {
      fontSize: 13,
      color: t.textSecondary,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    replyBarClose: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: t.textSecondary,
      fontSize: 16,
      padding: 6,
      flexShrink: 0,
    },

    /* ── Info modal ── */
    infoModalOverlay: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    infoModalContent: {
      backgroundColor: t.cardBg === "#ffffff" ? "#fff" : "#2a2a2a",
      borderRadius: 16,
      padding: 24,
      minWidth: 280,
      maxWidth: 360,
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    },
  };
}
