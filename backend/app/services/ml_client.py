import requests
import os

ML_URL = os.getenv("ML_SERVICE_URL")

VIOLENT_KEYWORDS = [
    "kill", "murder", "shoot", "rape",
    "die", "death", "attack", "bomb",
    "hang", "stab"
]


def analyze_text(text: str):
    try:
        response = requests.post(
            ML_URL,
            json={"text": text},
            timeout=3
        )
        ner_result = response.json()

    except Exception:
        ner_result = {"entities": []}

    entities = ner_result.get("entities", [])

    text_lower = text.lower()
    violent = any(word in text_lower for word in VIOLENT_KEYWORDS)

    sensitive_labels = {"PERSON", "ORG", "GPE", "LOC"}
    contains_sensitive = any(
        ent["label"] in sensitive_labels for ent in entities
    )

    # 🔥 Risk logic
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
