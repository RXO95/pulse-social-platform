from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from app.models.post import PostCreate
from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.ml_client import analyze_text

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.post("/")
async def create_post(
    post: PostCreate,
    user=Depends(get_current_user)
):
    # 🔍 Analyze content using ML service
    try:
        analysis = await analyze_text(post.content)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail="ML service unavailable"
        )

    # ❌ Block high-risk content
    if analysis.get("risk_score", 0) > 0.6:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Post blocked due to sensitive or harmful content",
                "analysis": analysis
            }
        )

    # ✅ Allowed post
    new_post = {
        "user_id": user["user_id"],
        "username": user["username"],
        "content": post.content,
        "entities": analysis.get("entities", []),
        "risk_score": analysis.get("risk_score", 0),
        # --- SAVE THE CONTEXT DATA ---
        "context_data": analysis.get("context_data", {}), 
        "likes": 0,
        "created_at": datetime.utcnow()
    }

    await db.posts.insert_one(new_post)

    return {
        "message": "Post created successfully",
        "analysis": analysis
    }


@router.get("/")
async def get_posts():
    posts = []
    async for post in db.posts.find().sort("created_at", -1):
        post["_id"] = str(post["_id"])
        posts.append(post)

    return posts


@router.get("/{post_id}")
async def get_post_by_id(post_id: str):
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