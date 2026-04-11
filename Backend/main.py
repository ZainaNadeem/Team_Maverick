from fastapi import FastAPI
from app.api.auth_routes import router as auth_router

app = FastAPI()

app.include_router(auth_router)

@app.get("/")
def root():
    return {"message": "Backend running"}
