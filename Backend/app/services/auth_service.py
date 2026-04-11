from app.db.database import supabase
from app.schemas.user import UserRegister, UserLogin, UserResponse
from fastapi import HTTPException, status


def register_user(data: UserRegister) -> UserResponse:
    # Check if email already exists
    existing = supabase.table("users").select("*").eq("email", data.email).execute()
    
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # Insert new user
    result = supabase.table("users").insert({
        "username": data.username,
        "email": data.email,
        "password": data.password  # TODO: hash in production
    }).execute()

    user = result.data[0]

    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"]
    )


def login_user(data: UserLogin) -> UserResponse:
    # Find user by email
    result = supabase.table("users").select("*").eq("email", data.email).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    user = result.data[0]

    if user["password"] != data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"]
    )