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
        posts.append(post)

    return posts
