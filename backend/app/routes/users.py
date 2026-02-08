from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from bson import ObjectId
from typing import Optional

from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.cloudinary_helper import upload_profile_picture

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


# --- UPDATE: Update My Profile ---
@router.put("/me")
async def update_my_profile(
    username: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    profile_picture: Optional[UploadFile] = File(None),
    user=Depends(get_current_user)
):
    """
    Update current user's profile.
    Supports updating username, bio, and profile picture.
    """
    user_id = user["user_id"]
    update_data = {}
    
    # Validate and update username
    if username is not None and username.strip():
        username = username.strip()
        # Check if username is already taken by another user
        existing = await db.users.find_one({
            "username": username,
            "_id": {"$ne": ObjectId(user_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = username
        
        # Also update username in all posts by this user
        await db.posts.update_many(
            {"user_id": user_id},
            {"$set": {"username": username}}
        )
    
    # Update bio
    if bio is not None:
        update_data["bio"] = bio.strip()
    
    # Upload profile picture to Cloudinary
    if profile_picture is not None:
        pic_url = await upload_profile_picture(profile_picture)
        update_data["profile_pic_url"] = pic_url
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Update user in database
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update profile")
    
    # Return updated user data
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    updated_user["_id"] = str(updated_user["_id"])
    updated_user.pop("password", None)
    
    return {
        "message": "Profile updated successfully",
        "user": updated_user
    }


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
        "profile_pic_url": target_user.get("profile_pic_url"),
        "joined_at": target_user.get("created_at"),
        "stats": {
            "followers": followers,
            "following": following,
            "posts": post_count
        },
        "is_followed_by_user": bool(is_following)
    }