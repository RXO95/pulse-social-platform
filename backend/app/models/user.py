from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserInDB(BaseModel):
    username: str
    email: EmailStr
    password_hash: str
    bio: str = ""
    followers: list = []
    following: list = []
    created_at: datetime
