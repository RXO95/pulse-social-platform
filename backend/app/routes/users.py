from fastapi import APIRouter, Depends
from bson import ObjectId

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me")
async def my_profile(user=Depends(get_current_user)):
    user_data = await db.users.find_one(
        {"_id": ObjectId(user["user_id"])}
    )

    if not user_data:
        return {"error": "User not found"}

    user_data["_id"] = str(user_data["_id"])
    user_data.pop("password", None)

    return user_data
