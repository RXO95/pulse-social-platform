from transformers import pipeline

MODEL_PATH = "models/ner_model"

ner_pipeline = pipeline(
    "ner",
    model=MODEL_PATH,
    tokenizer=MODEL_PATH,
    aggregation_strategy="simple"
)


def run_ner(text: str):
    results = ner_pipeline(text)

    entities = []

    for ent in results:
        entities.append({
            "text": ent["word"],
            "label": ent["entity_group"]
        })

    return entities
