from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/likes", tags=["Likes"])


@router.post("/{post_id}")
async def like_post(
    post_id: str,
    user=Depends(get_current_user)
):
    # check post exists
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # check already liked
    existing = await db.likes.find_one({
        "post_id": post_id,
        "user_id": user["user_id"]
    })

    if existing:
        raise HTTPException(status_code=400, detail="Already liked")

    # add like
    await db.likes.insert_one({
        "post_id": post_id,
        "user_id": user["user_id"]
    })

    # update like count
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"likes": 1}}
    )

    return {"message": "Post liked"}
