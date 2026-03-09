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
    Supports text-only, GIF-only, or text+GIF comments.
    """
    content = payload.get("content", "").strip()
    gif_url = payload.get("gif_url")

    if not content and not gif_url:
        raise HTTPException(status_code=400, detail="Content or GIF is required")

    # Verify post exists
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
    except:
        raise HTTPException(status_code=400, detail="Invalid Post ID")
    
    # Run NER on comment content (skip if GIF-only)
    entities = []
    risk_score = 0
    if content:
        try:
            analysis = await analyze_text(content)
            entities = analysis.get("entities", [])
            risk_score = analysis.get("risk_score", 0)
        except:
            pass
    
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
        "gif_url": gif_url,
        "entities": entities,
        "likes": 0,
        "created_at": datetime.utcnow()
    }

    result = await db.comments.insert_one(note)

    return {
        "message": "Note added",
        "_id": str(result.inserted_id),
        "username": note["username"],
        "content": note["content"],
        "gif_url": gif_url,
        "likes": 0,
        "created_at": note["created_at"]
    }

@router.get("/{post_id}")
async def get_post_notes(post_id: str, user=Depends(get_current_user)):
    """
    Fetch all community notes for a specific post.
    Includes like status and bookmark status for current user.
    """
    cursor = db.comments.find({"post_id": post_id}).sort("created_at", -1)
    notes = []
    async for doc in cursor:
        comment_id = str(doc["_id"])
        doc["_id"] = comment_id

        # Check if current user liked this comment
        liked = await db.comment_likes.find_one({
            "comment_id": comment_id,
            "user_id": user["user_id"]
        })
        doc["is_liked_by_user"] = liked is not None

        # Check if current user bookmarked this comment
        bookmarked = await db.comment_bookmarks.find_one({
            "comment_id": comment_id,
            "user_id": user["user_id"]
        })
        doc["is_bookmarked_by_user"] = bookmarked is not None

        notes.append(doc)
    
    return notes


@router.delete("/{comment_id}")
async def delete_comment(comment_id: str, user=Depends(get_current_user)):
    """Delete a comment. Only the comment author can delete."""
    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    comment = await db.comments.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    await db.comments.delete_one({"_id": ObjectId(comment_id)})
    # Clean up related data
    await db.comment_likes.delete_many({"comment_id": comment_id})
    await db.comment_bookmarks.delete_many({"comment_id": comment_id})

    return {"message": "Comment deleted"}


@router.post("/{comment_id}/like")
async def toggle_comment_like(comment_id: str, user=Depends(get_current_user)):
    """Toggle like on a comment."""
    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    comment = await db.comments.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = await db.comment_likes.find_one({
        "comment_id": comment_id,
        "user_id": user["user_id"]
    })

    if existing:
        await db.comment_likes.delete_one({"_id": existing["_id"]})
        await db.comments.update_one(
            {"_id": ObjectId(comment_id)},
            {"$inc": {"likes": -1}}
        )
        updated = await db.comments.find_one({"_id": ObjectId(comment_id)})
        return {"liked": False, "likes": updated.get("likes", 0)}
    else:
        await db.comment_likes.insert_one({
            "comment_id": comment_id,
            "user_id": user["user_id"],
            "created_at": datetime.utcnow()
        })
        await db.comments.update_one(
            {"_id": ObjectId(comment_id)},
            {"$inc": {"likes": 1}}
        )
        updated = await db.comments.find_one({"_id": ObjectId(comment_id)})
        return {"liked": True, "likes": updated.get("likes", 0)}


@router.post("/{comment_id}/bookmark")
async def toggle_comment_bookmark(comment_id: str, user=Depends(get_current_user)):
    """Toggle bookmark on a comment."""
    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    comment = await db.comments.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = await db.comment_bookmarks.find_one({
        "comment_id": comment_id,
        "user_id": user["user_id"]
    })

    if existing:
        await db.comment_bookmarks.delete_one({"_id": existing["_id"]})
        return {"bookmarked": False}
    else:
        await db.comment_bookmarks.insert_one({
            "comment_id": comment_id,
            "user_id": user["user_id"],
            "created_at": datetime.utcnow()
        })
        return {"bookmarked": True}