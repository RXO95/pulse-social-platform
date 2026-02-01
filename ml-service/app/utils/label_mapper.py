from src.labels import label2id

def map_label(tag):
    if tag.endswith("PER"):
        return tag.replace("PER", "PER")
    if tag.endswith("ORG"):
        return tag.replace("ORG", "ORG")
    if tag.endswith("LOC"):
        return tag.replace("LOC", "LOC")
    if tag.endswith("MISC"):
        return tag.replace("MISC", "MISC")
    return "O"
