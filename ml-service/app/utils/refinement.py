import re



PERSON_CONTEXT_VERBS = {
    "met", "meet", "with", "clicked", "photo", "photos",
    "talked", "called", "saw", "seen", "visited"
}


FUNCTION_WORDS = {
    "Maine", "Mujhe", "Mera", "Meri", "Humne",
    "Tumne", "Usne", "Yeh", "Woh", "Waha", "Yaha"
}


def refine_entities(text, model_entities):
    refined = []

    existing = {e["text"] for e in model_entities}

    tokens = text.split()

    for i, token in enumerate(tokens):
        clean = re.sub(r"[^\w]", "", token)

        if (
            not clean
            or clean in existing
            or clean in FUNCTION_WORDS
            or not clean[0].isupper()
        ):
            continue

        window = tokens[max(0, i - 3): i + 4]
        window_lower = {w.lower() for w in window}

        if window_lower & PERSON_CONTEXT_VERBS:
            refined.append({
                "text": clean,
                "label": "PERSON",
                "source": "refinement",
                "confidence": "low"
            })

    return refined
