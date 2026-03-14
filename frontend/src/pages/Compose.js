import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api/api";
import { useTheme, getTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import GifPicker from "../components/GifPicker";
import useIsMobile from "../hooks/useIsMobile";

export default function Compose() {
  const toast = useToast();
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [gifUrl, setGifUrl] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [quotePost, setQuotePost] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const mediaInputRef = useRef(null);
  const textareaRef = useRef(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quotePostId = searchParams.get("quote");
  const token = localStorage.getItem("token");
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const mobile = useIsMobile();
  const glass = background && background !== "none";

  // Fetch quote post if applicable
  useEffect(() => {
    if (quotePostId) {
      (async () => {
        try {
          const res = await fetch(`${API}/posts/${quotePostId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) setQuotePost(await res.json());
        } catch {}
      })();
    }
    fetchDrafts();
    setTimeout(() => textareaRef.current?.focus(), 200);
  }, [quotePostId, token]);

  const fetchDrafts = async () => {
    try {
      const res = await fetch(`${API}/drafts/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDrafts(await res.json());
    } catch {}
  };

  const saveDraft = async () => {
    if (!content.trim() && !gifUrl) return;
    try {
      await fetch(`${API}/drafts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: content.trim(), gif_url: gifUrl || null }),
      });
      setContent("");
      setGifUrl(null);
      clearMedia();
      fetchDrafts();
      navigate(-1);
    } catch { toast("Could not save draft", "error"); }
  };

  const loadDraft = (draft) => {
    setContent(draft.content || "");
    setGifUrl(draft.gif_url || null);
    setShowDrafts(false);
    fetch(`${API}/drafts/${draft._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then(() => fetchDrafts()).catch(() => {});
  };

  const deleteDraft = async (draftId) => {
    try {
      await fetch(`${API}/drafts/${draftId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDrafts();
    } catch {}
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
      setGifUrl(null); // clear GIF if media selected
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const handleGifSelect = (url) => {
    setGifUrl(url);
    setShowGifPicker(false);
    clearMedia(); // clear file media if GIF selected
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaFile && !gifUrl) return;
    setIsPosting(true);

    try {
      // If it's a quote repost
      if (quotePostId) {
        const res = await fetch(`${API}/reposts/${quotePostId}/quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: content.trim() }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast(data.detail || "Quote failed", "error");
          return;
        }
        navigate("/feed");
        return;
      }

      // Regular post
      let finalContent = content.trim() || " ";
      // If GIF, append as media_url in content (stored inline)
      if (gifUrl && !mediaFile) {
        // Post with GIF URL as media
        const formData = new FormData();
        formData.append("content", finalContent);
        // We'll send gif_url as part of content for now, or use a special endpoint
        // Actually, let's send as regular post and add gif_url field
        const res = await fetch(`${API}/posts/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: finalContent, gif_url: gifUrl }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast(data.detail?.message || data.detail || "Post blocked", "error");
          return;
        }
      } else if (mediaFile) {
        const formData = new FormData();
        formData.append("content", finalContent);
        formData.append("media", mediaFile);
        const res = await fetch(`${API}/posts/with-media`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json();
          toast(data.detail?.message || data.detail || "Post blocked", "error");
          return;
        }
      } else {
        const res = await fetch(`${API}/posts/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: finalContent }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast(data.detail?.message || data.detail || "Post blocked", "error");
          return;
        }
      }
      navigate("/feed");
    } catch {
      toast("Could not create post", "error");
    } finally {
      setIsPosting(false);
    }
  };

  const s = getStyles(t, mobile, glass);

  return (
    <div style={s.wrapper}>
      {/* Header */}
      <header style={s.header}>
        <button onClick={() => navigate(-1)} style={s.closeBtn}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
          </svg>
        </button>
        <span style={{ flex: 1 }} />
        {(content.trim() || gifUrl) && !quotePostId && (
          <button onClick={saveDraft} style={s.draftBtn}>
            Draft
          </button>
        )}
        <button
          onClick={handlePost}
          disabled={isPosting || (!content.trim() && !mediaFile && !gifUrl)}
          style={{
            ...s.postBtn,
            opacity: content.trim() || mediaFile || gifUrl ? 1 : 0.5,
          }}
        >
          {isPosting ? "Posting..." : quotePostId ? "Quote" : "Post"}
        </button>
      </header>

      {/* Body */}
      <div style={s.body}>
        <textarea
          ref={textareaRef}
          placeholder={quotePostId ? "Add a comment..." : "What's happening?"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={s.textarea}
        />

        {/* Media preview */}
        {mediaPreview && (
          <div style={s.previewBox}>
            <button onClick={clearMedia} style={s.removeBtn}>✕</button>
            {mediaType === "video" ? (
              <video src={mediaPreview} controls style={s.previewMedia} />
            ) : (
              <img src={mediaPreview} alt="Preview" style={s.previewMedia} />
            )}
          </div>
        )}

        {/* GIF preview */}
        {gifUrl && !mediaPreview && (
          <div style={s.previewBox}>
            <button onClick={() => setGifUrl(null)} style={s.removeBtn}>✕</button>
            <img src={gifUrl} alt="GIF" style={s.previewMedia} />
          </div>
        )}

        {/* Quoted post preview */}
        {quotePost && (
          <div style={s.quoteCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={s.quoteAvatar}>
                {quotePost.profile_pic_url ? (
                  <img src={quotePost.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  quotePost.username?.charAt(0).toUpperCase()
                )}
              </div>
              <strong style={{ color: t.text, fontSize: 14 }}>@{quotePost.username}</strong>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: t.textSecondary, lineHeight: 1.4 }}>
              {quotePost.content?.length > 200 ? quotePost.content.slice(0, 200) + "..." : quotePost.content}
            </p>
            {quotePost.media_url && (
              <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden", maxHeight: 150 }}>
                <img src={quotePost.media_url} alt="" style={{ width: "100%", objectFit: "cover", maxHeight: 150 }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <input type="file" ref={mediaInputRef} accept="image/*,video/*" onChange={handleMediaSelect} style={{ display: "none" }} />
        <button onClick={() => mediaInputRef.current?.click()} style={s.toolBtn} title="Photo/video">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7C8.784 7 8 7.784 8 8.75s.784 1.75 1.75 1.75 1.75-.784 1.75-1.75S10.716 7 9.75 7z" />
          </svg>
        </button>
        <button onClick={() => setShowGifPicker(true)} style={s.toolBtn} title="GIF">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M3 5.5A2.5 2.5 0 015.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13zM5.5 5c-.28 0-.5.22-.5.5v13c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-13c0-.28-.22-.5-.5-.5h-13zM8 10h1.5v4H8v-4zm2.5 0H13c.55 0 1 .45 1 1v.5h-1.5v-.25h-1v2.5h1v-.25H14v.5c0 .55-.45 1-1 1h-2.5v-5zm4.5 0h3v1.25h-1.75v.5H18v1.25h-1.75V14H14.5v-4z" />
          </svg>
        </button>
        {drafts.length > 0 && (
          <div style={{ position: "relative", marginLeft: "auto" }}>
            <button onClick={() => setShowDrafts(!showDrafts)} style={s.draftsBtn} title="Load a draft">
              {drafts.length} draft{drafts.length > 1 ? "s" : ""}
            </button>
            {showDrafts && (
              <div style={s.draftsPanel}>
                <div style={s.draftsPanelHeader}>Your Drafts</div>
                {drafts.map((d) => (
                  <div key={d._id} style={s.draftItem}>
                    <div style={s.draftItemContent} onClick={() => loadDraft(d)}>
                      {d.content?.length > 80 ? d.content.slice(0, 80) + "..." : d.content || "(GIF only)"}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteDraft(d._id); }} style={s.draftItemDelete}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
          theme={t}
        />
      )}
    </div>
  );
}

function getStyles(t, m, glass) {
  return {
    wrapper: {
      flex: 1, display: "flex", flexDirection: "column",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: t.text, overflow: "hidden",
    },
    header: {
      height: 53, display: "flex", alignItems: "center",
      padding: "0 16px", gap: 12,
      backgroundColor: glass ? "rgba(255,255,255,0.14)" : t.headerBg,
      borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      backdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)",
      WebkitBackdropFilter: glass ? "blur(40px) saturate(1.8)" : "blur(12px)",
    },
    closeBtn: {
      background: "none", border: "none", cursor: "pointer",
      color: t.text, padding: 8, borderRadius: "50%",
      display: "flex", alignItems: "center",
    },
    postBtn: {
      backgroundColor: t.accentBlue || "#1d9bf0", color: "#fff",
      border: "none", borderRadius: 9999, padding: "8px 20px",
      fontWeight: 700, fontSize: 15, cursor: "pointer",
    },
    body: {
      flex: 1, overflowY: "auto", padding: m ? 16 : 20,
      maxWidth: 600, width: "100%", margin: "0 auto",
      borderLeft: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      borderRight: m ? "none" : `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      ...(glass && {
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        backgroundColor: "rgba(255,255,255,0.1)",
      }),
    },
    textarea: {
      width: "100%", minHeight: 150, border: "none", outline: "none",
      resize: "none", fontSize: 20, lineHeight: 1.35,
      backgroundColor: "transparent", color: t.text,
      fontFamily: "inherit",
    },
    previewBox: {
      position: "relative", marginTop: 12, borderRadius: 16,
      overflow: "hidden", border: `1px solid ${t.border}`,
    },
    removeBtn: {
      position: "absolute", top: 8, right: 8, zIndex: 2,
      width: 32, height: 32, borderRadius: "50%",
      backgroundColor: "rgba(0,0,0,0.7)", color: "#fff",
      border: "none", cursor: "pointer", fontSize: 16,
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    previewMedia: {
      width: "100%", maxHeight: 400, objectFit: "cover", display: "block",
    },
    quoteCard: {
      marginTop: 16, padding: 14, borderRadius: 16,
      border: `1px solid ${t.border}`,
      backgroundColor: glass ? "rgba(255,255,255,0.08)" : (t.inputBg || t.bg),
    },
    quoteAvatar: {
      width: 24, height: 24, borderRadius: "50%",
      backgroundColor: t.avatarBg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: "#1a1a1a",
      overflow: "hidden", flexShrink: 0,
    },
    toolbar: {
      display: "flex", alignItems: "center", gap: 4,
      padding: "12px 16px",
      borderTop: `1px solid ${glass ? "rgba(255,255,255,0.18)" : t.border}`,
      backgroundColor: glass ? "rgba(255,255,255,0.14)" : t.headerBg,
      backdropFilter: glass ? "blur(40px) saturate(1.8)" : undefined,
      maxWidth: 600, width: "100%", margin: "0 auto",
    },
    toolBtn: {
      background: "none", border: "none", cursor: "pointer",
      color: t.accentBlue || "#1d9bf0", padding: 8,
      borderRadius: "50%", display: "flex",
      alignItems: "center", justifyContent: "center",
    },
    draftBtn: {
      backgroundColor: "transparent", color: t.textSecondary,
      border: `1px solid ${t.border}`, borderRadius: 9999,
      padding: "8px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer",
    },
    draftsBtn: {
      background: "none", border: "none", color: t.accentBlue || "#1d9bf0",
      cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "6px 8px",
    },
    draftsPanel: {
      position: "absolute", bottom: "100%", left: 0, right: 0, minWidth: 280,
      maxHeight: 260, overflowY: "auto",
      backgroundColor: glass ? "rgba(30,30,30,0.95)" : t.cardBg,
      border: `1px solid ${glass ? "rgba(255,255,255,0.2)" : t.border}`,
      borderRadius: 12, boxShadow: "0 -4px 20px rgba(0,0,0,0.3)", zIndex: 100,
      backdropFilter: glass ? "blur(40px)" : undefined,
    },
    draftsPanelHeader: {
      padding: "10px 14px", fontWeight: 700, fontSize: 14, color: t.text,
      borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.15)" : t.border}`,
    },
    draftItem: {
      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
      borderBottom: `1px solid ${glass ? "rgba(255,255,255,0.08)" : t.border}`,
      cursor: "pointer",
    },
    draftItemContent: {
      flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 1.4,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    },
    draftItemDelete: {
      background: "none", border: "none", color: "#e0245e",
      cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0,
    },
  };
}
