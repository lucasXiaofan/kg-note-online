from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import requests
from datetime import datetime, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from .models import UserInfo, AuthResponse, GoogleLoginRequest, ChromeExtensionAuthRequest
import os
import logging

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Security
security = HTTPBearer()

class AuthService:
    @staticmethod
    def create_access_token(user_data: dict) -> str:
        """Create a JWT access token"""
        expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
        to_encode = {
            "user_id": user_data["user_id"],
            "email": user_data["email"], 
            "name": user_data["name"],
            "exp": expire,
            "iat": datetime.utcnow()
        }
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return encoded_jwt

    @staticmethod
    def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserInfo:
        """Verify and decode JWT token"""
        try:
            token = credentials.credentials
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            
            return UserInfo(
                user_id=payload["user_id"],
                email=payload["email"],
                name=payload["name"],
                is_anonymous=payload.get("is_anonymous", False)
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    @staticmethod
    def verify_google_token(id_token_str: str) -> dict:
        """Verify Google ID token and return user info"""
        try:
            if not GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Google Client ID not configured"
                )
            
            # Verify the token
            idinfo = id_token.verify_oauth2_token(
                id_token_str, 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID
            )
            
            # Validate issuer
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
            
            return {
                "user_id": f"google_{idinfo['sub']}",
                "email": idinfo["email"],
                "name": idinfo["name"],
                "picture": idinfo.get("picture"),
                "google_id": idinfo["sub"]
            }
            
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {str(e)}"
            )

    @staticmethod
    async def verify_chrome_access_token(access_token: str) -> bool:
        """Verify Chrome extension access token with Google"""
        try:
            response = requests.get(
                'https://www.googleapis.com/oauth2/v1/tokeninfo',
                params={'access_token': access_token}
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return False

    @staticmethod
    def create_anonymous_user():
        """Create an anonymous user session"""
        import uuid
        user_id = f"anonymous_{uuid.uuid4().hex[:8]}"
        return user_id

    @staticmethod
    def get_jwt_expiration_hours() -> int:
        return JWT_EXPIRATION_HOURS