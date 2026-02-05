import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { postsAPI } from '../services/api'

export default function CreatePost({ onPostCreated }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return

    setError('')
    setLoading(true)

    try {
      const response = await postsAPI.createPost(content)
      onPostCreated(response.data)
      setContent('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create post')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-post-card">
      <div className="create-post-header">
        <div className="create-post-avatar">{user?.username?.[0]?.toUpperCase()}</div>
        <div className="create-post-content">
          <form onSubmit={handleSubmit} className="create-post-form">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?!"
              className="create-post-textarea"
              maxLength={280}
              disabled={loading}
            />
            {error && <div className="error-message">{error}</div>}
            <div className="create-post-footer">
              <span className="character-count">
                {content.length} / 280
              </span>
              <button
                type="submit"
                className="create-post-button"
                disabled={loading || !content.trim()}
              >
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
