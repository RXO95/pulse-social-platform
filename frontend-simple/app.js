const API = "http://127.0.0.1:8000";

// ---------------- AUTH ----------------

async function signup(username, email, password) {
  try {
    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.detail || "Signup failed");
      return;
    }

    alert("Signup successful. Please login.");
    window.location.href = "login.html";
  } catch (e) {
    console.error("Signup error:", e);
    alert("Server error during signup");
  }
}

async function login(email, password) {
  console.log("LOGIN CLICKED", email);

  try {
    const res = await fetch(
      `${API}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      { method: "POST" }
    );

    if (!res.ok) {
      alert("Invalid credentials");
      return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    window.location.href = "index.html";
  } catch (e) {
    console.error("Login error:", e);
    alert("Server error during login");
  }
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

function getToken() {
  return localStorage.getItem("token");
}

// ---------------- POSTS ----------------

async function fetchPosts() {
  try {
    const res = await fetch(`${API}/posts`, {
      headers: {
        Authorization: `Bearer ${getToken()}`
      }
    });

    if (!res.ok) {
      console.warn("Unauthorized or failed fetch");
      logout();
      return;
    }

    const posts = await res.json();
    renderPosts(posts || []);
  } catch (e) {
    console.error("Fetch posts error:", e);
    alert("Could not load feed");
  }
}

async function createPost(content) {
  if (!content.trim()) return;

  try {
    const res = await fetch(`${API}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ content })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Post blocked");
      return;
    }

    document.getElementById("content").value = "";
    fetchPosts();
  } catch (e) {
    console.error("Create post error:", e);
    alert("Could not create post");
  }
}

// ---------------- HELPERS ----------------

// ✅ Convert entity objects → readable text
function formatEntities(entities) {
  if (!entities || entities.length === 0) {
    return "None";
  }

  return entities
    .map(e => `${e.text} (${e.label})`)
    .join(", ");
}

// ---------------- UI ----------------

function renderPosts(posts) {
  const feed = document.getElementById("feed");
  feed.innerHTML = "";

  if (posts.length === 0) {
    feed.innerHTML = "<p style='opacity:0.7'>No posts yet</p>";
    return;
  }

  posts.forEach(p => {
    const div = document.createElement("div");

    div.innerHTML = `
      <strong>@${p.username}</strong>
      <p>${p.content}</p>

      ${
        p.risk_score > 0.6
          ? "<span style='color:#ef4444'>⚠ Risky content</span><br>"
          : ""
      }

      <small style="opacity:0.75">
        <b>Entities:</b> ${formatEntities(p.entities)}
      </small>
    `;

    feed.appendChild(div);
  });
}

// ---------------- GUARD ----------------

function requireAuth() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}
