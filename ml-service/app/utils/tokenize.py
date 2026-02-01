from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("xlm-roberta-base")

def tokenize_and_align(examples):
    all_tokens = examples["tokens"]
    all_labels = examples["ner_tags"]

    tokenized_inputs = tokenizer(
        all_tokens,
        truncation=True,
        is_split_into_words=True
    )

    labels = []

    for i, label in enumerate(all_labels):
        word_ids = tokenized_inputs.word_ids(batch_index=i)
        prev_word_id = None
        label_ids = []

        for word_id in word_ids:
            if word_id is None:
                label_ids.append(-100)
            elif word_id != prev_word_id:
                label_ids.append(label[word_id])
            else:
                label_ids.append(-100)
            prev_word_id = word_id

        labels.append(label_ids)

    tokenized_inputs["labels"] = labels
    return tokenized_inputs
