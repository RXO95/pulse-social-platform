from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URI, DB_NAME

client = AsyncIOMotorClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000
)

db = client.get_database(DB_NAME)
