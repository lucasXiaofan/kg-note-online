from pydantic import BaseModel
from typing import Optional

class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    verified_email: bool = False

class TokenData(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    id_token: str

class ChromeExtensionAuthRequest(BaseModel):
    access_token: str
    user_info: dict

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    name: str
    expires_in: int

class UserInfo(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_anonymous: bool = False