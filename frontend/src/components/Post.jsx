import React from 'react'

export default function Post({ post, onLike }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-author-info">
          <h3 className="post-author-name">{post.username}</h3>
          <span className="post-timestamp">{formatDate(post.created_at)}</span>
        </div>
      </div>

      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {post.entities && post.entities.length > 0 && (
        <div className="post-entities">
          <strong>Entities:</strong> {post.entities.join(', ')}
        </div>
      )}

      {post.risk_score > 0.6 && (
        <div className="post-warning">
          <span>⚠️ High-risk content</span>
        </div>
      )}

      <div className="post-footer">
        <button
          className="post-like-button"
          onClick={onLike}
        >
          ❤️ {post.likes} Likes
        </button>
      </div>
    </div>
  )
}
