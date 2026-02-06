import os
import httpx
import urllib.parse
import xml.etree.ElementTree as ET
import re

ML_URL = os.getenv("ML_SERVICE_URL")

# Fake Browser Header to prevent blocking
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

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
        async with httpx.AsyncClient(timeout=4, headers=HEADERS) as client:
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


async def fetch_google_news(query: str):
    """Fetches News from Google RSS with proper headers."""
    try:
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
        async with httpx.AsyncClient(timeout=4, headers=HEADERS) as client:
            resp = await client.get(rss_url)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                # Iterate to find the first valid item
                for item in root.findall(".//item")[:3]: 
                    title = item.find("title").text
                    link = item.find("link").text
                    if title and link:
                        return {"headline": title, "url": link}
    except Exception as e:
        print(f"News Fetch Error: {e}")
    return None


async def generate_context(entities):
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
    
    # Check for Dictionary match first
    for ent in entities:
        if ent.get("confidence") == 1.0:
            best_subject = ent["text"]
            break
    
    # If no dictionary match, fallback to ML entities
    if not best_subject:
        people = [e["text"] for e in entities if e["label"] == "PER"]
        locations = [e["text"] for e in entities if e["label"] in ["GPE", "LOC"]]
        best_subject = people[0] if people else (locations[0] if locations else None)

    if not best_subject:
        return context

    # 2. Fetch Data (Independent Calls)
    # Wikipedia
    wiki_data = await fetch_wikipedia_summary(best_subject)
    if wiki_data:
        context["disambiguation"].append({
            "entity": best_subject,
            "identified_as": wiki_data["title"],
            "description": wiki_data["description"]
        })
        context["is_generated"] = True

    # News (If dictionary match exists, use that + location if available for better news)
    news_query = best_subject
    news_data = await fetch_google_news(news_query)
    
    if news_data:
        context["news"] = news_data
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
                dict_entities.append({
                    "text": english_name, # Use Official English Name
                    "label": label,
                    "confidence": 1.0,    # Mark as High Confidence
                    "source": "dictionary"
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
    context_data = await generate_context(final_entities)

    return {
        "entities": final_entities,
        "risk_score": risk_score,
        "violent_detected": violent,
        "contains_sensitive_entity": contains_sensitive,
        "context_data": context_data
    }