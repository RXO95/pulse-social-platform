from app.utils.label_map import label2id

# Canonical label set (no GPE — mapped to LOC)
VALID_LABELS = {"PER", "ORG", "LOC"}


def map_label(tag: str) -> str:
    """Map any BIO-tagged label to the canonical set.
    
    - GPE → LOC
    - MISC → O (dropped)
    - Everything else preserved
    """
    if tag == "O" or not tag:
        return "O"

    # Extract the entity type (after B-/I- prefix)
    prefix = tag[:2] if tag[1] == "-" else ""
    entity_type = tag[2:] if prefix else tag

    # GPE → LOC conversion
    if entity_type == "GPE":
        entity_type = "LOC"

    # Drop MISC
    if entity_type == "MISC":
        return "O"

    if entity_type in VALID_LABELS:
        return f"{prefix}{entity_type}" if prefix else entity_type

    return "O"
