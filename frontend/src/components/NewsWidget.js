import { useEffect, useState, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   NewsWidget — clean headline cards from Google News RSS
   Fetches via backend proxy at /widgets/news
   ═══════════════════════════════════════════════════════════ */

const API_BASE = "/api";

export default function NewsWidget({ theme: t }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/widgets/news?country=in&lang=en`);
      const data = await res.json();
      setArticles((data || []).slice(0, 8));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <div style={{
        borderRadius: 16, padding: 24, textAlign: "center",
        background: t.cardBg, color: t.textSecondary, fontSize: 14,
        minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📰</div>
          Loading news...
        </div>
      </div>
    );
  }

  /* ─── Error state ─── */
  if (error || !articles.length) {
    return (
      <div style={{
        borderRadius: 16, padding: 24, textAlign: "center",
        background: t.cardBg, color: t.textSecondary, fontSize: 14,
        minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📰</div>
          {error ? "Couldn't load news" : "No articles found"}
          <div
            onClick={fetchNews}
            style={{
              marginTop: 8, color: "#1d9bf0", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            Retry
          </div>
        </div>
      </div>
    );
  }

  /* ─── Article cards ─── */
  return (
    <div style={{
      borderRadius: 16,
      background: t.cardBg,
      overflow: "hidden",
      transition: "background-color 0.3s",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px 8px",
        fontWeight: 800, fontSize: 20,
        color: t.text,
      }}>
        Top Headlines
      </div>

      {articles.map((a, i) => (
        <a
          key={i}
          href={a.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            padding: "10px 16px",
            textDecoration: "none",
            color: t.text,
            borderTop: i === 0 ? "none" : `1px solid ${t.border}22`,
            transition: "background 0.15s",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = t.hoverBg || "rgba(255,255,255,0.03)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <div style={{
            fontSize: 14, fontWeight: 500, lineHeight: 1.4,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {a.title}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 4, fontSize: 12, color: t.textSecondary,
          }}>
            {a.source && (
              <span style={{
                fontWeight: 600,
                color: t.textSecondary,
              }}>{a.source}</span>
            )}
            {a.source && a.time_ago && <span>·</span>}
            {a.time_ago && <span>{a.time_ago}</span>}
          </div>
        </a>
      ))}

      {/* Footer */}
      <div style={{
        padding: "12px 16px",
        borderTop: `1px solid ${t.border}22`,
      }}>
        <span
          onClick={fetchNews}
          style={{
            color: "#1d9bf0", fontSize: 14, cursor: "pointer",
            fontWeight: 400,
          }}
        >
          Refresh
        </span>
      </div>
    </div>
  );
}
