from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime
from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.ml_client import analyze_text

router = APIRouter(prefix="/comments", tags=["Community Notes"])

@router.post("/{post_id}")
async def add_community_note(post_id: str, payload: dict, user=Depends(get_current_user)):
    """
    Add a new Community Note (Comment) to a post.
    Comments also go through NER analysis to extract entities.
    """
    if not payload.get("content"):
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    # Verify post exists
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
    except:
        raise HTTPException(status_code=400, detail="Invalid Post ID")
    
    content = payload["content"]
    
    # Run NER on comment content
    try:
        analysis = await analyze_text(content)
        entities = analysis.get("entities", [])
        risk_score = analysis.get("risk_score", 0)
    except:
        entities = []
        risk_score = 0
    
    # Block high-risk comments
    if risk_score > 0.6:
        raise HTTPException(
            status_code=403,
            detail="Comment blocked due to sensitive content"
        )

    note = {
        "post_id": post_id,
        "user_id": user["user_id"],
        "username": user["username"],
        "content": content,
        "entities": entities,  # NER entities from comment
        "created_at": datetime.utcnow()
    }

    result = await db.comments.insert_one(note)

    return {
        "message": "Note added",
        "_id": str(result.inserted_id),
        "username": note["username"],
        "content": note["content"],
        "created_at": note["created_at"]
    }

@router.get("/{post_id}")
async def get_post_notes(post_id: str):
    """
    Fetch all community notes for a specific post.
    """
    cursor = db.comments.find({"post_id": post_id}).sort("created_at", -1)
    notes = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        notes.append(doc)
    
    return notes