from fastapi import APIRouter, HTTPException
from datetime import datetime
from pydantic import BaseModel

from app.models.user import UserCreate
from app.services.database import db
from app.auth.hash import hash_password, verify_password
from app.auth.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


class UserLogin(BaseModel):
    email: str
    password: str


@router.post("/signup")
async def signup(user: UserCreate):
    existing = await db.users.find_one({
        "$or": [
            {"email": user.email},
            {"username": user.username}
        ]
    })

    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    new_user = {
        "username": user.username,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "bio": "",
        "followers": [],
        "following": [],
        "created_at": datetime.utcnow()
    }

    result = await db.users.insert_one(new_user)

    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="User creation failed")

    return {"message": "User created successfully"}


@router.post("/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})

    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token({
        "user_id": str(user["_id"]),
        "username": user["username"]
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }
