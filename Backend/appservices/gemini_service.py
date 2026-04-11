import os
import base64
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None


def run_prompt(prompt: str, file_base64: str = None, mime_type: str = None) -> str:
    """Call Gemini with a text prompt and an optional inline file attachment."""
    if not client:
        raise ValueError("GEMINI_API_KEY is not set in the .env file.")

    parts = [types.Part(text=prompt)]

    if file_base64 and mime_type:
        parts.append(types.Part(
            inline_data=types.Blob(
                mime_type=mime_type,
                data=base64.b64decode(file_base64)
            )
        ))

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=types.Content(parts=parts, role="user")
    )
    return response.text
