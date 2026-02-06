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
        # Extract the actual text from the original input using start/end positions
        # instead of using ent["word"] which might be normalized by the tokenizer
        start = ent.get("start")
        end = ent.get("end")
        
        if start is not None and end is not None:
            actual_text = text[start:end]
        else:
            actual_text = ent["word"]
        
        entities.append({
            "text": actual_text,
            "label": ent["entity_group"]
        })

    return entities
