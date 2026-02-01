from fastapi import APIRouter, Depends
from datetime import datetime

from app.models.post import PostCreate
from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.post("/")
async def create_post(
    post: PostCreate,
    user=Depends(get_current_user)
):
    new_post = {
        "user_id": user["user_id"],
        "username": user["username"],
        "content": post.content,
        "likes": 0,
        "created_at": datetime.utcnow()
    }

    await db.posts.insert_one(new_post)

    return {"message": "Post created successfully"}
