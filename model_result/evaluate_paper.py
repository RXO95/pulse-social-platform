import os
import numpy as np
import torch
import matplotlib.pyplot as plt
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForTokenClassification
from sklearn.metrics import precision_recall_fscore_support, classification_report
from tqdm import tqdm

# ===============================
# CONFIG
# ===============================

MODEL_PATH = "/Volumes/NEW SSD/Projects/pulse/ml-service/models/ner_model"
DATASET_NAME = "wikiann"
DATASET_LANG = "hi"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# BIO labels for WikiANN
id2label = {
    0: "O",
    1: "B-PER", 2: "I-PER",
    3: "B-ORG", 4: "I-ORG",
    5: "B-LOC", 6: "I-LOC"
}

label2id = {v: k for k, v in id2label.items()}

# -------------------------------
# Confidence thresholds (KEY FIX)
# -------------------------------
CONF_THRESH = {
    "PER": 0.40,
    "LOC": 0.70,
    "ORG": 0.70,
    "MISC": 0.60
}

# -------------------------------
# Lexicon (system-level)
# -------------------------------
LEXICON = {
    "नई दिल्ली": "LOC",
    "दिल्ली": "LOC",
    "मुंबई": "LOC",
    "राहुल गांधी": "PER",
    "नरेन्द्र मोदी": "PER",
    "कांग्रेस": "ORG",
    "भाजपा": "ORG",
    "सुप्रीम कोर्ट": "ORG"
}

# ===============================
# LEXICON REFINEMENT (BIO-CORRECT)
# ===============================

def apply_lexicon(tokens, tags):
    tags = tags.copy()
    n = len(tokens)

    for phrase, ent in LEXICON.items():
        phrase_tokens = phrase.split()
        m = len(phrase_tokens)

        for i in range(n - m + 1):
            if tokens[i:i+m] == phrase_tokens:
                tags[i] = f"B-{ent}"
                for j in range(1, m):
                    tags[i+j] = f"I-{ent}"
    return tags

# ===============================
# CONFIDENCE FILTERING
# ===============================

def apply_confidence_filter(tags, confidences):
    """
    Remove low-confidence predictions by mapping them to 'O'
    """
    filtered = []

    for tag, conf in zip(tags, confidences):
        if tag == "O":
            filtered.append("O")
            continue

        ent_type = tag.split("-")[-1]
        threshold = CONF_THRESH.get(ent_type, 0.5)

        if conf >= threshold:
            filtered.append(tag)
        else:
            filtered.append("O")

    return filtered

# ===============================
# EVALUATION
# ===============================

def evaluate():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForTokenClassification.from_pretrained(MODEL_PATH).to(DEVICE)
    model.eval()

    dataset = load_dataset(DATASET_NAME, DATASET_LANG, split="test")

    y_true, y_pred_model, y_pred_system = [], [], []

    for ex in tqdm(dataset):
        tokens = ex["tokens"]
        true_tags = [id2label[t] for t in ex["ner_tags"]]

        enc = tokenizer(
            tokens,
            is_split_into_words=True,
            return_tensors="pt",
            truncation=True
        ).to(DEVICE)

        with torch.no_grad():
            outputs = model(**enc)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)

        preds = torch.argmax(logits, dim=-1)[0].cpu().numpy()
        probs = probs[0].cpu().numpy()
        word_ids = enc.word_ids()

        model_tags = []
        model_confs = []
        prev_word = None

        for idx, word_id in enumerate(word_ids):
            if word_id is None or word_id == prev_word:
                continue

            label_id = preds[idx]
            label = id2label[label_id]
            confidence = probs[idx][label_id]

            model_tags.append(label)
            model_confs.append(confidence)
            prev_word = word_id

        model_tags = model_tags[:len(tokens)]
        model_confs = model_confs[:len(tokens)]

        # -------------------------------
        # Apply Confidence Filtering
        # -------------------------------
        filtered_tags = apply_confidence_filter(model_tags, model_confs)

        # -------------------------------
        # Apply Lexicon (System-level)
        # -------------------------------
        system_tags = apply_lexicon(tokens, filtered_tags)

        y_true.extend(true_tags)
        y_pred_model.extend(model_tags)
        y_pred_system.extend(system_tags)

    # ===============================
    # METRICS
    # ===============================

    def score(y_t, y_p):
        labels = [l for l in set(y_t) | set(y_p) if l != "O"]
        p, r, f, _ = precision_recall_fscore_support(
            y_t, y_p, average="weighted", labels=labels, zero_division=0
        )
        return p, r, f

    bp, br, bf = score(y_true, y_pred_model)
    sp, sr, sf = score(y_true, y_pred_system)

    print("\nRESULTS")
    print(f"Model Only F1:   {bf:.4f}")
    print(f"System F1:       {sf:.4f} (Δ +{sf-bf:.4f})")

    os.makedirs("model_result", exist_ok=True)

    with open("model_result/baseline_report.txt", "w") as f:
        f.write(classification_report(y_true, y_pred_model, zero_division=0))

    with open("model_result/system_report.txt", "w") as f:
        f.write(classification_report(y_true, y_pred_system, zero_division=0))

    labels = ["Precision", "Recall", "F1"]
    base_scores = [bp, br, bf]
    sys_scores = [sp, sr, sf]

    x = np.arange(len(labels))
    w = 0.35

    plt.figure(figsize=(7,5))
    plt.bar(x-w/2, base_scores, w, label="Model Output")
    plt.bar(x+w/2, sys_scores, w, label="System Output (Confidence + Lexicon)")
    plt.xticks(x, labels)
    plt.ylim(0,1)
    plt.title("Impact of Confidence-Based Post-Processing")
    plt.legend()
    plt.tight_layout()
    plt.savefig("model_result/final_comparison.png", dpi=300)

if __name__ == "__main__":
    evaluate()
