from fastapi import APIRouter
from collections import Counter
from datetime import datetime, timedelta
from app.services.database import db

router = APIRouter(prefix="/trending", tags=["Trending"])

@router.get("/")
async def trending_topics():
    since = datetime.utcnow() - timedelta(hours=24)

    # Fetch posts from the last 24 hours
    cursor = db.posts.find(
        {"created_at": {"$gte": since}}
    )

    # We store tuples of (text, label) to keep context
    entity_data = []

    async for post in cursor:
        for ent in post.get("entities", []):
            # We filter for significant labels only
            if ent.get("label") in ["PER", "ORG", "GPE", "LOC"]:
                entity_data.append((ent["text"], ent["label"]))

    # Count occurrences
    counter = Counter(entity_data)

    # Format the top 10 results
    trending = [
        {
            "topic": item[0], 
            "label": item[1], 
            "count": count
        }
        for item, count in counter.most_common(10)
    ]

    return trending