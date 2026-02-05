from fastapi import APIRouter, Depends
from app.services.database import db
from app.auth.dependency import get_current_user
from app.services.ml_client import analyze_text

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/")
async def search_posts(q: str, user=Depends(get_current_user)):
    if not q.strip():
        return {"results": [], "entities_found": []}

    # 1. Analyze query using your ML client (NER)
    analysis = await analyze_text(q)
    extracted_entities = analysis.get("entities", [])
    
    # 2. Hybrid Query Logic
    # Matches text in content OR matches specific entity names for better accuracy
    query_conditions = [
        {"content": {"$regex": q, "$options": "i"}}
    ]
    
    if extracted_entities:
        entity_texts = [ent["text"] for ent in extracted_entities]
        query_conditions.append({
            "entities.text": {"$in": entity_texts}
        })
        
    mongo_query = {"$or": query_conditions}
    
    # 3. Execute Search
    posts_cursor = (
        db.posts
        .find(mongo_query)
        .sort("created_at", -1)
        .limit(30)
    )

    results = []
    async for post in posts_cursor:
        post["_id"] = str(post["_id"])
        results.append(post)

    return {
        "query": q,
        "entities_detected": extracted_entities,
        "results": results
    }