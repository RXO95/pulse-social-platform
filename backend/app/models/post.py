from pydantic import BaseModel
from datetime import datetime


class PostCreate(BaseModel):
    content: str


class PostInDB(BaseModel):
    user_id: str
    username: str
    content: str
    likes: int = 0
    created_at: datetime
