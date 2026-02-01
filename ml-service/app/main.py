from fastapi import FastAPI
from pydantic import BaseModel
from app.inference import run_ner

app = FastAPI(title="Pulse NER Moderation Service")


class TextRequest(BaseModel):
    text: str


@app.get("/")
def health():
    return {"status": "NER service running"}


@app.post("/analyze")
def analyze_text(request: TextRequest):
    entities = run_ner(request.text)

    sensitive_labels = {"PERSON", "ORG", "GPE", "LOC"}

    risk_score = min(1.0, len(entities) * 0.25)

    contains_sensitive = any(
        ent["label"] in sensitive_labels for ent in entities
    )

    return {
        "entities": entities,
        "risk_score": round(risk_score, 2),
        "contains_sensitive_entity": contains_sensitive
    }
