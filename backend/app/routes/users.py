from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

# --- EXISTING: Get My Profile ---
@router.get("/me")
async def my_profile(user=Depends(get_current_user)):
    user_data = await db.users.find_one(
        {"_id": ObjectId(user["user_id"])}
    )

    if not user_data:
        return {"error": "User not found"}

    user_data["_id"] = str(user_data["_id"])
    user_data.pop("password", None)

    return user_data

# --- NEW: Get Any User Profile by Username ---
@router.get("/{username}")
async def get_user_profile(username: str, user=Depends(get_current_user)):
    # 1. Find the target user
    target_user = await db.users.find_one({"username": username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user_id = str(target_user["_id"])

    # 2. Calculate Stats
    followers = await db.follows.count_documents({"following_id": target_user_id})
    following = await db.follows.count_documents({"follower_id": target_user_id})
    post_count = await db.posts.count_documents({"username": username})

    # 3. Check if CURRENT user is following TARGET user
    is_following = await db.follows.find_one({
        "follower_id": user["user_id"],
        "following_id": target_user_id
    })

    return {
        "user_id": target_user_id,
        "username": target_user["username"],
        "bio": target_user.get("bio", "Pulse user"),
        "joined_at": target_user.get("created_at"),
        "stats": {
            "followers": followers,
            "following": following,
            "posts": post_count
        },
        "is_followed_by_user": bool(is_following)
    }