from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import os
from dotenv import load_dotenv
from typing import List, Optional
import logging
from datetime import datetime
import sys

# Import modular services and routes - will be imported after dependencies are loaded

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
db = None
db_service = None

def initialize_firebase():
    global db, db_service
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Use your actual service account file
        cred = credentials.Certificate("config/kg-note-credential.json")
        firebase_app = firebase_admin.initialize_app(cred)
        db = firestore.client(database_id="kg-note")
        
        logger.info("Firebase Admin SDK initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        return False

# Try to initialize Firebase
firebase_initialized = initialize_firebase()

if firebase_initialized and db:
    try:
        # Initialize database service only if modular imports work
        db_service = None
        logger.info("Database connection established successfully")
    except Exception as e:
        logger.warning(f"Could not initialize database services: {e}")
else:
    logger.warning("Running without Firebase/Database support")

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

# Pydantic models for backward compatibility
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

# Legacy file-based category management (to be phased out)
CATEGORIES_FILE = "../../data/categories.json"

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

# Initialize variables for modular components
AuthService = None
UserInfo = None
verify_token = None
llm_service = None

# Import and include routers after app initialization
try:
    from api.auth.auth_routes import router as auth_router  
    from api.auth.auth_service import AuthService
    from api.auth.models import UserInfo
    from api.llm.llm_routes import router as llm_router
    from api.database.db_routes import router as db_router, set_db_service
    from api.database.db_service import DatabaseService
    from api.core.dependencies import set_database
    
    # Set the verify_token function
    verify_token = AuthService.verify_token
    
    # Initialize database service if Firebase is available
    if firebase_initialized and db:
        db_service = DatabaseService(db)
        set_db_service(db_service)
        set_database(db)
        logger.info("Database services initialized successfully")
    
    # Include routers
    app.include_router(auth_router)
    app.include_router(llm_router) 
    app.include_router(db_router)
    
    logger.info("Modular routes loaded successfully")
except ImportError as e:
    logger.warning(f"Could not load modular routes: {e}")
    logger.info("Running with basic functionality only")
    
    # Define basic fallback classes and functions
    from fastapi.security import HTTPBearer
    security = HTTPBearer()
    
    class UserInfo:
        def __init__(self, user_id: str, email: str, name: str, is_anonymous: bool = False):
            self.user_id = user_id
            self.email = email  
            self.name = name
            self.is_anonymous = is_anonymous
    
    def verify_token(credentials=None):
        # Basic fallback implementation - for testing only
        return UserInfo("test_user", "test@example.com", "Test User")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    firebase_status = "connected" if db else "disconnected"
    return {
        "status": "healthy", 
        "message": "Knowledge Weaver API is running",
        "firebase": firebase_status
    }

# Notes Management (Enhanced)
@app.post("/notes")
async def create_note(note: Note, current_user: UserInfo = Depends(verify_token)):
    """Create a new note for a user"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get categorization from LLM service if available
        categories = ["General"]
        categorization_result = {"categories": categories}
        existing_categories = read_categories()  # Legacy support
        
        try:
            from api.llm.llm_service import LLMService
            current_llm_service = LLMService()
            
            context_data = {
                'url': note.metadata.url if note.metadata else note.url,
                'title': note.metadata.title if note.metadata else "",
                'domain': note.metadata.domain if note.metadata else ""
            }
            
            categorization_result = await current_llm_service.categorize_note(
                note.content, 
                context_data, 
                existing_categories
            )
            
            categories = categorization_result.get("categories", ["General"])
        except ImportError:
            logger.info("LLM service not available, using default categorization")
        
        # Process new categories if they exist
        if "new_categories" in categorization_result and categorization_result["new_categories"]:
            existing_names = [cat["category"].lower() for cat in existing_categories]
            for new_cat in categorization_result["new_categories"]:
                if new_cat["category"].lower() not in existing_names:
                    existing_categories.append(new_cat)
                    existing_names.append(new_cat["category"].lower())
            write_categories(existing_categories)
        
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
        
        # Save to database
        note_id = await db_service.create_note(current_user.user_id, note_data)
        
        return {
            "noteId": note_id,
            "categories": categories,
            "message": "Note created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notes")
async def get_user_notes(current_user: UserInfo = Depends(verify_token), limit: int = 50):
    """Get all notes for a user"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        notes = await db_service.get_user_notes(current_user.user_id, limit)
        return {"notes": notes}
    except Exception as e:
        logger.error(f"Error getting notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/notes/{note_id}")
async def update_note(note_id: str, note: Note, current_user: UserInfo = Depends(verify_token)):
    """Update a note"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        update_data = {
            'content': note.content,
            'metadata': {
                'title': note.metadata.title if note.metadata else "",
                'url': note.metadata.url if note.metadata else note.url,
                'domain': note.metadata.domain if note.metadata else "",
                'summary': note.metadata.summary if note.metadata else ""
            }
        }
        
        success = await db_service.update_note(current_user.user_id, note_id, update_data)
        if success:
            return {"message": "Note updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Note not found")
    except Exception as e:
        logger.error(f"Error updating note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: UserInfo = Depends(verify_token)):
    """Delete a note"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        success = await db_service.delete_note(current_user.user_id, note_id)
        if success:
            return {"message": "Note deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Note not found")
    except Exception as e:
        logger.error(f"Error deleting note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Legacy category endpoints (for backward compatibility)
@app.get("/categories")
async def get_categories():
    """Get all categories (legacy endpoint)"""
    return read_categories()

@app.post("/categories")
async def add_category(category: Category):
    """Add a new category (legacy endpoint)"""
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
    """Update a category by index (legacy endpoint)"""
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
    """Delete a category by index (legacy endpoint)"""
    categories = read_categories()
    
    if index < 0 or index >= len(categories):
        raise HTTPException(status_code=404, detail="Category not found")
    
    deleted_category = categories.pop(index)
    write_categories(categories)
    return {"message": "Category deleted successfully", "deleted_category": deleted_category}

# Legacy categorization endpoint (now uses LLM service)
@app.post("/categorize")
async def categorize_note(note: Note):
    """Categorize a note (legacy endpoint)"""
    try:
        # Try to use LLM service, fallback to simple categorization
        context_data = {
            'url': note.metadata.url if note.metadata else note.url,
            'title': note.metadata.title if note.metadata else "",
            'domain': note.metadata.domain if note.metadata else ""
        }
        
        existing_categories = read_categories()
        result = {"categories": ["General"]}
        
        try:
            from api.llm.llm_service import LLMService
            current_llm_service = LLMService()
            result = await current_llm_service.categorize_note(note.content, context_data, existing_categories)
            
            # Process new categories if they exist
            if "new_categories" in result and result["new_categories"]:
                existing_names = [cat["category"].lower() for cat in existing_categories]
                for new_cat in result["new_categories"]:
                    if new_cat["category"].lower() not in existing_names:
                        existing_categories.append(new_cat)
                        existing_names.append(new_cat["category"].lower())
                write_categories(existing_categories)
        except ImportError:
            logger.info("LLM service not available for categorization")
        
        return result
    except Exception as e:
        logger.error(f"Error in categorization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)