import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTheme, getTheme } from "../context/ThemeContext";
import DarkModeToggle from "../components/DarkModeToggle";
import BottomNav from "../components/BottomNav";
import Loader from "../components/Loader";
import useIsMobile from "../hooks/useIsMobile";

export default function Trending() {
  const navigate = useNavigate();
  const [trending, setTrending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const token = localStorage.getItem("token");
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const mobile = useIsMobile();
  const styles = getStyles(t, mobile);

  const fetchTrending = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/trending/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrending(data);
      }
    } catch {
      console.error("Failed to load trending");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCurrentUser(await res.json());
      }
    } catch {}
  };

  useEffect(() => {
    fetchTrending();
    fetchCurrentUser();
  }, []);

  const getLabelIcon = (label, color) => {
    switch (label) {
      case "PER": return <svg viewBox="0 0 24 24" width="14" height="14" fill={color}><path d="M12 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0-2C9.79 2 8 3.79 8 6s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.35 0-4.37.85-5.86 2.44-1.48 1.58-2.37 3.8-2.63 6.46l-.11 1.1h17.2l-.11-1.1c-.26-2.66-1.15-4.88-2.63-6.46C16.37 11.85 14.35 11 12 11z"/></svg>;
      case "ORG": return <svg viewBox="0 0 24 24" width="14" height="14" fill={color}><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>;
      case "GPE": return <svg viewBox="0 0 24 24" width="14" height="14" fill={color}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>;
      case "LOC": return <svg viewBox="0 0 24 24" width="14" height="14" fill={color}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>;
      default: return <svg viewBox="0 0 24 24" width="14" height="14" fill={color}><circle cx="12" cy="12" r="8"/></svg>;
    }
  };

  const getLabelName = (label) => {
    switch (label) {
      case "PER": return "Person";
      case "ORG": return "Organization";
      case "GPE": return "Location";
      case "LOC": return "Place";
      default: return "Topic";
    }
  };

  return (
    <div style={styles.fullScreenWrapper}>
      <header style={styles.navBar}>
        <div style={styles.navContent}>
          <button onClick={() => navigate("/feed")} style={styles.backButton}>← Back</button>
          <h3 style={{margin: 0, color: t.text}}>Trending</h3>
          <div style={{marginLeft: "auto"}}><DarkModeToggle /></div>
        </div>
      </header>

      <div style={styles.scrollArea}>
        <div style={styles.headerSection}>
          <h2 style={styles.pageTitle}>What's happening</h2>
          <p style={styles.subtitle}>Trending topics from the last 24 hours</p>
        </div>

        {isLoading ? (
          <div style={{padding: 40, display: "flex", justifyContent: "center"}}>
            <Loader />
          </div>
        ) : trending.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{color: t.textSecondary}}>No trending topics right now</p>
            <p style={{color: t.textSecondary, fontSize: "14px"}}>Be the first to post about something!</p>
          </div>
        ) : (
          <div style={styles.trendingList}>
            {trending.map((item, idx) => (
              <div 
                key={idx} 
                style={styles.trendingCard}
                onClick={() => navigate(`/entity/${encodeURIComponent(item.topic)}`)}
              >
                <div style={styles.trendingRank}>#{idx + 1}</div>
                <div style={styles.trendingContent}>
                  <div style={styles.trendingHeader}>
                    <span style={styles.labelBadge}>
                      {getLabelIcon(item.label, t.textSecondary)} {getLabelName(item.label)}
                    </span>
                  </div>
                  <div style={styles.trendingTopic}>{item.topic}</div>
                  <div style={styles.trendingMeta}>
                    {item.count} {item.count === 1 ? 'post' : 'posts'}
                  </div>
                </div>
                <div style={styles.arrowIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={t.textSecondary}><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {mobile && <BottomNav currentUser={currentUser} />}
    </div>
  );
}

function getStyles(t, m) { return {
  fullScreenWrapper: { 
    height: "100vh", 
    display: "flex", 
    flexDirection: "column", 
    backgroundColor: t.bg, 
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: t.text,
    transition: "background-color 0.3s"
  },
  navBar: { 
    height: "53px", 
    backgroundColor: t.headerBg, 
    borderBottom: `1px solid ${t.border}`, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(12px)"
  },
  navContent: { 
    width: "100%", 
    maxWidth: "600px", 
    display: "flex", 
    alignItems: "center", 
    gap: m ? "12px" : "20px",
    padding: m ? "0 12px" : "0 20px"
  },
  backButton: { 
    background: "none", 
    border: "none", 
    fontSize: "16px", 
    cursor: "pointer", 
    color: t.accentBlue, 
    fontWeight: "600"
  },
  scrollArea: { 
    flex: 1, 
    overflowY: "auto", 
    maxWidth: "600px", 
    width: "100%", 
    margin: "0 auto",
    paddingBottom: m ? "70px" : "0",
    borderLeft: m ? "none" : `1px solid ${t.border}`,
    borderRight: m ? "none" : `1px solid ${t.border}`
  },
  headerSection: {
    padding: m ? "20px 16px" : "24px 20px",
    borderBottom: `1px solid ${t.border}`
  },
  pageTitle: {
    fontSize: m ? "22px" : "24px",
    fontWeight: "800",
    margin: 0,
    color: t.text
  },
  subtitle: {
    fontSize: "14px",
    color: t.textSecondary,
    margin: "4px 0 0"
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px"
  },
  trendingList: {
    display: "flex",
    flexDirection: "column"
  },
  trendingCard: {
    display: "flex",
    alignItems: "center",
    padding: m ? "16px" : "16px 20px",
    borderBottom: `1px solid ${t.border}`,
    cursor: "pointer",
    transition: "background-color 0.15s",
    gap: "16px"
  },
  trendingRank: {
    fontSize: m ? "18px" : "20px",
    fontWeight: "800",
    color: t.textSecondary,
    width: "32px",
    flexShrink: 0
  },
  trendingContent: {
    flex: 1,
    minWidth: 0
  },
  trendingHeader: {
    marginBottom: "4px"
  },
  labelBadge: {
    fontSize: "12px",
    color: t.textSecondary,
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "4px"
  },
  trendingTopic: {
    fontSize: m ? "16px" : "17px",
    fontWeight: "700",
    color: t.text,
    marginBottom: "4px"
  },
  trendingMeta: {
    fontSize: "13px",
    color: t.textSecondary
  },
  arrowIcon: {
    color: t.textSecondary,
    fontSize: "18px",
    flexShrink: 0
  }
}; }
