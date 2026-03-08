import { useState, useEffect, useRef, useCallback } from "react";
import API from "../api/api";

/**
 * GifPicker - Tenor-powered GIF search & select.
 * Props:
 *   onSelect(gifUrl)  – called when user picks a GIF
 *   onClose()         – close the picker
 *   theme             – theme object (t)
 */
export default function GifPicker({ onSelect, onClose, theme: t }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextPos, setNextPos] = useState("");
  const inputRef = useRef(null);
  const token = localStorage.getItem("token");
  const debounceRef = useRef(null);

  const fetchGifs = useCallback(async (q, pos = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q || "trending", limit: "20" });
      if (pos) params.set("pos", pos);
      const res = await fetch(`${API}/widgets/gifs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (pos) {
          setGifs((prev) => [...prev, ...data.results]);
        } else {
          setGifs(data.results);
        }
        setNextPos(data.next || "");
      }
    } catch {
      console.error("GIF fetch failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchGifs("trending");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [fetchGifs]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGifs(query || "trending");
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchGifs]);

  const loadMore = () => {
    if (nextPos && !loading) {
      fetchGifs(query || "trending", nextPos);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000, padding: 16,
    }} onClick={onClose}>
      <div style={{
        width: "100%", maxWidth: 480, maxHeight: "80vh",
        backgroundColor: t?.cardBg || "#1a1a2e",
        borderRadius: 16, overflow: "hidden",
        display: "flex", flexDirection: "column",
        border: `1px solid ${t?.border || "rgba(255,255,255,0.15)"}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px",
          borderBottom: `1px solid ${t?.border || "rgba(255,255,255,0.1)"}`,
        }}>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: t?.text || "#fff",
            cursor: "pointer", fontSize: 20, padding: 4,
          }}>✕</button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search GIFs..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 9999,
              border: `1px solid ${t?.border || "rgba(255,255,255,0.15)"}`,
              backgroundColor: t?.inputBg || "rgba(255,255,255,0.08)",
              color: t?.text || "#fff", fontSize: 15, outline: "none",
            }}
          />
        </div>

        {/* Grid */}
        <div style={{
          flex: 1, overflowY: "auto", padding: 8,
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6,
          alignContent: "start",
        }}>
          {gifs.map((g) => (
            <div
              key={g.id}
              onClick={() => onSelect(g.url)}
              style={{
                cursor: "pointer", borderRadius: 8, overflow: "hidden",
                position: "relative", paddingBottom: "75%",
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            >
              <img
                src={g.preview || g.url}
                alt={g.title}
                loading="lazy"
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%", objectFit: "cover",
                }}
              />
            </div>
          ))}
          {loading && (
            <div style={{
              gridColumn: "1 / -1", textAlign: "center",
              padding: 20, color: t?.textSecondary || "#888",
            }}>Loading...</div>
          )}
        </div>

        {/* Load more */}
        {nextPos && !loading && (
          <button onClick={loadMore} style={{
            padding: "12px", border: "none",
            backgroundColor: "transparent",
            color: t?.accentBlue || "#1d9bf0",
            fontWeight: 600, fontSize: 14, cursor: "pointer",
            borderTop: `1px solid ${t?.border || "rgba(255,255,255,0.1)"}`,
          }}>
            Load more
          </button>
        )}

        {/* Tenor attribution */}
        <div style={{
          padding: "8px 16px", textAlign: "center",
          fontSize: 11, color: t?.textSecondary || "#888",
          borderTop: `1px solid ${t?.border || "rgba(255,255,255,0.1)"}`,
        }}>
          Powered by Tenor
        </div>
      </div>
    </div>
  );
}
