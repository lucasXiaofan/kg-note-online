from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
import json
import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import List, Optional
import logging
from datetime import datetime, timedelta
import sys
import os
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
    
    # Use your actual service account file
    cred = credentials.Certificate("config/kg-note-credential.json")
    firebase_app = firebase_admin.initialize_app(cred)
    db = firestore.client(database_id="kg-note")
    logger.info("Firebase Admin SDK initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
    db = None

# Initialize Knowledge Graph Service
kg_service = None

# Add CORS middleware for browser requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "file://",  # Allow file:// for local HTML files
        "null"      # Allow null origin for local files
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("DEEPSEEK_API_KEY"), base_url="https://api.deepseek.com")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Security
security = HTTPBearer()

CATEGORIES_FILE = "../../data/categories.json"

class WebpageMetadata(BaseModel):
    title: str = ""
    url: str = ""
    domain: str = ""
    summary: str = ""

class Note(BaseModel):
    content: str
    url: str = ""  # Backward compatibility
    metadata: WebpageMetadata = None  # New structured metadata
    timestamp: Optional[int] = None
    categories: Optional[List[str]] = None

class KnowledgeGraphQuery(BaseModel):
    query: str
    entity_types: Optional[List[str]] = None
    limit: int = 20

class ImportData(BaseModel):
    notes: List[dict]
    categories: Optional[List[dict]] = None
    metadata: Optional[dict] = None

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

def read_categories():
    if not os.path.exists(CATEGORIES_FILE):
        return []
    with open(CATEGORIES_FILE, "r") as f:
        return json.load(f)

