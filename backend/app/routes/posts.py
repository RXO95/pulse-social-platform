from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from datetime import datetime
from bson import ObjectId
from typing import Optional

from app.models.post import PostCreate
from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.ml_client import analyze_text
from app.services.cloudinary_helper import upload_to_cloudinary

router = APIRouter(prefix="/posts", tags=["Posts"])


# Helper function to create post document
async def _create_post_common(content: str, user: dict, media_url: str = None, media_type: str = None):
    """Common post creation logic"""
    # 🔍 Analyze content using ML service
    try:
        analysis = await analyze_text(content)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail="ML service unavailable"
        )

    # ❌ Block high-risk content
    if analysis.get("risk_score", 0) > 0.6:
        raise HTTPException(
            status_code=403,
            detail="Post blocked due to sensitive or harmful content"
        )

    # ✅ Allowed post
    new_post = {
        "user_id": user["user_id"],
        "username": user["username"],
        "content": content,
        "entities": analysis.get("entities", []),
        "risk_score": analysis.get("risk_score", 0),
        "context_data": analysis.get("context_data", {}),
        "media_url": media_url,
        "media_type": media_type,
        "likes": 0,
        "created_at": datetime.utcnow()
    }

    await db.posts.insert_one(new_post)

    return {
        "message": "Post created successfully",
        "analysis": analysis,
        "media_url": media_url,
        "media_type": media_type
    }


@router.post("/")
async def create_post(
    post: PostCreate,
    user=Depends(get_current_user)
):
    """
    Create a new text-only post (JSON body).
    """
    return await _create_post_common(post.content, user)


@router.post("/with-media")
async def create_post_with_media(
    content: str = Form(...),
    media: Optional[UploadFile] = File(default=None),
    user=Depends(get_current_user)
):
    """
    Create a new post with media (multipart/form-data).
    Media is uploaded to Cloudinary.
    """
    # Handle media upload
    media_url = None
    media_type = None
    
    # Check if media file was actually uploaded (not just an empty field)
    has_media = False
    if media is not None and media.filename:
        # Read first byte to check if file has content
        first_byte = await media.read(1)
        if first_byte:
            has_media = True
            await media.seek(0)  # Reset file position for upload
    
    if has_media:
        try:
            media_url, media_type = await upload_to_cloudinary(
                media, 
                folder="pulse/posts",
                resource_type="auto"
            )
        except HTTPException:
            raise
        except Exception as e:
            print(f"Media upload failed: {e}")

    return await _create_post_common(content, user, media_url, media_type)


@router.get("/")
async def get_posts(user=Depends(get_current_user)):
    user_id = user["user_id"]
    posts = []
    async for post in db.posts.find().sort("created_at", -1).limit(100):
        post["_id"] = str(post["_id"])
        post_id = post["_id"]
        
        # Ensure likes field has a default value
        post["likes"] = post.get("likes", 0)
        
        # Add comment count
        comment_count = await db.comments.count_documents({"post_id": post_id})
        post["comment_count"] = comment_count
        
        # Check if user liked this post
        is_liked = await db.likes.find_one({
            "post_id": post_id,
            "user_id": user_id
        })
        post["is_liked_by_user"] = bool(is_liked)
        
        # Check if user is following the post author
        if post["user_id"] != user_id:
            is_following = await db.follows.find_one({
                "follower_id": user_id,
                "following_id": post["user_id"]
            })
            post["is_followed_by_user"] = bool(is_following)
        else:
            post["is_followed_by_user"] = False
        
        # Check if user bookmarked this post
        is_bookmarked = await db.bookmarks.find_one({
            "post_id": post_id,
            "user_id": user_id
        })
        post["is_bookmarked"] = bool(is_bookmarked)
        
        posts.append(post)

    return posts


@router.get("/{post_id}")
async def get_post_by_id(post_id: str, user=Depends(get_current_user)):
    # 1. Validate the ID format
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    # 2. Fetch from Database
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    
    # 3. Handle Not Found
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # 4. Convert ObjectId to string
    post["_id"] = str(post["_id"])
    
    # 5. Ensure likes has default value
    post["likes"] = post.get("likes", 0)
    
    # 6. Add enrichments for current user
    user_id = user["user_id"]
    
    is_liked = await db.likes.find_one({"post_id": post_id, "user_id": user_id})
    post["is_liked_by_user"] = bool(is_liked)
    
    is_bookmarked = await db.bookmarks.find_one({"post_id": post_id, "user_id": user_id})
    post["is_bookmarked"] = bool(is_bookmarked)
    
    comment_count = await db.comments.count_documents({"post_id": post_id})
    post["comment_count"] = comment_count
    
    return post


@router.delete("/{post_id}")
async def delete_post(post_id: str, user=Depends(get_current_user)):
    # 1. Validate the ID format
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    # 2. Fetch the post
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # 3. Check ownership - only author can delete
    if post["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    # 4. Delete the post
    await db.posts.delete_one({"_id": ObjectId(post_id)})
    
    # 5. Also delete associated comments
    await db.comments.delete_many({"post_id": post_id})
    
    # 6. Delete associated likes
    await db.likes.delete_many({"post_id": post_id})

    return {"message": "Post deleted successfully"}


@router.get("/related/{entity_text}")
async def get_related_posts(entity_text: str, user=Depends(get_current_user)):
    """
    Get posts that mention a specific entity (NER-based related posts).
    This is a core NER feature - find all posts containing a given entity.
    """
    user_id = user["user_id"]
    
    # Query posts where entities array contains matching entity text
    cursor = (
        db.posts
        .find({"entities.text": {"$regex": f"^{entity_text}$", "$options": "i"}})
        .sort("created_at", -1)
        .limit(50)
    )
    
    posts = []
    async for post in cursor:
        post["_id"] = str(post["_id"])
        post_id = post["_id"]
        
        # Ensure likes has default value
        post["likes"] = post.get("likes", 0)
        
        # Enrichments
        comment_count = await db.comments.count_documents({"post_id": post_id})
        post["comment_count"] = comment_count
        
        is_liked = await db.likes.find_one({"post_id": post_id, "user_id": user_id})
        post["is_liked_by_user"] = bool(is_liked)
        
        is_bookmarked = await db.bookmarks.find_one({"post_id": post_id, "user_id": user_id})
        post["is_bookmarked"] = bool(is_bookmarked)
        
        posts.append(post)
    
    return {
        "entity": entity_text,
        "count": len(posts),
        "posts": posts
    }