from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime
from typing import Optional

from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.ml_client import analyze_text

router = APIRouter(prefix="/reposts", tags=["Reposts"])


@router.post("/{post_id}")
async def repost(post_id: str, user=Depends(get_current_user)):
    """Simple repost (like retweet without quote)."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    original = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check if already reposted (no double-repost)
    existing = await db.reposts.find_one({
        "user_id": user["user_id"],
        "original_post_id": post_id,
        "is_quote": False
    })
    if existing:
        # Undo repost
        await db.reposts.delete_one({"_id": existing["_id"]})
        await db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"repost_count": -1}}
        )
        updated = await db.posts.find_one({"_id": ObjectId(post_id)})
        return {
            "message": "Repost removed",
            "reposted": False,
            "repost_count": updated.get("repost_count", 0)
        }

    # Fetch current username from DB
    current_user = await db.users.find_one({"_id": ObjectId(user["user_id"])})
    username = current_user["username"] if current_user else user["username"]

    repost_doc = {
        "user_id": user["user_id"],
        "username": username,
        "original_post_id": post_id,
        "is_quote": False,
        "quote_content": None,
        "entities": [],
        "created_at": datetime.utcnow()
    }
    await db.reposts.insert_one(repost_doc)
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"repost_count": 1}}
    )

    updated = await db.posts.find_one({"_id": ObjectId(post_id)})
    return {
        "message": "Reposted",
        "reposted": True,
        "repost_count": updated.get("repost_count", 0)
    }


@router.post("/{post_id}/quote")
async def quote_repost(post_id: str, payload: dict, user=Depends(get_current_user)):
    """Quote repost with added commentary."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    original = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")

    quote_content = payload.get("content", "").strip()
    if not quote_content:
        raise HTTPException(status_code=400, detail="Quote content cannot be empty")

    # NER on quote text
    entities = []
    try:
        analysis = await analyze_text(quote_content)
        entities = analysis.get("entities", [])
        if analysis.get("risk_score", 0) > 0.6:
            raise HTTPException(status_code=403, detail="Content blocked due to sensitive content")
    except HTTPException:
        raise
    except:
        pass

    current_user = await db.users.find_one({"_id": ObjectId(user["user_id"])})
    username = current_user["username"] if current_user else user["username"]

    repost_doc = {
        "user_id": user["user_id"],
        "username": username,
        "original_post_id": post_id,
        "is_quote": True,
        "quote_content": quote_content,
        "entities": entities,
        "created_at": datetime.utcnow()
    }
    result = await db.reposts.insert_one(repost_doc)

    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"repost_count": 1}}
    )

    return {
        "message": "Quote posted",
        "_id": str(result.inserted_id),
        "repost_count": (original.get("repost_count", 0) + 1)
    }


@router.get("/post/{post_id}")
async def get_reposts_for_post(post_id: str, user=Depends(get_current_user)):
    """Get repost info for a post (count + whether current user reposted)."""
    user_id = user["user_id"]

    count = await db.reposts.count_documents({"original_post_id": post_id})
    user_repost = await db.reposts.find_one({
        "original_post_id": post_id,
        "user_id": user_id,
        "is_quote": False
    })

    return {
        "repost_count": count,
        "is_reposted_by_user": bool(user_repost)
    }


@router.get("/user/{username}")
async def get_user_reposts(username: str, user=Depends(get_current_user)):
    """Get all reposts by a user (for profile tab)."""
    user_id = user["user_id"]
    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target_id = str(target["_id"])
    reposts = []
    cursor = db.reposts.find({"user_id": target_id}).sort("created_at", -1).limit(100)

    async for rp in cursor:
        rp["_id"] = str(rp["_id"])
        # Fetch original post
        orig = await db.posts.find_one({"_id": ObjectId(rp["original_post_id"])})
        if not orig:
            continue
        orig["_id"] = str(orig["_id"])
        orig["likes"] = orig.get("likes", 0)

        # Enrichments on original
        author = await db.users.find_one({"_id": ObjectId(orig["user_id"])})
        orig["profile_pic_url"] = author.get("profile_pic_url") if author else None

        is_liked = await db.likes.find_one({"post_id": orig["_id"], "user_id": user_id})
        orig["is_liked_by_user"] = bool(is_liked)

        is_bookmarked = await db.bookmarks.find_one({"post_id": orig["_id"], "user_id": user_id})
        orig["is_bookmarked"] = bool(is_bookmarked)

        comment_count = await db.comments.count_documents({"post_id": orig["_id"]})
        orig["comment_count"] = comment_count
        orig["repost_count"] = orig.get("repost_count", 0)

        rp["original_post"] = orig
        reposts.append(rp)

    return reposts
