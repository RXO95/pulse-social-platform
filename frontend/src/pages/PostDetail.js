import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import LikeButton from "../components/LikeButton";

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const token = localStorage.getItem("token");

  // Fetch Post Details
  const fetchPost = async () => {
    try {
      const res = await fetch(`${API}/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      } else {
        alert("Post not found");
        navigate("/feed");
      }
    } catch {
      console.error("Failed to load post");
    }
  };

  // Fetch Comments (Manual User Notes)
  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API}/comments/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch {
      console.error("Failed to load comments");
    }
  };

  // Add a New Comment
  const handleSubmitNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch(`${API}/comments/${postId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newNote })
      });
      
      if (res.ok) {
        setNewNote("");
        fetchNotes(); // Refresh list
      }
    } catch {
      alert("Failed to add comment");
    }
  };

  useEffect(() => {
    fetchPost();
    fetchNotes();
  }, [postId]);

  if (!post) return <div style={{textAlign:"center", marginTop: 50}}>Loading...</div>;

  // --- HELPER: Context Box Component ---
  const renderContextBox = () => {
    const ctx = post.context_data;
    if (!ctx || !ctx.is_generated) return null;

    return (
      <div style={styles.contextBox}>
        <div style={styles.contextHeader}>
          <span style={{fontSize: "18px"}}>ℹ️</span> 
          <strong>Pulse Context</strong> 
          <span style={styles.aiBadge}>AI Generated</span>
        </div>

        {/* Disambiguation Section */}
        {ctx.disambiguation && ctx.disambiguation.length > 0 && (
          <div style={styles.contextSection}>
            <p style={styles.contextLabel}>Entity Clarification:</p>
            <ul style={styles.contextList}>
              {ctx.disambiguation.map((item, idx) => (
                <li key={idx}>
                  <strong>{item.entity}</strong> is identified as <strong>{item.identified_as}</strong>
                  <div style={{color: "#555", fontSize: "13px", marginTop: "2px"}}>
                    {item.description}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* News Section */}
        {ctx.news && (
          <div style={styles.contextSection}>
            <p style={styles.contextLabel}>Related Context:</p>
            <div style={styles.newsCard}>
              <a href={ctx.news.url} target="_blank" rel="noopener noreferrer" style={styles.newsLink}>
                {ctx.news.headline}
              </a>
              <div style={{fontSize: "11px", color: "#888", marginTop: "4px"}}>Source: Google News</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.navBar}>
        <button onClick={() => navigate(-1)} style={styles.backButton}>← Back</button>
        <h3 style={{margin:0}}>Post Details</h3>
      </div>

      {/* MAIN POST CARD */}
      <div style={styles.card}>
        <div style={styles.header}>
           <div style={styles.avatar}>{post.username?.charAt(0).toUpperCase()}</div>
           <strong style={{fontSize: "16px"}}>@{post.username}</strong>
        </div>
        
        <p style={styles.content}>{post.content}</p>

        {/* NER TAGS */}
        <div style={styles.entityContainer}>
            {post.entities?.map((e, idx) => (
              <span key={idx} style={styles.tag}>
                {e.text} <small style={styles.tagLabel}>{e.label}</small>
              </span>
            ))}
        </div>

        {/* --- PULSE CONTEXT BOX (Inserted Here) --- */}
        {renderContextBox()}

        <div style={{marginTop: 15, paddingTop: 10, borderTop: "1px solid #f0f0f0"}}>
           <small style={{color:"#666"}}>{new Date(post.created_at).toLocaleString()}</small>
        </div>
      </div>

      {/* COMMENTS SECTION */}
      <div style={styles.notesSection}>
        <h4 style={styles.sectionTitle}>Comments</h4>
        
        <div style={styles.inputGroup}>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a comment..."
            style={styles.textarea}
          />
          <button onClick={handleSubmitNote} style={styles.postBtn}>Post</button>
        </div>

        <div style={styles.notesList}>
          {notes.map((note) => (
            <div key={note._id} style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <strong>@{note.username}</strong>
                <small style={{color:"#888"}}>{new Date(note.created_at).toLocaleDateString()}</small>
              </div>
              <p style={{margin:"5px 0", fontSize:"14px"}}>{note.content}</p>
            </div>
          ))}
          {notes.length === 0 && <p style={{color:"#888", fontStyle:"italic"}}>No comments yet.</p>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: "600px", margin: "0 auto", padding: "0 10px 50px", fontFamily: "sans-serif" },
  navBar: { display: "flex", gap: "20px", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee" },
  backButton: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "#1d9bf0" },
  
  card: { backgroundColor: "#fff", border: "1px solid #eee", borderRadius: "12px", padding: "20px", marginTop: "20px" },
  header: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" },
  avatar: { width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" },
  content: { fontSize: "18px", lineHeight: "1.5", margin: "10px 0" },
  
  entityContainer: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "15px", marginBottom: "20px" },
  tag: { backgroundColor: "#e8f5fd", color: "#1d9bf0", padding: "4px 10px", borderRadius: "15px", fontSize: "13px" },
  tagLabel: { color: "#536471", fontSize: "11px", marginLeft: "4px" },

  // --- CONTEXT BOX STYLES ---
  contextBox: {
    backgroundColor: "#F9F9F9", // Very light gray, distinct from white
    border: "1px solid #E1E8ED",
    borderRadius: "8px",
    padding: "15px",
    marginTop: "15px",
    marginBottom: "15px"
  },
  contextHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
    borderBottom: "1px solid #E1E8ED",
    paddingBottom: "8px",
    color: "#2F3336"
  },
  aiBadge: {
    backgroundColor: "#E8F5FD",
    color: "#1DA1F2",
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: "bold",
    textTransform: "uppercase"
  },
  contextSection: {
    marginBottom: "12px"
  },
  contextLabel: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "#536471",
    textTransform: "uppercase",
    marginBottom: "6px"
  },
  contextList: {
    listStyleType: "disc",
    paddingLeft: "20px",
    margin: 0,
    fontSize: "14px",
    color: "#0F1419"
  },
  newsCard: {
    backgroundColor: "#fff",
    border: "1px solid #cfd9de",
    borderRadius: "6px",
    padding: "10px"
  },
  newsLink: {
    color: "#1d9bf0",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "14px",
    display: "block"
  },

  notesSection: { marginTop: "30px" },
  sectionTitle: { fontSize: "18px", fontWeight: "bold", marginBottom: "15px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" },
  textarea: { padding: "12px", borderRadius: "8px", border: "1px solid #ddd", resize: "none", height: "60px", fontFamily: "sans-serif" },
  postBtn: { alignSelf: "flex-end", backgroundColor: "#1d9bf0", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" },
  
  notesList: { display: "flex", flexDirection: "column", gap: "12px" },
  noteCard: { backgroundColor: "#f8f9fa", borderRadius: "8px", padding: "12px", border: "1px solid #eee" },
  noteHeader: { display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "13px" }
};