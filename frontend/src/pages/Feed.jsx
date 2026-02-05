import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postsAPI } from '../services/api'
import Post from '../components/Post'
import CreatePost from '../components/CreatePost'

export default function Feed() {
  const { user, logout } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setError('')
      const response = await postsAPI.getPosts()
      setPosts(response.data)
    } catch (err) {
      setError('Failed to load posts')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts])
  }

  const handleLike = async (postId) => {
    try {
      await postsAPI.likePost(postId)
      setPosts(posts.map(post =>
        post._id === postId ? { ...post, likes: post.likes + 1 } : post
      ))
    } catch (err) {
      console.error('Failed to like post:', err)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1 className="feed-title">Pulse</h1>
        <div className="feed-user-section">
          <span className="feed-username">{user?.username}</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      <div className="feed-content">
        <div className="feed-sidebar">
          <div className="feed-card">
            <h2>Home</h2>
            <p>Your feed</p>
          </div>
        </div>

        <div className="feed-main">
          <CreatePost onPostCreated={handlePostCreated} />

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="empty-state">No posts yet. Be the first to post!</div>
          ) : (
            <div className="posts-list">
              {posts.map(post => (
                <Post
                  key={post._id}
                  post={post}
                  onLike={() => handleLike(post._id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="feed-sidebar">
          <div className="feed-card">
            <h2>What's happening</h2>
            <p>Trending topics will appear here</p>
          </div>
        </div>
      </div>
    </div>
  )
}
