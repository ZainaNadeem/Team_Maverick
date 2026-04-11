from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse
from fastapi import HTTPException, status

fake_users_db: dict[str, User] = {}


def register_user(data: UserRegister) -> UserResponse:
    if data.email in fake_users_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    new_user = User(
        username=data.username,
        email=data.email,
        password=data.password,  # TODO: hash in production
    )

    fake_users_db[new_user.email] = new_user

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
    )


def login_user(data: UserLogin) -> UserResponse:
    user = fake_users_db.get(data.email)

    if not user or user.password != data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
    )