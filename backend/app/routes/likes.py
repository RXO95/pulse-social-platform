from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/likes", tags=["Likes"])


@router.post("/{post_id}")
async def toggle_like(
    post_id: str,
    user=Depends(get_current_user)
):
    """
    Toggle like on a post. If already liked, removes the like.
    Returns the new like count and liked status.
    """
    # Validate post_id format
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")
    
    # Check post exists
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check if already liked
    existing = await db.likes.find_one({
        "post_id": post_id,
        "user_id": user["user_id"]
    })

    if existing:
        # Unlike: remove the like
        await db.likes.delete_one({"_id": existing["_id"]})
        await db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"likes": -1}}
        )
        # Get updated like count
        updated_post = await db.posts.find_one({"_id": ObjectId(post_id)})
        return {
            "message": "Post unliked",
            "liked": False,
            "likes": updated_post.get("likes", 0)
        }
    else:
        # Like: add the like
        await db.likes.insert_one({
            "post_id": post_id,
            "user_id": user["user_id"]
        })
        await db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"likes": 1}}
        )
        # Get updated like count
        updated_post = await db.posts.find_one({"_id": ObjectId(post_id)})
        return {
            "message": "Post liked",
            "liked": True,
            "likes": updated_post.get("likes", 0)
        }
