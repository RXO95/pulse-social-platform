from fastapi import APIRouter, Depends
from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/feed", tags=["Feed"])


@router.get("/")
async def get_feed(user=Depends(get_current_user)):
    posts_cursor = (
        db.posts
        .find()
        .sort("created_at", -1)
        .limit(20)
    )

    posts = []
    async for post in posts_cursor:
        post["_id"] = str(post["_id"])
        posts.append(post)

    return posts


@router.get("/latest-id")
async def get_latest_post_id(user=Depends(get_current_user)):
    """Lightweight endpoint to check if new posts exist."""
    post = await db.posts.find_one(
        sort=[("created_at", -1)],
        projection={"_id": 1},
    )
    if post:
        return {"latest_id": str(post["_id"])}
    return {"latest_id": None}
