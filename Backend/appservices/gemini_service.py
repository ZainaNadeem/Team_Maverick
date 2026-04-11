import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found")

client = genai.Client(api_key=api_key)

def analyze_exam(exam_text: str) -> dict:
    try:
        prompt = f"""
        You are an expert exam analyzer. Analyze this exam and return:

        TOP 5 CONCEPTS:
        - List the 5 most tested concepts

        PREDICTED QUESTIONS:
        - Write 3 new questions likely to appear in the same style

        CRAM SHEET:
        - Write a one-page summary of the key points to study

        Exam content:
        {exam_text}
        """
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return {"analysis": response.text}
    except Exception as e:
        return {"error": str(e)}