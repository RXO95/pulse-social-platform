from fastapi import APIRouter, Depends
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
