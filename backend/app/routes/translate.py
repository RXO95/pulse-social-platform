from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from deep_translator import GoogleTranslator
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/translate", tags=["Translation"])

class TranslationRequest(BaseModel):
    text: str
    target_lang: str = "en"

@router.post("/")
async def translate_text(request: TranslationRequest, user=Depends(get_current_user)):
    try:
        # GoogleTranslator handles Indian languages (hi, bn, kn, mr) automatically
        translated = GoogleTranslator(source='auto', target=request.target_lang).translate(request.text)
        return {"translated_text": translated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))