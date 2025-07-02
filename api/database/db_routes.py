from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from .db_service import DatabaseService
from ..auth.auth_service import AuthService
from ..auth.models import UserInfo
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/db", tags=["database"])

class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 20

class CategoryFilterRequest(BaseModel):
    category: str
    limit: Optional[int] = 50

# Database service will be initialized when the main app starts
db_service = None

def set_db_service(service: DatabaseService):
    global db_service
    db_service = service

@router.get("/notes/search")
async def search_notes(
    query: str = Query(..., description="Search query"),
    limit: int = Query(20, description="Maximum number of results"),
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Search user's notes"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database service not available")
    
    try:
        notes = await db_service.search_notes(current_user.user_id, query, limit)
        return {"notes": notes}
    except Exception as e:
        logger.error(f"Error searching notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/by-category")
async def get_notes_by_category(
    category: str = Query(..., description="Category to filter by"),
    limit: int = Query(50, description="Maximum number of results"),
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Get notes filtered by category"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database service not available")
    
    try:
        notes = await db_service.get_notes_by_category(current_user.user_id, category, limit)
        return {"notes": notes}
    except Exception as e:
        logger.error(f"Error getting notes by category: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/{note_id}")
async def get_note_by_id(
    note_id: str,
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Get a specific note by ID"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database service not available")
    
    try:
        note = await db_service.get_note_by_id(current_user.user_id, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"note": note}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting note by ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/statistics")
async def get_user_statistics(
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Get statistics about user's notes"""
    if not db_service:
        raise HTTPException(status_code=503, detail="Database service not available")
    
    try:
        stats = await db_service.get_notes_statistics(current_user.user_id)
        return stats
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))