import { useTheme, getTheme } from "../context/ThemeContext";
import useIsMobile from "../hooks/useIsMobile";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════
   Settings — Theme / Background options
   ═══════════════════════════════════════════════════════════ */

const BACKGROUNDS = [
  {
    id: "none",
    label: "Default",
    desc: "Use light / dark mode",
    preview: null, // uses the toggle instead
  },
  {
    id: "matrix",
    label: "Indic Matrix",
    desc: "Animated Hindi, Bangla & Kannada script grid",
    gradient: "linear-gradient(135deg, #020206 0%, #0a1628 50%, #1a0a2e 100%)",
    previewChars: "अ আ ಅ ঈ ক ಕ",
  },
];

export default function Settings() {
  const { darkMode, toggleDarkMode, background, setBackground } = useTheme();
  const t = getTheme(darkMode, background);
  const m = useIsMobile();
  const navigate = useNavigate();

  const selectBg = (id) => {
    setBackground(id);
    if (id !== "none") {
      // Custom backgrounds force dark mode colours, so ensure darkMode is true
      if (!darkMode) toggleDarkMode();
    }
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      overflow: "hidden", height: "100%",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        height: 53, display: "flex", alignItems: "center",
        padding: "0 16px", gap: 24,
        borderBottom: `1px solid ${t.border}`,
        backgroundColor: t.headerBg,
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        {m && (
          <button
            onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: t.text, padding: 4 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
            </svg>
          </button>
        )}
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: t.text }}>Settings</h2>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1, overflowY: "auto",
        maxWidth: 600, width: "100%",
        borderLeft: m ? "none" : `1px solid ${t.border}`,
        borderRight: m ? "none" : `1px solid ${t.border}`,
        paddingBottom: m ? 80 : 40,
      }}>
        {/* ── Theme section ── */}
        <div style={{ padding: "20px 16px 8px" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: t.text }}>
            Theme & Background
          </h3>
          <p style={{ fontSize: 14, color: t.textSecondary, margin: "4px 0 0" }}>
            Choose how Pulse looks for you
          </p>
        </div>

        {/* Light / Dark toggle (only when no custom background) */}
        {background === "none" && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px", margin: "0 16px", borderRadius: 12,
            backgroundColor: t.cardBg, marginTop: 12,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Dark Mode</div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>
                {darkMode ? "On" : "Off"}
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              style={{
                width: 52, height: 28, borderRadius: 14, border: "none",
                cursor: "pointer", position: "relative",
                transition: "background 0.3s",
                background: darkMode ? "#1d9bf0" : "#ccc",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 11,
                background: "#fff", position: "absolute", top: 3,
                left: darkMode ? 27 : 3,
                transition: "left 0.3s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>
        )}

        {/* Background options grid */}
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            Background
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}>
            {BACKGROUNDS.map((bg) => {
              const selected = background === bg.id;
              return (
                <div
                  key={bg.id}
                  onClick={() => selectBg(bg.id)}
                  style={{
                    borderRadius: 16,
                    border: `2px solid ${selected ? "#1d9bf0" : t.border}`,
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "border-color 0.2s, transform 0.15s",
                    transform: selected ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  {/* Preview */}
                  <div style={{
                    height: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    ...(bg.id === "none" ? {
                      background: darkMode
                        ? "linear-gradient(135deg, #000 50%, #16181c 50%)"
                        : "linear-gradient(135deg, #fff 50%, #f7f9f9 50%)",
                    } : {
                      background: bg.gradient || "#020206",
                    }),
                  }}>
                    {bg.id === "none" ? (
                      <div style={{ display: "flex", gap: 2 }}>
                        <div style={{
                          width: 32, height: 20, borderRadius: 4,
                          background: "#fff", border: "1px solid #ddd",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "#333",
                        }}>Li</div>
                        <div style={{
                          width: 32, height: 20, borderRadius: 4,
                          background: "#16181c", border: "1px solid #333",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "#e7e9ea",
                        }}>Dk</div>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: 22, letterSpacing: 4,
                        color: "rgba(80, 180, 255, 0.5)",
                        fontFamily: '"Noto Sans Devanagari", sans-serif',
                        textShadow: "0 0 8px rgba(80,180,255,0.3)",
                      }}>
                        {bg.previewChars}
                      </div>
                    )}

                    {/* Selected check */}
                    {selected && (
                      <div style={{
                        position: "absolute", top: 6, right: 6,
                        width: 22, height: 22, borderRadius: 11,
                        background: "#1d9bf0", display: "flex",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div style={{
                    padding: "10px 12px",
                    backgroundColor: t.cardBg,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                      {bg.label}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                      {bg.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hint */}
        <div style={{
          padding: "8px 16px 24px", fontSize: 13,
          color: t.textSecondary, lineHeight: 1.5,
        }}>
          Custom backgrounds use dark theme colours to keep content readable. More backgrounds coming soon!
        </div>
      </div>
    </div>
  );
}
