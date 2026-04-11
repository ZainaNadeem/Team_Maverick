from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
from appservices.gemini_service import run_prompt

router = APIRouter()


class AnalyseRequest(BaseModel):
    prompt: str
    file_base64: Optional[str] = None
    mime_type: Optional[str] = None


@router.get("/health")
def health_check():
    return {"status": "API is working"}


@router.post("/analyse")
def analyse(req: AnalyseRequest):
    try:
        result = run_prompt(req.prompt, req.file_base64, req.mime_type)
        return {"result": result}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")
