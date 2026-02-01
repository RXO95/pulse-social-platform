from pydantic import BaseModel
from typing import List


class TextRequest(BaseModel):
    text: str


class ModerationResponse(BaseModel):
    toxic: bool
    risk_score: float
    entities: List[str]
