from fastapi import APIRouter
from app.schemas.user import UserRegister, UserLogin, UserResponse
from app.services.auth_service import register_user, login_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: UserRegister):
    return register_user(payload)


@router.post("/login", response_model=UserResponse)
def login(payload: UserLogin):
    return login_user(payload)