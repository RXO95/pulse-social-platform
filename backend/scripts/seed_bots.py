import os
import sys
import asyncio
from datetime import datetime

# Add the parent directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.database import client, DB_NAME
from app.auth.hash import hash_password

db = client.get_database(DB_NAME)

BOT_PROFILES = [
    {
        "username": "tech_bhaiya",
        "email": "tech_bhaiya@pulse.bots",
        "password": "botpassword123",
        "bio": "Tech, AI and Startups in Hinglish 🚀",
        "profile_pic_url": "https://api.dicebear.com/7.x/avataaars/png?seed=techbhaiya&backgroundColor=b6e3f4"
    },
    {
        "username": "mausam_mitra",
        "email": "mausam_mitra@pulse.bots",
        "password": "botpassword123",
        "bio": "Daily weather updates and alerts ⛅️",
        "profile_pic_url": "https://api.dicebear.com/7.x/avataaars/png?seed=mausam&backgroundColor=ffdfbf"
    },
    {
        "username": "cricket_kida",
        "email": "cricket_kida@pulse.bots",
        "password": "botpassword123",
        "bio": "Live sports, IPL highlights, and football banter 🏏⚽️",
        "profile_pic_url": "https://api.dicebear.com/7.x/avataaars/png?seed=cricket&backgroundColor=c0aede"
    },
    {
        "username": "cinema_baaz",
        "email": "cinema_baaz@pulse.bots",
        "password": "botpassword123",
        "bio": "Bollywood, Tollywood, Box office tracking 🍿🎞️",
        "profile_pic_url": "https://api.dicebear.com/7.x/avataaars/png?seed=cinema&backgroundColor=ffd5dc"
    },
    {
        "username": "daily_suvichar",
        "email": "daily_suvichar@pulse.bots",
        "password": "botpassword123",
        "bio": "Daily motivation and quotes ✨📖",
        "profile_pic_url": "https://api.dicebear.com/7.x/avataaars/png?seed=suvichar&backgroundColor=b6e3f4"
    }
]

async def seed_bots():
    for bot in BOT_PROFILES:
        existing = await db.users.find_one({"username": bot["username"]})
        if existing:
            print(f"Bot @{bot['username']} already exists.")
            continue
            
        new_user = {
            "username": bot["username"],
            "email": bot["email"],
            "password_hash": hash_password(bot["password"]),
            "bio": bot["bio"],
            "profile_pic_url": bot["profile_pic_url"],
            "followers": [],
            "following": [],
            "created_at": datetime.utcnow()
        }
        
        await db.users.insert_one(new_user)
        print(f"✅ Created bot @{bot['username']}")

if __name__ == "__main__":
    asyncio.run(seed_bots())
