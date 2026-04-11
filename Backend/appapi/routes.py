from fastapi import APIRouter, UploadFile, File
from appservices.pdf_service import extract_text_from_pdf
from appservices.gemini_service import analyze_exam

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "API is working"}

@router.post("/upload-exam")
async def upload_exam(file: UploadFile = File(...)):
    contents = await file.read()
    text = extract_text_from_pdf(contents)
    analysis = analyze_exam(text)
    return {
        "filename": file.filename,
        "analysis": analysis
    }

@router.post("/upload-syllabus")
async def upload_syllabus(file: UploadFile = File(...)):
    contents = await file.read()
    text = extract_text_from_pdf(contents)
    analysis = analyze_exam(text)
    return {
        "filename": file.filename,
        "analysis": analysis
    }