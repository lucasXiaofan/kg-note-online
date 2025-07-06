from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
import json
import os
from dotenv import load_dotenv
from typing import List, Optional
import logging
from datetime import datetime, timedelta
import sys
import jwt
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Knowledge Weaver API",
    description="API for categorizing notes and managing categories with knowledge graph",
    version="2.0.0"
)

# Initialize Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    # Use service account file (local) or service account from environment (Cloud Run)
    if os.path.exists("config/kg-note-credential.json"):
        cred = credentials.Certificate("config/kg-note-credential.json")
    else:
        # Use default service account in Cloud Run
        cred = credentials.ApplicationDefault()
    firebase_app = firebase_admin.initialize_app(cred)
    db = firestore.client(database_id="kg-note")
    logger.info("Firebase Admin SDK initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
    db = None

# Add CORS middleware for browser requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "file://",  # Allow file:// for local HTML files
        "null",     # Allow null origin for local files
        "https://*.run.app",  # Allow Cloud Run domains
        "https://*.googleapis.com"  # Allow Google APIs
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Security
security = HTTPBearer()

# Pydantic models
class WebpageMetadata(BaseModel):
    title: str = ""
    url: str = ""
    domain: str = ""
    summary: str = ""

class Note(BaseModel):
    content: str
    url: str = ""
    metadata: WebpageMetadata = None
    timestamp: Optional[int] = None
    categories: Optional[List[str]] = None

class Category(BaseModel):
    category: str
    definition: str

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

# Legacy file-based category management
CATEGORIES_FILE = "../../data/categories.json"

def read_categories():
    if not os.path.exists(CATEGORIES_FILE):
        return []
    with open(CATEGORIES_FILE, "r") as f:
        return json.load(f)

def write_categories(categories):
    os.makedirs(os.path.dirname(CATEGORIES_FILE), exist_ok=True)
    with open(CATEGORIES_FILE, "w") as f:
        json.dump(categories, f, indent=2)

# JWT Functions
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

# Try to import and initialize modular services
try:
    from api.llm.llm_service import LLMService
    from api.database.db_service import DatabaseService
    
    # Initialize services if available
    llm_service = LLMService() if os.getenv("DEEPSEEK_API_KEY") else None
    db_service = DatabaseService(db) if db else None
    
    logger.info("Modular services loaded successfully")
except ImportError as e:
    logger.warning(f"Could not load modular services: {e}")
    llm_service = None
    db_service = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    firebase_status = "connected" if db else "disconnected"
    return {
        "status": "healthy", 
        "message": "Knowledge Weaver API is running",
        "firebase": firebase_status,
        "services": {
            "llm": "available" if llm_service else "unavailable",
            "database": "available" if db_service else "unavailable"
        }
    }

# Authentication Endpoints
@app.post("/auth/google", response_model=AuthResponse)
async def google_login(login_request: GoogleLoginRequest):
    """Login with Google OAuth"""
    try:
        # Verify Google token and get user info
        user_info = verify_google_token(login_request.id_token)
        
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
        access_token = create_access_token(user_info)
        
        return AuthResponse(
            access_token=access_token,
            token_type="Bearer",
            user_id=user_info["user_id"],
            email=user_info["email"],
            name=user_info["name"],
            expires_in=JWT_EXPIRATION_HOURS * 3600
        )
        
    except Exception as e:
        logger.error(f"Google login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed"
        )

@app.post("/auth/chrome-extension", response_model=AuthResponse)
async def chrome_extension_login(auth_request: ChromeExtensionAuthRequest):
    """Login from Chrome extension using access token and user info"""
    try:
        # Verify the access token with Google
        verify_response = await verify_chrome_access_token(auth_request.access_token)
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
        access_token = create_access_token(standardized_user_info)
        
        return AuthResponse(
            access_token=access_token,
            token_type="Bearer",
            user_id=standardized_user_info["user_id"],
            email=standardized_user_info["email"],
            name=standardized_user_info["name"],
            expires_in=JWT_EXPIRATION_HOURS * 3600
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chrome extension login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chrome extension authentication failed"
        )

@app.get("/auth/me", response_model=UserInfo)
async def get_current_user(current_user: UserInfo = Depends(verify_token)):
    """Get current user information"""
    return current_user

# Notes Management
@app.post("/notes")
async def create_note(note: Note, current_user: UserInfo = Depends(verify_token)):
    """Create a new note for a user"""
    logger.info(f"🔍 CREATE_NOTE called by user: {current_user.user_id}")
    logger.info(f"🔍 DB available: {db is not None}")
    logger.info(f"🔍 DB Service available: {db_service is not None}")
    logger.info(f"🔍 LLM Service available: {llm_service is not None}")
    
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get categorization using user-specific categories from database
        categories = ["General"]
        if llm_service:
            try:
                context_data = {
                    'url': note.metadata.url if note.metadata else note.url,
                    'title': note.metadata.title if note.metadata else "",
                    'domain': note.metadata.domain if note.metadata else ""
                }
                
                # Get user-specific categories from database, fallback to file
                if db_service:
                    try:
                        existing_categories = await db_service.get_user_categories(current_user.user_id)
                        logger.info(f"🔍 Found {len(existing_categories)} user categories for categorization")
                    except Exception as e:
                        logger.error(f"Error getting user categories: {e}")
                        existing_categories = read_categories()
                else:
                    existing_categories = read_categories()
                
                categorization_result = await llm_service.categorize_note(
                    note.content, 
                    context_data, 
                    existing_categories
                )
                categories = categorization_result.get("categories", ["General"])
                
                # Save new categories to user's database if suggested by LLM
                if db_service and "new_categories" in categorization_result and categorization_result["new_categories"]:
                    for new_cat in categorization_result["new_categories"]:
                        try:
                            # Check if category already exists for this user
                            user_categories = await db_service.get_user_categories(current_user.user_id)
                            existing_names = [cat["category"].lower() for cat in user_categories]
                            
                            if new_cat["category"].lower() not in existing_names:
                                await db_service.create_category(current_user.user_id, new_cat)
                                logger.info(f"✅ Added new category to database: {new_cat['category']}")
                            else:
                                logger.info(f"⚠️ Category already exists: {new_cat['category']}")
                        except Exception as e:
                            logger.error(f"Error adding new category to database: {e}")
                
            except Exception as e:
                logger.error(f"LLM categorization failed: {e}")
        
        # Prepare note data
        note_data = {
            'content': note.content,
            'categories': categories,
            'metadata': {
                'title': note.metadata.title if note.metadata else "",
                'url': note.metadata.url if note.metadata else note.url,
                'domain': note.metadata.domain if note.metadata else "",
                'summary': note.metadata.summary if note.metadata else ""
            },
            'createdAt': datetime.now(),
            'updatedAt': datetime.now(),
            'userId': current_user.user_id
        }
        
        logger.info(f"📝 Saving note to database for user: {current_user.user_id}")
        logger.info(f"📝 Note categories: {categories}")
        logger.info(f"📝 Note content length: {len(note.content)}")
        
        # Save to Firestore
        notes_collection = db.collection('users').document(current_user.user_id).collection('notes')
        doc_ref = notes_collection.add(note_data)
        
        logger.info(f"✅ Note saved successfully with ID: {doc_ref[1].id}")
        
        return {
            "noteId": doc_ref[1].id,
            "categories": categories,
            "message": "Note created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notes")
async def get_user_notes(current_user: UserInfo = Depends(verify_token), limit: int = 50):
    """Get all notes for a user"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        notes_collection = db.collection('users').document(current_user.user_id).collection('notes')
        notes_query = notes_collection.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(limit)
        
        notes = []
        for doc in notes_query.stream():
            note_data = doc.to_dict()
            note_data['id'] = doc.id
            notes.append(note_data)
        
        return {"notes": notes}
        
    except Exception as e:
        logger.error(f"Error getting notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Category Management Endpoints
@app.get("/categories")
async def get_user_categories(current_user: UserInfo = Depends(verify_token)):
    """Get all categories for a user"""
    logger.info(f"🔍 GET_CATEGORIES called by user: {current_user.user_id}")
    logger.info(f"🔍 DB Service available: {db_service is not None}")
    
    if not db_service:
        # Fallback to file-based categories
        return {"categories": read_categories()}
    
    try:
        categories = await db_service.get_user_categories(current_user.user_id)
        return {"categories": categories}
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        # Fallback to file-based categories
        return {"categories": read_categories()}

@app.post("/categories")
async def add_category(category: Category, current_user: UserInfo = Depends(verify_token)):
    """Add a new category"""
    logger.info(f"🔍 ADD_CATEGORY called by user: {current_user.user_id}")
    logger.info(f"🔍 Category data: {category.model_dump()}")
    logger.info(f"🔍 DB Service available: {db_service is not None}")
    
    if not db_service:
        # Fallback to file-based categories
        categories = read_categories()
        
        # Check if category already exists
        for existing in categories:
            if existing["category"].lower() == category.category.lower():
                raise HTTPException(status_code=400, detail="Category already exists")
        
        categories.append(category.model_dump())
        write_categories(categories)
        return {"message": "Category added successfully", "category": category.model_dump()}
    
    try:
        # Check if category already exists
        existing_categories = await db_service.get_user_categories(current_user.user_id)
        for existing in existing_categories:
            if existing["category"].lower() == category.category.lower():
                raise HTTPException(status_code=400, detail="Category already exists")
        
        category_data = category.model_dump()
        category_id = await db_service.create_category(current_user.user_id, category_data)
        
        return {"message": "Category added successfully", "category_id": category_id, "category": category_data}
        
    except Exception as e:
        logger.error(f"Error adding category: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/categories/{category_id}")
async def update_category(category_id: str, category: Category, current_user: UserInfo = Depends(verify_token)):
    """Update a category by ID"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database service not available for updates")
    
    try:
        # Check if category exists
        existing_category = await db_service.get_category_by_id(current_user.user_id, category_id)
        if not existing_category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check if new name conflicts with existing categories (excluding current one)
        existing_categories = await db_service.get_user_categories(current_user.user_id)
        for existing in existing_categories:
            if existing["id"] != category_id and existing["category"].lower() == category.category.lower():
                raise HTTPException(status_code=400, detail="Category name already exists")
        
        update_data = category.model_dump()
        await db_service.update_category(current_user.user_id, category_id, update_data)
        
        return {"message": "Category updated successfully", "category": update_data}
        
    except Exception as e:
        logger.error(f"Error updating category: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: UserInfo = Depends(verify_token)):
    """Delete a category by ID"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database service not available for deletions")
    
    try:
        # Check if category exists
        existing_category = await db_service.get_category_by_id(current_user.user_id, category_id)
        if not existing_category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        await db_service.delete_category(current_user.user_id, category_id)
        
        return {"message": "Category deleted successfully", "deleted_category": existing_category}
        
    except Exception as e:
        logger.error(f"Error deleting category: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/categorize")
async def categorize_note(note: Note, current_user: UserInfo = Depends(verify_token)):
    """Categorize a note"""
    try:
        if llm_service:
            context_data = {
                'url': note.metadata.url if note.metadata else note.url,
                'title': note.metadata.title if note.metadata else "",
                'domain': note.metadata.domain if note.metadata else ""
            }
            
            # Get user-specific categories from database, fallback to file
            if db_service:
                try:
                    existing_categories = await db_service.get_user_categories(current_user.user_id)
                except Exception as e:
                    logger.error(f"Error getting user categories: {e}")
                    existing_categories = read_categories()
            else:
                existing_categories = read_categories()
            
            result = await llm_service.categorize_note(note.content, context_data, existing_categories)
            
            # Save new categories to user's database if suggested by LLM
            if db_service and "new_categories" in result and result["new_categories"]:
                for new_cat in result["new_categories"]:
                    try:
                        await db_service.create_category(current_user.user_id, new_cat)
                        logger.info(f"Added new category to database: {new_cat['category']}")
                    except Exception as e:
                        logger.error(f"Error adding new category to database: {e}")
            
            return result
        else:
            return {"categories": ["General"]}
    except Exception as e:
        logger.error(f"Error in categorization: {e}")
        return {"categories": ["General"]}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)