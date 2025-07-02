from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel
import os
from dotenv import load_dotenv

from auth.google_auth import GoogleAuthHandler
from auth.models import UserProfile

load_dotenv()

app = FastAPI(
    title="Multi-Purpose API",
    description="FastAPI backend with Google OAuth and multiple functionalities",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()
google_auth = GoogleAuthHandler()

class AuthRequest(BaseModel):
    code: str
    redirect_uri: str

@app.get("/")
async def root():
    return {"message": "Multi-Purpose API with Google OAuth"}

@app.get("/auth/google/url")
async def get_google_auth_url():
    """Get Google OAuth authorization URL"""
    try:
        auth_url = google_auth.get_authorization_url()
        return {"auth_url": auth_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/google/callback")
async def google_auth_callback(auth_request: AuthRequest):
    """Handle Google OAuth callback"""
    try:
        user_info = await google_auth.exchange_code_for_token(
            auth_request.code, 
            auth_request.redirect_uri
        )
        return {"user": user_info, "success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/auth/profile")
async def get_user_profile(token: str = Depends(security)):
    """Get user profile information"""
    try:
        profile = await google_auth.get_user_profile(token.credentials)
        return profile
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# Placeholder for additional API endpoints
@app.get("/api/placeholder")
async def placeholder_endpoint():
    """Placeholder for additional API functionality"""
    return {"message": "This is a placeholder for additional API features"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)