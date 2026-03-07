"""
Widget routes — News & Weather proxies
=======================================
• /widgets/news   — proxies Google News RSS → JSON
• /widgets/weather is handled client-side via Open-Meteo (no key needed)
"""

import asyncio
from xml.etree import ElementTree
from urllib.request import urlopen, Request
from datetime import datetime

from fastapi import APIRouter

router = APIRouter(prefix="/widgets", tags=["Widgets"])


def _fetch_url(url: str, timeout: int = 8) -> str:
    """Synchronous fetch — run in executor for async."""
    req = Request(url, headers={"User-Agent": "PulseApp/1.0"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8")


def _parse_relative_time(pub_date: str) -> str:
    """Convert RSS pubDate to relative time string."""
    try:
        # Format: "Sat, 08 Mar 2026 12:00:00 GMT"
        dt = datetime.strptime(pub_date.strip(), "%a, %d %b %Y %H:%M:%S %Z")
        diff = (datetime.utcnow() - dt).total_seconds()
        if diff < 60:
            return "now"
        if diff < 3600:
            return f"{int(diff // 60)}m ago"
        if diff < 86400:
            return f"{int(diff // 3600)}h ago"
        return f"{int(diff // 86400)}d ago"
    except Exception:
        return ""


@router.get("/news")
async def get_news(country: str = "in", lang: str = "en"):
    """
    Fetch top headlines from Google News RSS.
    Supports country codes: in, us, gb, etc.
    """
    url = (
        f"https://news.google.com/rss"
        f"?hl={lang}-{country.upper()}"
        f"&gl={country.upper()}"
        f"&ceid={country.upper()}:{lang}"
    )

    loop = asyncio.get_event_loop()
    try:
        raw_xml = await loop.run_in_executor(None, _fetch_url, url)
    except Exception:
        return []

    try:
        root = ElementTree.fromstring(raw_xml)
    except Exception:
        return []

    items = []
    for item in root.findall(".//item")[:15]:
        title_el = item.find("title")
        link_el = item.find("link")
        pub_el = item.find("pubDate")
        source_el = item.find("source")

        title = title_el.text if title_el is not None else ""
        link = link_el.text if link_el is not None else ""
        pub_date = pub_el.text if pub_el is not None else ""
        source = source_el.text if source_el is not None else ""

        items.append({
            "title": title,
            "link": link,
            "source": source,
            "time_ago": _parse_relative_time(pub_date),
        })

    return items
