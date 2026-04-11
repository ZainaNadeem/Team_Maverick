from fastapi import FastAPI
from appapi.routes import router
from app.api.auth_routes import router as auth_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Exam Review AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {"message": "Exam Review API is running"}
