from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime

from app.models.post import DraftCreate
from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/drafts", tags=["Drafts"])


@router.post("/")
async def save_draft(draft: DraftCreate, user=Depends(get_current_user)):
    """Save a new draft or update if content provided."""
    doc = {
        "user_id": user["user_id"],
        "content": draft.content,
        "gif_url": draft.gif_url,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.drafts.insert_one(doc)
    return {"message": "Draft saved", "draft_id": str(result.inserted_id)}


@router.get("/")
async def get_drafts(user=Depends(get_current_user)):
    """Get all drafts for the current user."""
    cursor = db.drafts.find({"user_id": user["user_id"]}).sort("updated_at", -1)
    drafts = []
    async for d in cursor:
        drafts.append({
            "_id": str(d["_id"]),
            "content": d.get("content", ""),
            "gif_url": d.get("gif_url"),
            "created_at": d.get("created_at"),
            "updated_at": d.get("updated_at"),
        })
    return drafts


@router.put("/{draft_id}")
async def update_draft(draft_id: str, draft: DraftCreate, user=Depends(get_current_user)):
    """Update an existing draft."""
    if not ObjectId.is_valid(draft_id):
        raise HTTPException(status_code=400, detail="Invalid draft ID")

    existing = await db.drafts.find_one({"_id": ObjectId(draft_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Draft not found")
    if existing["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your draft")

    await db.drafts.update_one(
        {"_id": ObjectId(draft_id)},
        {"$set": {
            "content": draft.content,
            "gif_url": draft.gif_url,
            "updated_at": datetime.utcnow(),
        }}
    )
    return {"message": "Draft updated"}


@router.delete("/{draft_id}")
async def delete_draft(draft_id: str, user=Depends(get_current_user)):
    """Delete a draft."""
    if not ObjectId.is_valid(draft_id):
        raise HTTPException(status_code=400, detail="Invalid draft ID")

    existing = await db.drafts.find_one({"_id": ObjectId(draft_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Draft not found")
    if existing["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your draft")

    await db.drafts.delete_one({"_id": ObjectId(draft_id)})
    return {"message": "Draft deleted"}
