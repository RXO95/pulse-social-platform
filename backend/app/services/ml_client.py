import os
import httpx

ML_URL = os.getenv("ML_SERVICE_URL")

VIOLENT_KEYWORDS = [
    "kill", "murder", "shoot", "rape",
    "die", "death", "attack", "bomb",
    "hang", "stab"
]

SENSITIVE_LABELS = {"PER", "ORG", "GPE", "LOC"}


async def analyze_text(text: str):
    # Safety fallback
    ner_result = {"entities": []}

    if not ML_URL:
        return {
            "entities": [],
            "risk_score": 0.0,
            "violent_detected": False,
            "contains_sensitive_entity": False
        }

    # 🔌 Call ML service
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.post(
                ML_URL,
                json={"text": text}
            )
            response.raise_for_status()
            ner_result = response.json()

    except Exception:
        # ML service failure → do not crash backend
        ner_result = {"entities": []}

    entities = ner_result.get("entities", [])

    # 🔪 Detect violence
    text_lower = text.lower()
    violent = any(word in text_lower for word in VIOLENT_KEYWORDS)

    # 🧠 Detect sensitive entities
    contains_sensitive = any(
        ent.get("label") in SENSITIVE_LABELS for ent in entities
    )

    # 🔥 Risk logic (boosted correctly)
    risk_score = 0.0

    if violent and contains_sensitive:
        risk_score = 0.95
    elif violent:
        risk_score = 0.7
    elif contains_sensitive:
        risk_score = 0.4

    return {
        "entities": entities,
        "risk_score": risk_score,
        "violent_detected": violent,
        "contains_sensitive_entity": contains_sensitive
    }
