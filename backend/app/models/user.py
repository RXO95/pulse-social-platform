from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    username: Optional[str] = None
    bio: Optional[str] = None


class UserInDB(BaseModel):
    username: str
    email: EmailStr
    password_hash: str
    bio: str = ""
    profile_pic_url: Optional[str] = None
    followers: list = []
    following: list = []
    created_at: datetime
