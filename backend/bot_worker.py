import os
import sys
import time
import asyncio
import schedule
import requests
import random
from datetime import datetime

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.database import client, DB_NAME
db = client.get_database(DB_NAME)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

BOTS = {
    "tech_bhaiya": {
        "persona": "A tech enthusiast who posts about programming, AI, and startup news.",
        "language": "Hinglish",
        "api_endpoint": "https://saurav.tech/NewsAPI/top-headlines/category/technology/in.json",
        "post_prompt": "You are @tech_bhaiya. Write a short, casual social media post in Hinglish about this tech news: {data}. Add emojis and hashtags like #TechBhaiya."
    },
    "mausam_mitra": {
        "persona": "A weather enthusiast providing daily atmospheric updates or extreme weather alerts.",
        "language": "Hindi/Marathi",
        "api_endpoint": "https://api.open-meteo.com/v1/forecast?latitude=19.0760&longitude=72.8777&current_weather=true", # Mumbai weather
        "post_prompt": "You are @mausam_mitra. Write a short social media post in Hindi or Marathi about this Mumbai weather data: {data}. Add emojis."
    },
    "cricket_kida": {
        "persona": "A sports fanatic who posts daily cricket updates.",
        "language": "Hinglish",
        "api_endpoint": "https://saurav.tech/NewsAPI/top-headlines/category/sports/in.json",
        "post_prompt": "You are @cricket_kida. Write a short, passionate social media post in Hinglish about this sports news: {data}. Use cricket slang and emojis."
    },
    "cinema_baaz": {
        "persona": "A movie buff who posts about Bollywood, Tollywood, and trending movies.",
        "language": "Hinglish/Hindi",
        "api_endpoint": "https://saurav.tech/NewsAPI/top-headlines/category/entertainment/in.json",
        "post_prompt": "You are @cinema_baaz. Write a dramatic social media post in Hinglish about this entertainment news: {data}. Add emojis."
    },
    "daily_suvichar": {
        "persona": "Posts motivational or philosophical quotes daily.",
        "language": "Hindi/Kannada",
        "api_endpoint": "https://dummyjson.com/quotes/random",
        "post_prompt": "You are @daily_suvichar. Translate this quote into Hindi or Kannada and write a peaceful social media post about it: {data}."
    }
}

def ask_llm(prompt_text):
    if not GROQ_API_KEY:
        print("⚠️ No GROQ_API_KEY found. Cannot generate AI text.")
        return None
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are a social media personality. You write short, casual posts."},
            {"role": "user", "content": prompt_text}
        ],
        "temperature": 0.7,
        "max_tokens": 150
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip('\"\'')
    except Exception as e:
        print(f"Error calling LLM: {e}")
        return None

async def generate_post():
    print(f"[{datetime.now()}] Running post generation iteration...")
    bot_id = random.choice(list(BOTS.keys()))
    bot_config = BOTS[bot_id]
    
    # 1. Fetch raw data
    try:
        res = requests.get(bot_config["api_endpoint"], timeout=10)
        data = res.json()
    except Exception as e:
        print(f"Failed to fetch API data for {bot_id}: {e}")
        return

    raw_text = str(data)[:500] # Limit to prevent huge prompts
    
    if "saurav.tech" in bot_config["api_endpoint"]:
        # Extract a single news article for context
        articles = data.get("articles", [])
        if articles:
            article = random.choice(articles[:5])
            raw_text = f"Title: {article.get('title')}. Description: {article.get('description')}"
    elif "dummyjson" in bot_config["api_endpoint"]:
        raw_text = f"Quote: {data.get('quote')} by {data.get('author')}"
        
    # 2. Ask LLM to format it
    prompt = bot_config["post_prompt"].format(data=raw_text)
    post_content = ask_llm(prompt)
    
    if post_content:
        # 3. Create post in Database
        new_post = {
            "username": bot_id,
            "content": post_content,
            "likes": 0,
            "media_url": None,
            "created_at": datetime.utcnow()
        }
        await db.posts.insert_one(new_post)
        print(f"✅ Auto-posted as @{bot_id}: {post_content}")

async def generate_replies():
    print(f"[{datetime.now()}] Checking for replies...")
    bot_usernames = list(BOTS.keys())
    
    # Check the last 10 posts made by ANY bot
    recent_bot_posts = await db.posts.find({"username": {"$in": bot_usernames}}).sort("created_at", -1).to_list(length=10)
    
    for post in recent_bot_posts:
        post_id = str(post["_id"])
        bot_username = post["username"]
        bot_config = BOTS[bot_username]
        
        # Get the latest comment on this post
        latest_comment = await db.comments.find_one({"post_id": post_id}, sort=[("created_at", -1)])
        
        if latest_comment and latest_comment["username"] not in bot_usernames:
            # A real user commented! Check if we already replied to them.
            # We can tell if we replied if the absolute latest comment is OURS.
            # Here, the latest comment is NOT ours. So we should reply!
            
            print(f"User {latest_comment['username']} commented on {bot_username}'s post. Generating reply...")
            
            # Context for LLM
            prompt = (
                f"You are @{bot_username}. {bot_config['persona']} "
                f"You previously posted: '{post['content']}'. "
                f"A user named @{latest_comment['username']} just replied to your post saying: '{latest_comment['content']}'. "
                f"Write a short, engaging reply back to them. Keep it in {bot_config['language']}."
            )
            
            reply_text = ask_llm(prompt)
            if reply_text:
                # Fetch bot's user_id from DB
                bot_user = await db.users.find_one({"username": bot_username})
                if bot_user:
                    reply_doc = {
                        "post_id": post_id,
                        "user_id": str(bot_user["_id"]),
                        "username": bot_username,
                        "content": reply_text,
                        "gif_url": None,
                        "entities": [],
                        "likes": 0,
                        "created_at": datetime.utcnow()
                    }
                    await db.comments.insert_one(reply_doc)
                    
                    # Increment comment count on the post
                    await db.posts.update_one(
                        {"_id": post["_id"]},
                        {"$inc": {"comment_count": 1}}
                    )
                    print(f"✅ Replied to @{latest_comment['username']} as @{bot_username}")

def job_post():
    asyncio.run(generate_post())

def job_reply():
    asyncio.run(generate_replies())

# Scheduler setup
schedule.every(1).hours.do(job_post)
schedule.every(5).minutes.do(job_reply)

if __name__ == "__main__":
    print("🤖 Bot Backend Worker starting...")
    print(f"Available bots: {', '.join(BOTS.keys())}")
    
    # Run once at startup for testing
    job_post()
    
    while True:
        schedule.run_pending()
        time.sleep(1)
