"""
Bookmarks Routes

Allows users to save/bookmark posts for later viewing.
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/bookmarks", tags=["Bookmarks"])


@router.post("/{post_id}")
async def toggle_bookmark(post_id: str, user=Depends(get_current_user)):
    """
    Toggle bookmark on a post. If already bookmarked, removes it.
    """
    user_id = user["user_id"]
    
    # Check post exists
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")
    
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already bookmarked
    existing = await db.bookmarks.find_one({
        "post_id": post_id,
        "user_id": user_id
    })
    
    if existing:
        # Remove bookmark
        await db.bookmarks.delete_one({"_id": existing["_id"]})
        return {"message": "Bookmark removed", "bookmarked": False}
    else:
        # Add bookmark
        await db.bookmarks.insert_one({
            "post_id": post_id,
            "user_id": user_id,
            "created_at": datetime.utcnow()
        })
        return {"message": "Post bookmarked", "bookmarked": True}


@router.get("/")
async def get_my_bookmarks(user=Depends(get_current_user)):
    """
    Get all bookmarked posts for the current user.
    Includes full post data with enrichments.
    """
    user_id = user["user_id"]
    
    # Get bookmark records sorted by most recent
    bookmarks_cursor = (
        db.bookmarks
        .find({"user_id": user_id})
        .sort("created_at", -1)
    )
    
    posts = []
    async for bookmark in bookmarks_cursor:
        post_id = bookmark["post_id"]
        
        # Fetch the actual post
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
        if not post:
            continue  # Post may have been deleted
        
        post["_id"] = str(post["_id"])
        
        # Enrichments
        comment_count = await db.comments.count_documents({"post_id": post_id})
        post["comment_count"] = comment_count
        
        is_liked = await db.likes.find_one({"post_id": post_id, "user_id": user_id})
        post["is_liked_by_user"] = bool(is_liked)
        
        post["is_bookmarked"] = True
        post["bookmarked_at"] = bookmark["created_at"]
        
        posts.append(post)
    
    return {
        "count": len(posts),
        "bookmarks": posts
    }


@router.delete("/{post_id}")
async def remove_bookmark(post_id: str, user=Depends(get_current_user)):
    """
    Explicitly remove a bookmark (alternative to toggle).
    """
    user_id = user["user_id"]
    
    result = await db.bookmarks.delete_one({
        "post_id": post_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    
    return {"message": "Bookmark removed"}
