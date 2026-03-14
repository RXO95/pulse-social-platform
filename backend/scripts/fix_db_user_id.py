import sys
import os
import asyncio

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.database import client, DB_NAME
db = client.get_database(DB_NAME)

async def fix_missing_user_ids():
    # Find all posts missing a user_id
    posts = await db.posts.find({"user_id": {"$exists": False}}).to_list(length=None)
    
    if not posts:
        print("No broken posts found. Database is clean.")
        return
        
    for p in posts:
        # Look up the user by username to get the ID
        user = await db.users.find_one({"username": p.get("username")})
        if user:
            await db.posts.update_one(
                {"_id": p["_id"]},
                {"$set": {"user_id": str(user["_id"])}}
            )
            print(f"Fixed post {p['_id']} for {p['username']}")
        else:
            # If the user doesn't exist at all, safely delete the ghost post
            await db.posts.delete_one({"_id": p["_id"]})
            print(f"Deleted detached ghost post {p['_id']}")
            
    print("Database cleanup complete.")

if __name__ == "__main__":
    asyncio.run(fix_missing_user_ids())
