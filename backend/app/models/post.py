from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PostCreate(BaseModel):
    content: str
    # media_url and media_type will be set from file upload


class PostInDB(BaseModel):
    user_id: str
    username: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # "image" or "video"
    likes: int = 0
    created_at: datetime
