from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/follow", tags=["Follow"])


@router.post("/{user_id}")
async def follow_user(user_id: str, user=Depends(get_current_user)):
    follower_id = user["user_id"]

    if follower_id == user_id:
        return {"message": "You cannot follow yourself"}

    existing = await db.follows.find_one({
        "follower_id": follower_id,
        "following_id": user_id
    })

    if existing:
        return {"message": "Already following"}

    await db.follows.insert_one({
        "follower_id": follower_id,
        "following_id": user_id,
        "created_at": datetime.utcnow()
    })

    return {"message": "User followed"}


@router.delete("/{user_id}")
async def unfollow_user(user_id: str, user=Depends(get_current_user)):
    follower_id = user["user_id"]

    await db.follows.delete_one({
        "follower_id": follower_id,
        "following_id": user_id
    })

    return {"message": "User unfollowed"}


@router.get("/followers/{username}")
async def get_followers(username: str, user=Depends(get_current_user)):
    """Get list of users who follow a specific user"""
    # Find target user
    target_user = await db.users.find_one({"username": username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user_id = str(target_user["_id"])
    current_user_id = user["user_id"]
    
    # Get all followers
    followers_cursor = db.follows.find({"following_id": target_user_id})
    
    followers = []
    async for follow in followers_cursor:
        follower_id = follow["follower_id"]
        follower_user = await db.users.find_one({"_id": ObjectId(follower_id)})
        if follower_user:
            # Check if current user follows this follower
            is_following = await db.follows.find_one({
                "follower_id": current_user_id,
                "following_id": follower_id
            })
            followers.append({
                "user_id": follower_id,
                "username": follower_user["username"],
                "bio": follower_user.get("bio", ""),
                "profile_pic_url": follower_user.get("profile_pic_url"),
                "is_followed_by_user": bool(is_following)
            })
    
    return {"count": len(followers), "users": followers}


@router.get("/following/{username}")
async def get_following(username: str, user=Depends(get_current_user)):
    """Get list of users that a specific user follows"""
    # Find target user
    target_user = await db.users.find_one({"username": username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user_id = str(target_user["_id"])
    current_user_id = user["user_id"]
    
    # Get all following
    following_cursor = db.follows.find({"follower_id": target_user_id})
    
    following = []
    async for follow in following_cursor:
        following_id = follow["following_id"]
        following_user = await db.users.find_one({"_id": ObjectId(following_id)})
        if following_user:
            # Check if current user follows this user
            is_following = await db.follows.find_one({
                "follower_id": current_user_id,
                "following_id": following_id
            })
            following.append({
                "user_id": following_id,
                "username": following_user["username"],
                "bio": following_user.get("bio", ""),
                "profile_pic_url": following_user.get("profile_pic_url"),
                "is_followed_by_user": bool(is_following)
            })
    
    return {"count": len(following), "users": following}
