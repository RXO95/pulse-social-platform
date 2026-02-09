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


# --- HASHTAG & MENTION EXTRACTION ---
def normalize_hashtag(hashtag: str) -> str:
    """
    Convert hashtag to readable text.
    #GameOfThrones -> Game Of Thrones
    #game_of_thrones -> game of thrones
    #gameofthrones -> gameofthrones (will match fuzzy later)
    """
    # Remove the # symbol
    tag = hashtag.lstrip('#')
    
    # Handle underscores
    if '_' in tag:
        return tag.replace('_', ' ')
    
    # Handle camelCase: insert space before uppercase letters
    result = re.sub(r'([a-z])([A-Z])', r'\1 \2', tag)
    
    # Handle consecutive uppercase followed by lowercase (e.g., XMLParser -> XML Parser)
    result = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', result)
    
    return result


def extract_hashtags_and_mentions(text: str):
    """Extract hashtags and @mentions from text."""
    hashtags = re.findall(r'#(\w+)', text)
    mentions = re.findall(r'@(\w+)', text)
    return hashtags, mentions


def find_matching_entity(normalized_tag: str, entities: list, known_entities: dict):
    """
    Try to match a normalized hashtag with existing entities.
    Returns (matched_text, label, identified_as) or None.
    """
    tag_lower = normalized_tag.lower().replace(' ', '')
    
    # Check against KNOWN_ENTITIES dictionary
    for key, (english_name, label) in known_entities.items():
        key_normalized = key.lower().replace(' ', '')
        english_normalized = english_name.lower().replace(' ', '')
        
        if tag_lower == key_normalized or tag_lower == english_normalized:
            return (normalized_tag, label, english_name)
    
    # Check against ML-detected entities (fuzzy match)
    for ent in entities:
        ent_text_normalized = ent["text"].lower().replace(' ', '')
        if tag_lower == ent_text_normalized:
            return (ent["text"], ent["label"], ent.get("identified_as"))
    
    # Check by removing common suffixes/variations
    # e.g., "gameofthrones" should match "Game of Thrones"
    for ent in entities:
        ent_clean = ent["text"].lower().replace(' ', '').replace('the', '').replace('of', '')
        tag_clean = tag_lower.replace('the', '').replace('of', '')
        if tag_clean == ent_clean and len(tag_clean) > 3:
            return (ent["text"], ent["label"], ent.get("identified_as"))
    
    return None

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

    # 1. Generate disambiguation for ALL entities
    processed_entities = []
    for ent in entities:
        entity_text = ent["text"]
        
        # Get English name for search
        if ent.get("identified_as"):
            english_name = ent["identified_as"]
        else:
            english_name = await transliterate_to_english(entity_text)
        
        processed_entities.append({
            "original": entity_text,
            "english": english_name,
            "label": ent.get("label", "MISC")
        })
        
        # Try to fetch Wikipedia data for this entity
        wiki_data = await fetch_wikipedia_summary(english_name)
        if not wiki_data and english_name != entity_text:
            wiki_data = await fetch_wikipedia_summary(entity_text)
        
        if wiki_data:
            context["disambiguation"].append({
                "entity": entity_text,
                "identified_as": wiki_data["title"],
                "description": wiki_data["description"]
            })
            context["is_generated"] = True

    # 2. Build news query from multiple entities
    # Prioritize: People > Organizations > Locations
    english_names = [e["english"] for e in processed_entities]
    
    # Sort entities by priority for news query
    people = [e for e in processed_entities if e["label"] == "PER"]
    orgs = [e for e in processed_entities if e["label"] == "ORG"]
    locations = [e for e in processed_entities if e["label"] in ["GPE", "LOC"]]
    others = [e for e in processed_entities if e["label"] not in ["PER", "ORG", "GPE", "LOC"]]
    
    priority_order = people + orgs + locations + others
    
    # Build query with top 3 entities
    seen = set()
    query_parts = []
    for ent in priority_order:
        if ent["english"] not in seen and len(query_parts) < 3:
            seen.add(ent["english"])
            query_parts.append(ent["english"])
    
    news_query = " ".join(query_parts) if query_parts else (english_names[0] if english_names else "")
    
    if not news_query:
        return context
    
    # Combine both original + English names for relevance matching
    all_names = set(e["original"] for e in processed_entities) | set(english_names)

    news_data = await fetch_google_news(news_query, entity_names=list(all_names))

    # 3. Validate news relevance — headline must mention at least one entity
    if news_data:
        headline_lower = news_data["headline"].lower()
        all_names_lower = {name.lower() for name in all_names}
        is_relevant = any(name in headline_lower for name in all_names_lower)

        if is_relevant:
            context["news"] = news_data
            context["is_generated"] = True
        else:
            # Retry with just the first entity
            if english_names:
                fallback_data = await fetch_google_news(english_names[0], entity_names=list(all_names))
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

    # 3. Extract and process hashtags & mentions
    hashtags, mentions = extract_hashtags_and_mentions(text)
    hashtag_mention_entities = []
    
    # Combined entities so far for matching
    all_entities_so_far = dict_entities + ml_entities
    detected_normalized = {ent["text"].lower().replace(' ', '') for ent in all_entities_so_far}
    
    # Process hashtags
    for tag in hashtags:
        normalized = normalize_hashtag(tag)
        normalized_key = normalized.lower().replace(' ', '')
        
        # Skip if already detected
        if normalized_key in detected_normalized:
            continue
        
        # Try to find a matching entity
        match = find_matching_entity(normalized, all_entities_so_far, KNOWN_ENTITIES)
        
        if match:
            matched_text, label, identified_as = match
            # Use the hashtag as display but link to the matched entity
            hashtag_mention_entities.append({
                "text": f"#{tag}",
                "label": label,
                "confidence": 0.9,
                "source": "hashtag",
                "identified_as": identified_as or matched_text
            })
        else:
            # New entity from hashtag - default to ORG/MISC based on common patterns
            # Proper nouns are often ORG (brands, shows, etc.)
            hashtag_mention_entities.append({
                "text": f"#{tag}",
                "label": "ORG",  # Default: hashtags often refer to brands/shows/events
                "confidence": 0.7,
                "source": "hashtag",
                "identified_as": normalized.title() if normalized != tag else None
            })
        
        detected_normalized.add(normalized_key)
    
    # Process @mentions as PER entities
    for mention in mentions:
        mention_lower = mention.lower()
        
        # Skip if already detected as an entity
        if mention_lower in detected_normalized:
            continue
        
        hashtag_mention_entities.append({
            "text": f"@{mention}",
            "label": "PER",
            "confidence": 0.9,
            "source": "mention"
        })
        detected_normalized.add(mention_lower)

    # 4. Merge: Dictionary first, then hashtags/mentions, then ML entities
    final_entities = dict_entities + hashtag_mention_entities + ml_entities

    # 5. Risk Logic
    violent = any(word in text_lower for word in VIOLENT_KEYWORDS)
    contains_sensitive = any(ent.get("label") in SENSITIVE_LABELS for ent in final_entities)

    risk_score = 0.0
    if violent and contains_sensitive:
        risk_score = 0.95
    elif violent:
        risk_score = 0.7
    elif contains_sensitive:
        risk_score = 0.4

    # 6. Generate Context
    context_data = await generate_context(final_entities, text)

    return {
        "entities": final_entities,
        "risk_score": risk_score,
        "violent_detected": violent,
        "contains_sensitive_entity": contains_sensitive,
        "context_data": context_data
    }