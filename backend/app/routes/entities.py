"""
Entity Exploration Routes - Core NER Feature

This module provides endpoints to explore and browse content by NER-extracted entities.
Users can discover posts mentioning specific people, organizations, or locations.
"""

from fastapi import APIRouter, Depends, HTTPException
from collections import Counter
from datetime import datetime, timedelta
from bson import ObjectId

from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.ml_client import analyze_text, fetch_wikipedia_summary

router = APIRouter(prefix="/entities", tags=["Entities (NER)"])


@router.get("/")
async def list_all_entities(
    label: str = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    """
    List all unique entities extracted across all posts.
    Optionally filter by label type (PER, ORG, LOC, GPE).
    
    This is a core NER feature - browse the knowledge graph of extracted entities.
    """
    # Build query
    match_stage = {}
    if label:
        match_stage = {"entities.label": label.upper()}
    
    # Aggregate to get unique entities with counts
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$unwind": "$entities"},
        {"$group": {
            "_id": {
                "text": "$entities.text",
                "label": "$entities.label"
            },
            "count": {"$sum": 1},
            "last_seen": {"$max": "$created_at"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    entities = []
    async for doc in db.posts.aggregate(pipeline):
        entities.append({
            "text": doc["_id"]["text"],
            "label": doc["_id"]["label"],
            "mention_count": doc["count"],
            "last_seen": doc["last_seen"]
        })
    
    return {
        "total": len(entities),
        "filter": label.upper() if label else "ALL",
        "entities": entities
    }


@router.get("/stats")
async def entity_statistics(user=Depends(get_current_user)):
    """
    Get statistics about entity distribution across the platform.
    Shows breakdown by entity type (PER, ORG, LOC, GPE).
    """
    pipeline = [
        {"$unwind": "$entities"},
        {"$group": {
            "_id": "$entities.label",
            "count": {"$sum": 1},
            "unique_entities": {"$addToSet": "$entities.text"}
        }}
    ]
    
    stats = {}
    async for doc in db.posts.aggregate(pipeline):
        label = doc["_id"]
        stats[label] = {
            "total_mentions": doc["count"],
            "unique_count": len(doc["unique_entities"])
        }
    
    # Total posts with entities
    posts_with_entities = await db.posts.count_documents({"entities.0": {"$exists": True}})
    total_posts = await db.posts.count_documents({})
    
    return {
        "by_type": stats,
        "posts_with_entities": posts_with_entities,
        "total_posts": total_posts,
        "entity_coverage": round(posts_with_entities / max(total_posts, 1) * 100, 1)
    }


@router.get("/{entity_text}")
async def get_entity_profile(entity_text: str, user=Depends(get_current_user)):
    """
    Get a detailed profile for a specific entity - like an entity page.
    Includes Wikipedia summary, recent posts, and co-occurring entities.
    
    This is the NER-powered "knowledge card" feature.
    """
    user_id = user["user_id"]
    
    # 1. Find posts mentioning this entity
    cursor = (
        db.posts
        .find({"entities.text": {"$regex": f"^{entity_text}$", "$options": "i"}})
        .sort("created_at", -1)
        .limit(20)
    )
    
    posts = []
    entity_info = None
    co_occurring = Counter()
    
    async for post in cursor:
        post["_id"] = str(post["_id"])
        post_id = post["_id"]
        
        # Find the entity info from the post
        for ent in post.get("entities", []):
            if ent["text"].lower() == entity_text.lower():
                entity_info = ent
                break
        
        # Track co-occurring entities
        for ent in post.get("entities", []):
            if ent["text"].lower() != entity_text.lower():
                co_occurring[(ent["text"], ent["label"])] += 1
        
        # Ensure likes has default value
        post["likes"] = post.get("likes", 0)
        
        # Fetch author's profile picture
        author = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        post["profile_pic_url"] = author.get("profile_pic_url") if author else None
        
        # Enrichments
        comment_count = await db.comments.count_documents({"post_id": post_id})
        post["comment_count"] = comment_count
        
        is_liked = await db.likes.find_one({"post_id": post_id, "user_id": user_id})
        post["is_liked_by_user"] = bool(is_liked)
        
        posts.append(post)
    
    if not posts:
        raise HTTPException(status_code=404, detail="Entity not found in any posts")
    
    # 2. Get Wikipedia info
    wiki_data = await fetch_wikipedia_summary(entity_text)
    
    # 3. Build co-occurring entities list
    related_entities = [
        {"text": text, "label": label, "co_occurrences": count}
        for (text, label), count in co_occurring.most_common(10)
    ]
    
    return {
        "entity": {
            "text": entity_text,
            "label": entity_info.get("label") if entity_info else "UNKNOWN",
            "identified_as": entity_info.get("identified_as") if entity_info else None
        },
        "wikipedia": wiki_data,
        "mention_count": len(posts),
        "related_entities": related_entities,
        "recent_posts": posts[:10]
    }


@router.get("/trending/today")
async def trending_entities_today(user=Depends(get_current_user)):
    """
    Get entities trending in the last 24 hours with velocity tracking.
    Shows which entities are gaining momentum.
    """
    now = datetime.utcnow()
    yesterday = now - timedelta(hours=24)
    two_days_ago = now - timedelta(hours=48)
    
    # Last 24 hours
    pipeline_today = [
        {"$match": {"created_at": {"$gte": yesterday}}},
        {"$unwind": "$entities"},
        {"$match": {"entities.label": {"$in": ["PER", "ORG", "GPE", "LOC"]}}},
        {"$group": {
            "_id": {"text": "$entities.text", "label": "$entities.label"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    
    # Previous 24 hours for velocity comparison
    pipeline_prev = [
        {"$match": {"created_at": {"$gte": two_days_ago, "$lt": yesterday}}},
        {"$unwind": "$entities"},
        {"$group": {
            "_id": {"text": "$entities.text", "label": "$entities.label"},
            "count": {"$sum": 1}
        }}
    ]
    
    today_counts = {}
    async for doc in db.posts.aggregate(pipeline_today):
        key = (doc["_id"]["text"], doc["_id"]["label"])
        today_counts[key] = doc["count"]
    
    prev_counts = {}
    async for doc in db.posts.aggregate(pipeline_prev):
        key = (doc["_id"]["text"], doc["_id"]["label"])
        prev_counts[key] = doc["count"]
    
    # Calculate velocity (change from previous period)
    trending = []
    for (text, label), count in today_counts.items():
        prev_count = prev_counts.get((text, label), 0)
        velocity = count - prev_count
        trending.append({
            "text": text,
            "label": label,
            "mentions_24h": count,
            "velocity": velocity,
            "is_new": prev_count == 0
        })
    
    # Sort by velocity (new and fast-growing entities first)
    trending.sort(key=lambda x: (x["is_new"], x["velocity"]), reverse=True)
    
    return {"trending": trending[:15]}
