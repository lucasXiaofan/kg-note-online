from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime
from .auth_service import AuthService
from .models import GoogleLoginRequest, ChromeExtensionAuthRequest, AuthResponse, UserInfo
from ..core.dependencies import get_db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/google", response_model=AuthResponse)
async def google_login(login_request: GoogleLoginRequest, db=Depends(get_db)):
    """Login with Google OAuth"""
    try:
        # Verify Google token and get user info
        user_info = AuthService.verify_google_token(login_request.id_token)
        
        # Create or update user in Firestore
        if db:
            user_doc = db.collection('users').document(user_info["user_id"])
            user_data = {
                'email': user_info["email"],
                'name': user_info["name"],
                'picture': user_info.get("picture"),
                'google_id': user_info["google_id"],
                'isAnonymous': False,
                'lastLogin': datetime.now(),
                'updatedAt': datetime.now()
            }
            
            # Check if user exists
            existing_user = user_doc.get()
            if not existing_user.exists:
                user_data['createdAt'] = datetime.now()
            
            user_doc.set(user_data, merge=True)
        
        # Create JWT token
        access_token = AuthService.create_access_token(user_info)
        
        return AuthResponse(
            access_token=access_token,
            token_type="Bearer",
            user_id=user_info["user_id"],
            email=user_info["email"],
            name=user_info["name"],
            expires_in=AuthService.get_jwt_expiration_hours() * 3600  # Convert to seconds
        )
        
    except Exception as e:
        logger.error(f"Google login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed"
        )

@router.post("/chrome-extension", response_model=AuthResponse)
async def chrome_extension_login(auth_request: ChromeExtensionAuthRequest, db=Depends(get_db)):
    """Login from Chrome extension using access token and user info"""
    try:
        # Verify the access token with Google
        verify_response = await AuthService.verify_chrome_access_token(auth_request.access_token)
        if not verify_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token"
            )
        
        user_info = auth_request.user_info
        
        # Validate required user info fields
        if not all(key in user_info for key in ['email', 'id']):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required user info"
            )
        
        # Create standardized user info
        standardized_user_info = {
            "user_id": user_info["id"],
            "email": user_info["email"],
            "name": user_info.get("name", user_info["email"]),
            "picture": user_info.get("picture"),
            "google_id": user_info["id"]
        }
        
        # Create or update user in Firestore
        if db:
            user_doc = db.collection('users').document(standardized_user_info["user_id"])
            user_data = {
                'email': standardized_user_info["email"],
                'name': standardized_user_info["name"],
                'picture': standardized_user_info.get("picture"),
                'google_id': standardized_user_info["google_id"],
                'isAnonymous': False,
                'lastLogin': datetime.now(),
                'updatedAt': datetime.now(),
                'source': 'chrome_extension'
            }
            
            # Check if user exists
            existing_user = user_doc.get()
            if not existing_user.exists:
                user_data['createdAt'] = datetime.now()
            
            user_doc.set(user_data, merge=True)
        
        # Create JWT token
        access_token = AuthService.create_access_token(standardized_user_info)
        
        return AuthResponse(
            access_token=access_token,
            token_type="Bearer",
            user_id=standardized_user_info["user_id"],
            email=standardized_user_info["email"],
            name=standardized_user_info["name"],
            expires_in=AuthService.get_jwt_expiration_hours() * 3600  # Convert to seconds
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chrome extension login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chrome extension authentication failed"
        )

@router.get("/me", response_model=UserInfo)
async def get_current_user(current_user: UserInfo = Depends(AuthService.verify_token)):
    """Get current user information"""
    return current_user

@router.post("/anonymous")
async def create_anonymous_user(db=Depends(get_db)):
    """Create an anonymous user session"""
    user_id = AuthService.create_anonymous_user()
    
    # Create user document in Firestore
    if db:
        try:
            user_doc = db.collection('users').document(user_id)
            user_doc.set({
                'isAnonymous': True,
                'createdAt': datetime.now(),
                'lastActive': datetime.now()
            })
            
            return {
                "userId": user_id,
                "isAnonymous": True,
                "message": "Anonymous user created successfully"
            }
        except Exception as e:
            logger.error(f"Error creating anonymous user: {e}")
            raise HTTPException(status_code=500, detail="Failed to create user")