from fastapi import APIRouter
from collections import Counter
from datetime import datetime, timedelta

from app.services.database import db

router = APIRouter(prefix="/trending", tags=["Trending"])


@router.get("/")
async def trending_topics():
    since = datetime.utcnow() - timedelta(hours=24)

    cursor = db.posts.find(
        {"created_at": {"$gte": since}}
    )

    entities = []

    async for post in cursor:
        for ent in post.get("entities", []):
            entities.append(ent["text"])

    counter = Counter(entities)

    trending = [
        {"topic": k, "count": v}
        for k, v in counter.most_common(10)
    ]

    return trending
