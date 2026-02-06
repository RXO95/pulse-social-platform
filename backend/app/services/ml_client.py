import os
import httpx
import urllib.parse
import xml.etree.ElementTree as ET
import re
import unicodedata

ML_URL = os.getenv("ML_SERVICE_URL")

# Headers for Google News (browser-like)
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

# Headers for Wikipedia API (proper identification required)
WIKI_HEADERS = {
    "User-Agent": "PulseApp/1.0 (https://github.com/RXO95/pulse-social-platform)"
}

# Script detection for Unicode ranges
SCRIPT_LANG_MAP = {
    (0x0900, 0x097F): "hi",   # Devanagari (Hindi/Marathi)
    (0x0980, 0x09FF): "bn",   # Bengali
    (0x0A80, 0x0AFF): "gu",   # Gujarati
    (0x0B00, 0x0B7F): "or",   # Odia
    (0x0B80, 0x0BFF): "ta",   # Tamil
    (0x0C00, 0x0C7F): "te",   # Telugu
    (0x0C80, 0x0CFF): "kn",   # Kannada
    (0x0D00, 0x0D7F): "ml",   # Malayalam
    (0x0A00, 0x0A7F): "pa",   # Gurmukhi (Punjabi)
}


def is_latin(text: str) -> bool:
    """Check if text is primarily Latin script."""
    latin_count = sum(1 for c in text if unicodedata.category(c).startswith('L') and ord(c) < 0x0250)
    letter_count = sum(1 for c in text if unicodedata.category(c).startswith('L'))
    return letter_count > 0 and (latin_count / letter_count) > 0.5


def detect_script_language(text: str) -> str:
    """Detect the source language from Unicode script ranges."""
    for char in text:
        cp = ord(char)
        for (start, end), lang in SCRIPT_LANG_MAP.items():
            if start <= cp <= end:
                return lang
    return "hi"  # Default fallback


async def transliterate_to_english(text: str) -> str:
    """Translate non-Latin entity names to English using Google Translate."""
    if is_latin(text):
        return text
    try:
        src_lang = detect_script_language(text)
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src_lang}&tl=en&dt=t&q={urllib.parse.quote(text)}"
        async with httpx.AsyncClient(timeout=4, headers=BROWSER_HEADERS) as client:
            resp = await client.get(url, follow_redirects=True)
            if resp.status_code == 200:
                data = resp.json()
                if data and data[0]:
                    translated = "".join(part[0] for part in data[0] if part[0])
                    # For proper nouns, prefer transliteration — strip common filler words
                    filler = {"in", "of", "the", "for", "to", "at", "from", "by", "and"}
                    words = translated.split()
                    cleaned = " ".join(w for w in words if w.lower() not in filler)
                    return cleaned if cleaned else translated
    except Exception as e:
        print(f"Transliterate Error: {e}")
    return text

VIOLENT_KEYWORDS = [
    "kill", "murder", "shoot", "rape",
    "die", "death", "attack", "bomb",
    "hang", "stab",
    "maar", "hatya", "khoon", "marne", "hamla"
]

SENSITIVE_LABELS = {"PER", "ORG", "GPE", "LOC"}

# --- MULTILINGUAL DICTIONARY ---
KNOWN_ENTITIES = {
    # Hinglish / Slang
    "raga": ("Rahul Gandhi", "PER"),
    "namo": ("Narendra Modi", "PER"),
    "pappu": ("Rahul Gandhi", "PER"),
    "kejri": ("Arvind Kejriwal", "PER"),
    "yogi": ("Yogi Adityanath", "PER"),
    
    # Marathi / Hindi (Roots)
    "शिवाजी": ("Chhatrapati Shivaji Maharaj", "PER"),
    "पुणे": ("Pune", "LOC"),
    "मुंबई": ("Mumbai", "LOC"),
    "ठाकरे": ("Bal Thackeray", "PER"),
    "फडणवीस": ("Devendra Fadnavis", "PER"),
    "पवार": ("Sharad Pawar", "PER"),
    "शिंदे": ("Eknath Shinde", "PER"),
    "मोदी": ("Narendra Modi", "PER"),
    "भारत": ("India", "GPE"),
    "दिल्ली": ("Delhi", "LOC"),
    "केजरीवाल": ("Arvind Kejriwal", "PER")
}

async def fetch_wikipedia_summary(query: str):
    """Fetches summary from Wikipedia with proper headers."""
    try:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(query)}"
        async with httpx.AsyncClient(timeout=4, headers=WIKI_HEADERS) as client:
            resp = await client.get(url, follow_redirects=True)
            if resp.status_code == 200:
                data = resp.json()
                if "title" in data and "extract" in data:
                    return {
                        "title": data["title"],
                        "description": data.get("description", "Wikipedia Entry"),
                        "extract": data["extract"][:150] + "..."
                    }
    except Exception as e:
        print(f"Wiki Fetch Error: {e}")
    return None


async def fetch_google_news(query: str, entity_names=None):
    """Fetches News from Google RSS with proper headers. 
    Optionally filters by entity_names for relevance."""
    try:
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
        async with httpx.AsyncClient(timeout=4, headers=BROWSER_HEADERS) as client:
            resp = await client.get(rss_url)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                items = root.findall(".//item")[:10]  # Check more items for relevance
                
                # If entity names provided, try to find relevant article first
                if entity_names:
                    for item in items:
                        title = item.find("title").text
                        link = item.find("link").text
                        if title and link:
                            title_lower = title.lower()
                            if any(name.lower() in title_lower for name in entity_names):
                                return {"headline": title, "url": link}
                
                # Fallback: return first valid item
                for item in items:
                    title = item.find("title").text
                    link = item.find("link").text
                    if title and link:
                        return {"headline": title, "url": link}
    except Exception as e:
        print(f"News Fetch Error: {e}")
    return None