def write_categories(categories):
    # Ensure the directory exists
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

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    firebase_status = "connected" if db else "disconnected"
    return {
        "status": "healthy", 
        "message": "Knowledge Weaver API is running",
        "firebase": firebase_status
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
            expires_in=JWT_EXPIRATION_HOURS * 3600  # Convert to seconds
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
            expires_in=JWT_EXPIRATION_HOURS * 3600  # Convert to seconds
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chrome extension login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chrome extension authentication failed"
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

@app.get("/auth/me", response_model=UserInfo)
async def get_current_user(current_user: UserInfo = Depends(verify_token)):
    """Get current user information"""
    return current_user

# User Management (Simple session-based for now)
@app.post("/auth/anonymous")
async def create_anonymous_user():
    """Create an anonymous user session"""
    import uuid
    user_id = f"anonymous_{uuid.uuid4().hex[:8]}"
    
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
    else:
        raise HTTPException(status_code=503, detail="Database not available")

# Notes Management
@app.post("/notes")
async def create_note(note: Note, current_user: UserInfo = Depends(verify_token)):
    """Create a new note for a user"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get categorization first
        context_url = note.url
        context_title = ""
        context_domain = ""
        
        if note.metadata:
            context_url = note.metadata.url or note.url
            context_title = note.metadata.title
            context_domain = note.metadata.domain
        
        # Get AI categorization
        categories = await get_note_categorization(note)
        
        # Prepare note data
        note_data = {
            'content': note.content,
            'categories': categories,
            'metadata': {
                'title': context_title,
                'url': context_url,
                'domain': context_domain,
                'summary': note.metadata.summary if note.metadata else ""
            },
            'createdAt': datetime.now(),
            'updatedAt': datetime.now(),
            'userId': current_user.user_id
        }
        
        # Save to Firestore
        notes_collection = db.collection('users').document(current_user.user_id).collection('notes')
        doc_ref = notes_collection.add(note_data)
        
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

@app.put("/notes/{note_id}")
async def update_note(note_id: str, note: Note, current_user: UserInfo = Depends(verify_token)):
    """Update a note"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        note_ref = db.collection('users').document(current_user.user_id).collection('notes').document(note_id)
        
        update_data = {
            'content': note.content,
            'metadata': {
                'title': note.metadata.title if note.metadata else "",
                'url': note.metadata.url if note.metadata else note.url,
                'domain': note.metadata.domain if note.metadata else "",
                'summary': note.metadata.summary if note.metadata else ""
            },
            'updatedAt': datetime.now()
        }
        
        note_ref.update(update_data)
        
        return {"message": "Note updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: UserInfo = Depends(verify_token)):
    """Delete a note"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        note_ref = db.collection('users').document(current_user.user_id).collection('notes').document(note_id)
        note_ref.delete()
        
        return {"message": "Note deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/categories")
async def get_user_categories(current_user: UserInfo = Depends(verify_token)):
    """Get all categories for a user"""
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        categories_collection = db.collection('users').document(current_user.user_id).collection('categories')
        
        categories = []
        for doc in categories_collection.stream():
            category_data = doc.to_dict()
            category_data['id'] = doc.id
            categories.append(category_data)
        
        return {"categories": categories}
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_note_categorization(note: Note):
    """Get AI categorization for a note"""
    # This uses the existing categorization logic
    try:
        categories = read_categories()
        existing_categories = [f"{cat['category']}: {cat['definition']}" for cat in categories]
        
        system_prompt = """You are an expert knowledge manager. Analyze the note content and assign 1-3 relevant categories. 
        Use existing categories when they match, create new ones when needed.
        
        Return only a JSON object with this format:
        {"categories": ["Category1", "Category2"]}"""
        
        user_prompt = f"""Note Content: "{note.content}"
        
        Existing Categories: {existing_categories}
        
        Please categorize this note and respond with JSON only."""
        
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={'type': 'json_object'},
            temperature=0.1
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("categories", ["General"])
        
    except Exception as e:
        logger.error(f"Error getting categorization: {e}")
        return ["General"]

@app.get("/categories")
async def get_categories():
    """Get all categories"""
    return read_categories()

@app.post("/categories")
async def add_category(category: Category):
    """Add a new category"""
    categories = read_categories()
    
    # Check if category already exists
    for existing in categories:
        if existing["category"].lower() == category.category.lower():
            raise HTTPException(status_code=400, detail="Category already exists")
    
    categories.append(category.model_dump())
    write_categories(categories)
    return {"message": "Category added successfully", "category": category.model_dump()}

@app.put("/categories/{index}")
async def update_category(index: int, category: Category):
    """Update a category by index"""
    categories = read_categories()
    
    if index < 0 or index >= len(categories):
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if new name conflicts with existing categories (excluding current one)
    for i, existing in enumerate(categories):
        if i != index and existing["category"].lower() == category.category.lower():
            raise HTTPException(status_code=400, detail="Category name already exists")
    
    categories[index] = category.model_dump()
    write_categories(categories)
    return {"message": "Category updated successfully", "category": category.model_dump()}

@app.delete("/categories/{index}")
async def delete_category(index: int):
    """Delete a category by index"""
    categories = read_categories()
    
    if index < 0 or index >= len(categories):
        raise HTTPException(status_code=404, detail="Category not found")
    
    deleted_category = categories.pop(index)
    write_categories(categories)
    return {"message": "Category deleted successfully", "deleted_category": deleted_category}

@app.post("/categorize")
async def categorize_note(note: Note):
    # Extract URL and metadata for context
    context_url = note.url
    context_title = ""
    context_domain = ""
    
    if note.metadata:
        context_url = note.metadata.url or note.url
        context_title = note.metadata.title
        context_domain = note.metadata.domain
    
    print(f"Received categorization request: content='{note.content[:50]}...', url='{context_url}', title='{context_title}'")
    categories = read_categories()
    
    existing_categories = [f"{cat['category']}: {cat['definition']}" for cat in categories]
    
    system_prompt = """You are an expert knowledge manager who excels at categorizing content. Your goal is to help users organize their knowledge effectively by assigning relevant, meaningful categories.

INSTRUCTIONS:
1. Analyze the note content and identify ALL relevant topics, themes, and concepts
2. Assign 1-4 categories that best represent the content (multiple categories are encouraged for rich content)
3. Use existing categories when they match, create new ones when needed
4. Be creative and specific - help users discover connections they might not see
5. NEVER use "Uncategorized" - every piece of content has some categorizable aspect

RESPONSE FORMATS:

For single category (existing):
{
    "categories": ["Web Development"]
}

For multiple categories (mix of existing and new):
{
    "categories": ["Machine Learning", "Research Methods"],
    "new_categories": [
        {
            "category": "Research Methods",
            "definition": "Methodologies and approaches for conducting research and analysis"
        }
    ]
}

For multiple new categories:
{
    "categories": ["Data Visualization", "Business Intelligence"],
    "new_categories": [
        {
            "category": "Data Visualization", 
            "definition": "Techniques and tools for visual representation of data and insights"
        },
        {
            "category": "Business Intelligence",
            "definition": "Strategic use of data analytics for business decision making"
        }
    ]
}

Always provide meaningful, specific categories that help organize knowledge effectively."""

    # Build context information for better categorization
    context_info = f"URL: {context_url}"
    if context_title:
        context_info += f"\nPage Title: {context_title}"
    if context_domain:
        context_info += f"\nWebsite: {context_domain}"
    
    user_prompt = f"""Note Content: "{note.content}"

Webpage Context:
{context_info}

Existing Categories:
{json.dumps(existing_categories, indent=2)}

Please categorize this note considering both the content and the webpage context, and respond with JSON only."""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={'type': 'json_object'},
            temperature=0.1,
            stream=False
        )
        
        raw_response = response.choices[0].message.content
        print("DeepSeek API JSON Response:", raw_response)
        
        # Parse the JSON response
        category_data = json.loads(raw_response)
        
        # Validate the response structure
        if "categories" not in category_data:
            raise ValueError("Response missing required 'categories' field")
            
        print("Successfully parsed category data:", category_data)
        
        # Process new categories if they exist
        if "new_categories" in category_data and category_data["new_categories"]:
            existing_names = [cat["category"].lower() for cat in categories]
            for new_cat in category_data["new_categories"]:
                if new_cat["category"].lower() not in existing_names:
                    categories.append(new_cat)
                    existing_names.append(new_cat["category"].lower())
                    print(f"Added new category: {new_cat['category']}")
            write_categories(categories)

    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print(f"Raw response: {raw_response}")
        category_data = {"categories": ["General"], "definition": "JSON parsing failed"}
    except Exception as e:
        print(f"API call error: {e}")
        category_data = {"categories": ["General"], "definition": "API call failed"}

    # Add note to knowledge graph if service is available
    if kg_service:
        try:
            note_data = {
                "content": note.content,
                "timestamp": note.timestamp or int(time.time()),
                "categories": category_data.get("categories", []),
                "metadata": {
                    "title": context_title,
                    "url": context_url,
                    "domain": context_domain,
                    "summary": note.metadata.summary if note.metadata else ""
                }
            }
            await kg_service.add_note_entity(note_data)
            logger.info("Note added to knowledge graph")
        except Exception as e:
            logger.error(f"Failed to add note to knowledge graph: {e}")

    return category_data

# Knowledge Graph Endpoints

@app.post("/kg/notes")
async def add_note_to_kg(note: Note):
    """Add a note to the knowledge graph"""
    if not kg_service:
        raise HTTPException(status_code=503, detail="Knowledge Graph service not available")
    
    try:
        import time
        note_data = {
            "content": note.content,
            "timestamp": note.timestamp or int(time.time()),
            "categories": note.categories or [],
            "metadata": {
                "title": note.metadata.title if note.metadata else "",
                "url": note.metadata.url if note.metadata else note.url,
                "domain": note.metadata.domain if note.metadata else "",
                "summary": note.metadata.summary if note.metadata else ""
            }
        }
        
        note_id = await kg_service.add_note_entity(note_data)
        return {"message": "Note added to knowledge graph", "note_id": note_id}
        
    except Exception as e:
        logger.error(f"Failed to add note to knowledge graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/kg/notes/{note_id}/related")
async def get_related_notes(note_id: str, limit: int = 10):
    """Get notes related to a specific note"""
    if not kg_service:
        raise HTTPException(status_code=503, detail="Knowledge Graph service not available")
    
    try:
        related_notes = await kg_service.find_related_notes(note_id, limit)
        return {"related_notes": related_notes}
        
    except Exception as e:
        logger.error(f"Failed to get related notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/kg/search")
async def search_knowledge_graph(query: KnowledgeGraphQuery):
    """Search entities in the knowledge graph"""
    if not kg_service:
        raise HTTPException(status_code=503, detail="Knowledge Graph service not available")
    
    try:
        results = await kg_service.search_entities(
            query.query, 
            query.entity_types, 
            query.limit
        )
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Failed to search knowledge graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/kg/overview")
async def get_knowledge_overview():
    """Get overview of the knowledge graph"""
    if not kg_service:
        raise HTTPException(status_code=503, detail="Knowledge Graph service not available")
    
    try:
        overview = await kg_service.get_knowledge_overview()
        return overview
        
    except Exception as e:
        logger.error(f"Failed to get knowledge overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/kg/import")
async def import_knowledge_data(import_data: ImportData):
    """Import notes and categories to rebuild knowledge graph"""
    if not kg_service:
        raise HTTPException(status_code=503, detail="Knowledge Graph service not available")
    
    try:
        import time
        imported_notes = 0
        imported_categories = 0
        errors = []
        
        # Import categories first
        if import_data.categories:
            existing_categories = read_categories()
            existing_names = [cat["category"].lower() for cat in existing_categories]
            
            for category in import_data.categories:
                if category.get("category", "").lower() not in existing_names:
                    existing_categories.append(category)
                    existing_names.append(category.get("category", "").lower())
                    imported_categories += 1
            
            write_categories(existing_categories)
        
        # Import notes and build knowledge graph
        if import_data.notes:
            for note_data in import_data.notes:
                try:
                    # Ensure required fields
                    if not note_data.get("content"):
                        continue
                    
                    # Normalize note data structure
                    normalized_note = {
                        "content": note_data.get("content", ""),
                        "timestamp": note_data.get("timestamp") or int(time.time()),
                        "categories": note_data.get("categories", []),
                        "metadata": note_data.get("metadata", {})
                    }
                    
                    # Add to knowledge graph
                    await kg_service.add_note_entity(normalized_note)
                    imported_notes += 1
                    
                except Exception as e:
                    errors.append(f"Failed to import note: {str(e)}")
                    logger.error(f"Failed to import note: {e}")
        
        return {
            "message": "Import completed",
            "imported_notes": imported_notes,
            "imported_categories": imported_categories,
            "errors": errors,
            "total_notes": len(import_data.notes) if import_data.notes else 0
        }
        
    except Exception as e:
        logger.error(f"Failed to import knowledge data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/kg/export")
async def export_knowledge_graph():
    """Export complete knowledge graph data"""
    if not kg_service:
        raise HTTPException(status_code=503, detail="Knowledge Graph service not available")
    
    try:
        # Get all entities
        entities_ref = kg_service.db.collection("kg_entities")
        entities = entities_ref.stream()
        
        # Get all relationships
        relationships_ref = kg_service.db.collection("kg_relationships")
        relationships = relationships_ref.stream()
        
        # Organize data by type
        export_data = {
            "metadata": {
                "export_date": datetime.now().isoformat(),
                "version": "2.0.0",
                "source": "Knowledge Graph API"
            },
            "entities": {},
            "relationships": []
        }
        
        # Group entities by type
        for entity in entities:
            entity_data = entity.to_dict()
            entity_type = entity_data.get("type", "unknown")
            
            if entity_type not in export_data["entities"]:
                export_data["entities"][entity_type] = []
            
            export_data["entities"][entity_type].append({
                "id": entity.id,
                **entity_data
            })
        
        # Collect relationships
        for relationship in relationships:
            rel_data = relationship.to_dict()
            export_data["relationships"].append({
                "id": relationship.id,
                **rel_data
            })
        
        return export_data
        
    except Exception as e:
        logger.error(f"Failed to export knowledge graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import time
    uvicorn.run(app, host="0.0.0.0", port=8000)
