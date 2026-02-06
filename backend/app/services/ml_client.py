import os
import httpx
import urllib.parse
import xml.etree.ElementTree as ET
import re  # Added for regex matching

ML_URL = os.getenv("ML_SERVICE_URL")

VIOLENT_KEYWORDS = [
    "kill", "murder", "shoot", "rape",
    "die", "death", "attack", "bomb",
    "hang", "stab"
]

SENSITIVE_LABELS = {"PER", "ORG", "GPE", "LOC"}

# --- 1. NEW: Dictionary for Missing Entities ---
# Format: "lowercase_slang": ("Correct Casing", "Label")
KNOWN_ENTITIES = {
    "raga": ("RaGa", "PER"),
    "namo": ("NaMo", "PER"),
    "modi": ("Modi Ji", "PER"),
    "rahul": ("Rahul Gandhi", "PER"),
    "pappu": ("Rahul Gandhi", "PER"),  # Handle slang/nicknames
    "kejri": ("Arvind Kejriwal", "PER")
}

async def fetch_wikipedia_summary(query: str):
    """
    Fetches a brief summary from Wikipedia to disambiguate entities.
    """
    try:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(query)}"
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(url, follow_redirects=True)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "title": data.get("title"),
                    "description": data.get("description"),
                    "extract": data.get("extract", "")[:150] + "..."
                }
    except:
        return None
    return None


async def fetch_google_news(query: str):
    """
    Fetches the latest headline from Google News RSS.
    """
    try:
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(rss_url)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                first_item = root.find(".//item")
                if first_item is not None:
                    title = first_item.find("title").text
                    link = first_item.find("link").text
                    return {"headline": title, "url": link}
    except:
        return None
    return None


async def generate_context(entities):
    """
    Generates the Pulse Context / Community Note based on extracted entities.
    """
    context = {
        "is_generated": False,
        "disambiguation": [],
        "news": None
    }

    if not entities:
        return context

    people = [e["text"] for e in entities if e["label"] == "PER"]
    locations = [e["text"] for e in entities if e["label"] in ["GPE", "LOC"]]

    # Prioritize people for context, then locations
    main_subject = people[0] if people else (locations[0] if locations else None)
    
    if main_subject:
        # Check if it's a known slang (like RaGa) and use the full name for Wiki search
        # This helps getting better Wiki results (Searching "Rahul Gandhi" instead of "RaGa")
        search_query = main_subject
        lower_subj = main_subject.lower()
        if lower_subj in KNOWN_ENTITIES:
            search_query = KNOWN_ENTITIES[lower_subj][0] # Use "Rahul Gandhi"

        wiki_data = await fetch_wikipedia_summary(search_query)
        
        if wiki_data:
            context["disambiguation"].append({
                "entity": main_subject,
                "identified_as": wiki_data["title"],
                "description": wiki_data["description"]
            })
            context["is_generated"] = True

    # News Fetching
    news_query = ""
    if people and locations:
        news_query = f"{people[0]} {locations[0]}"
    elif main_subject:
         # Use the mapped name for better news results too
        search_query = main_subject
        lower_subj = main_subject.lower()
        if lower_subj in KNOWN_ENTITIES:
            search_query = KNOWN_ENTITIES[lower_subj][0]
        news_query = search_query

    if news_query:
        news_data = await fetch_google_news(news_query)
        if news_data:
            context["news"] = news_data
            context["is_generated"] = True

    return context


async def analyze_text(text: str):
    # Default Result Structure
    ner_result = {"entities": []}

    # 1. 🔌 Call ML service (The "Smart" but imperfect part)
    if ML_URL:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                response = await client.post(
                    ML_URL,
                    json={"text": text}
                )
                response.raise_for_status()
                ner_result = response.json()
        except Exception:
            pass # Fail silently, we still have the dictionary fallback

    entities = ner_result.get("entities", [])
    
    # --- 2. NEW: Apply Dictionary Fallback (The "Rule-based" fix) ---
    detected_texts = {e["text"].lower() for e in entities} # Track what ML already found

    for word in text.split():
        clean_word = re.sub(r'[^\w]', '', word).lower() # Remove punctuation
        
        if clean_word in KNOWN_ENTITIES:
            # If ML missed it, add it manually
            if clean_word not in detected_texts:
                correct_text, label = KNOWN_ENTITIES[clean_word]
                entities.append({
                    "text": word,       # The actual word in text (e.g., "RaGa")
                    "label": label,     # Force "PER"
                    "confidence": 1.0   # 100% confident because it's hardcoded
                })
                detected_texts.add(clean_word) # Prevent duplicates

    # 3. Standard Risk Logic
    text_lower = text.lower()
    violent = any(word in text_lower for word in VIOLENT_KEYWORDS)
    contains_sensitive = any(
        ent.get("label") in SENSITIVE_LABELS for ent in entities
    )

    risk_score = 0.0
    if violent and contains_sensitive:
        risk_score = 0.95
    elif violent:
        risk_score = 0.7
    elif contains_sensitive:
        risk_score = 0.4

    # 4. Generate Context (Now with improved entities from dictionary)
    context_data = await generate_context(entities)

    return {
        "entities": entities,
        "risk_score": risk_score,
        "violent_detected": violent,
        "contains_sensitive_entity": contains_sensitive,
        "context_data": context_data
    }