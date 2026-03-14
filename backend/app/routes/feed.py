from fastapi import APIRouter, Depends, Query
from typing import Optional
from bson import ObjectId
from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/feed", tags=["Feed"])

PAGE_SIZE = 15


@router.get("/")
async def get_feed(
    user=Depends(get_current_user),
    cursor: Optional[str] = Query(None, description="Pass the _id of the last post to get next page"),
    limit: int = Query(PAGE_SIZE, ge=1, le=50),
):
    """
    Paginated feed endpoint using cursor-based pagination.
    The client passes `cursor=<last_post_id>` to fetch the next page.
    """
    query = {}
    if cursor:
        try:
            query["_id"] = {"$lt": ObjectId(cursor)}
        except Exception:
            pass

    posts_cursor = (
        db.posts
        .find(query)
        .sort("created_at", -1)
        .limit(limit)
    )

    posts = []
    async for post in posts_cursor:
        post["_id"] = str(post["_id"])
        posts.append(post)

    has_more = len(posts) == limit
    next_cursor = posts[-1]["_id"] if posts and has_more else None

    return {
        "posts": posts,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


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


@router.get("/suggested-users")
async def get_suggested_users(user=Depends(get_current_user)):
    """
    Return users the current user is NOT following, sorted by follower count.
    Used for the "Who to Follow" widget.
    """
    current_user_id = user["user_id"]

    # Get IDs of users the current user already follows
    following_docs = await db.follows.find(
        {"follower_id": current_user_id},
        {"following_id": 1}
    ).to_list(length=500)
    following_ids = [doc["following_id"] for doc in following_docs]
    following_ids.append(current_user_id)  # exclude self

    # Convert to ObjectIds for the users query
    exclude_oids = []
    for fid in following_ids:
        try:
            exclude_oids.append(ObjectId(fid))
        except Exception:
            pass

    # Find users not in the exclude list, sorted by follower_count descending
    suggestions_cursor = (
        db.users
        .find(
            {"_id": {"$nin": exclude_oids}},
            {"password": 0}  # never expose password
        )
        .sort("follower_count", -1)
        .limit(5)
    )

    suggestions = []
    async for u in suggestions_cursor:
        u["_id"] = str(u["_id"])
        suggestions.append({
            "_id": u["_id"],
            "username": u.get("username", ""),
            "bio": u.get("bio", ""),
            "profile_picture": u.get("profile_picture"),
            "follower_count": u.get("follower_count", 0),
        })

    return suggestions
