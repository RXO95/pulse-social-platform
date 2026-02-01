from fastapi import APIRouter, Depends
from datetime import datetime

from app.models.post import PostCreate
from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.ml_client import analyze_text

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.post("/")
async def create_post(
    post: PostCreate,
    user=Depends(get_current_user)
):
    # 🔍 Analyze content using ML service
    analysis = analyze_text(post.content)

    # ❌ Block high-risk content
    if analysis["risk_score"] > 0.6:
        return {
            "message": "Post blocked due to sensitive or harmful content",
            "analysis": analysis
        }

    # ✅ Allowed post
    new_post = {
        "user_id": user["user_id"],
        "username": user["username"],
        "content": post.content,
        "entities": analysis["entities"],
        "risk_score": analysis["risk_score"],
        "likes": 0,
        "created_at": datetime.utcnow()
    }

    await db.posts.insert_one(new_post)

    return {
        "message": "Post created successfully",
        "analysis": analysis
    }
