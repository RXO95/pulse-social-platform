from fastapi import APIRouter, Depends
from bson import ObjectId

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/feed", tags=["Feed"])


@router.get("/personal")
async def personal_feed(user=Depends(get_current_user)):
    user_id = user["user_id"]

    # users I follow
    follows_cursor = db.follows.find({"follower_id": user_id})

    following_ids = []
    async for f in follows_cursor:
        following_ids.append(f["following_id"])

    if not following_ids:
        return []

    posts_cursor = (
        db.posts
        .find({"user_id": {"$in": following_ids}})
        .sort("created_at", -1)
        .limit(50)
    )

    posts = []
    async for post in posts_cursor:
        post["_id"] = str(post["_id"])
        post_id = post["_id"]
        
        # Ensure likes has default value
        post["likes"] = post.get("likes", 0)
        
        # Fetch author's profile picture
        author = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        post["profile_pic_url"] = author.get("profile_pic_url") if author else None
        
        # Add enrichments
        comment_count = await db.comments.count_documents({"post_id": post_id})
        post["comment_count"] = comment_count
        
        is_liked = await db.likes.find_one({"post_id": post_id, "user_id": user_id})
        post["is_liked_by_user"] = bool(is_liked)
        
        is_bookmarked = await db.bookmarks.find_one({"post_id": post_id, "user_id": user_id})
        post["is_bookmarked"] = bool(is_bookmarked)
        
        posts.append(post)

    return posts