async def generate_context(entities, text=""):
    context = {
        "is_generated": False,
        "disambiguation": [],
        "news": None
    }

    if not entities:
        return context

    # 1. Select the Best Subject for Search
    # Priority: Dictionary Matches (confidence=1.0) -> People -> Locations
    best_subject = None
    best_entity = None
    
    # Check for Dictionary match first
    for ent in entities:
        if ent.get("confidence") == 1.0:
            best_subject = ent["text"]
            best_entity = ent
            break
    
    # If no dictionary match, fallback to ML entities
    if not best_subject:
        people = [e for e in entities if e["label"] == "PER"]
        locations = [e for e in entities if e["label"] in ["GPE", "LOC"]]
        best_entity = people[0] if people else (locations[0] if locations else None)
        if best_entity:
            best_subject = best_entity["text"]

    if not best_subject:
        return context

    # 1b. Check if entity already has "identified_as" (from dictionary)
    # Otherwise, transliterate non-Latin entities to English for better search
    if best_entity and best_entity.get("identified_as"):
        english_subject = best_entity["identified_as"]
    else:
        english_subject = await transliterate_to_english(best_subject)
    
    # Build English names for all entities
    english_names = []
    for ent in entities:
        if ent.get("identified_as"):
            english_names.append(ent["identified_as"])
        else:
            en_name = await transliterate_to_english(ent["text"])
            english_names.append(en_name)

    # 2. Fetch Data (Independent Calls)
    # Wikipedia — try English name first, then original
    wiki_data = await fetch_wikipedia_summary(english_subject)
    if not wiki_data and english_subject != best_subject:
        wiki_data = await fetch_wikipedia_summary(best_subject)
    
    if wiki_data:
        context["disambiguation"].append({
            "entity": best_subject,
            "identified_as": wiki_data["title"],
            "description": wiki_data["description"]
        })
        context["is_generated"] = True

    # 3. Build a specific news query from multiple entities for relevance
    # Use English names for the search query
    seen = set()
    query_parts = []
    for name in english_names:
        if name not in seen and len(query_parts) < 3:
            seen.add(name)
            query_parts.append(name)

    news_query = " ".join(query_parts) if len(query_parts) > 1 else english_subject
    
    # Combine both original + English names for relevance matching
    all_names = set(e["text"] for e in entities) | set(english_names)

    news_data = await fetch_google_news(news_query, entity_names=list(all_names))

    # 4. Validate news relevance — headline must mention at least one entity (original or English)
    if news_data:
        headline_lower = news_data["headline"].lower()
        all_names_lower = {name.lower() for name in all_names}
        is_relevant = any(name in headline_lower for name in all_names_lower)

        if is_relevant:
            context["news"] = news_data
            context["is_generated"] = True
        else:
            # Retry with just the English subject
            fallback_data = await fetch_google_news(english_subject, entity_names=list(all_names))
            if fallback_data:
                fb_headline = fallback_data["headline"].lower()
                if any(name in fb_headline for name in all_names_lower):
                    context["news"] = fallback_data
                    context["is_generated"] = True

    return context


async def analyze_text(text: str):
    ner_result = {"entities": []}

    # 1. ML Service Call
    if ML_URL:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                response = await client.post(ML_URL, json={"text": text})
                response.raise_for_status()
                ner_result = response.json()
        except:
            pass

    ml_entities = ner_result.get("entities", [])
    
    # 2. Dictionary Logic (The "Fix")
    text_lower = text.lower()
    dict_entities = []
    detected_keys = set()

    # Scan for dictionary keywords using Phrase Matching
    for key, (english_name, label) in KNOWN_ENTITIES.items():
        if key in text_lower:
            # Prevent duplicate detections of the same concept
            if english_name not in detected_keys:
                # Find the actual matched text in the original (preserve case/script)
                start_pos = text_lower.find(key)
                actual_text = text[start_pos:start_pos + len(key)]
                
                dict_entities.append({
                    "text": actual_text,  # Use original matched text, not English name
                    "label": label,
                    "confidence": 1.0,    # Mark as High Confidence
                    "source": "dictionary",
                    "identified_as": english_name  # Store English name for disambiguation
                })
                detected_keys.add(english_name)

    # 3. Merge: Put Dictionary entities FIRST so they are prioritized
    final_entities = dict_entities + ml_entities

    # 4. Risk Logic
    violent = any(word in text_lower for word in VIOLENT_KEYWORDS)
    contains_sensitive = any(ent.get("label") in SENSITIVE_LABELS for ent in final_entities)

    risk_score = 0.0
    if violent and contains_sensitive:
        risk_score = 0.95
    elif violent:
        risk_score = 0.7
    elif contains_sensitive:
        risk_score = 0.4

    # 5. Generate Context
    context_data = await generate_context(final_entities, text)

    return {
        "entities": final_entities,
        "risk_score": risk_score,
        "violent_detected": violent,
        "contains_sensitive_entity": contains_sensitive,
        "context_data": context_data
    }