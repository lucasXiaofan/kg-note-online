from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from .llm_service import LLMService
from ..auth.auth_service import AuthService
from ..auth.models import UserInfo
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm", tags=["llm"])

class CategorizationRequest(BaseModel):
    content: str
    context: Optional[dict] = {}
    existing_categories: Optional[List[dict]] = []

class SummaryRequest(BaseModel):
    content: str
    max_length: Optional[int] = 150

class KeywordRequest(BaseModel):
    content: str
    max_keywords: Optional[int] = 10

class QuestionRequest(BaseModel):
    content: str
    num_questions: Optional[int] = 3

# Initialize LLM service
llm_service = LLMService()

@router.post("/categorize")
async def categorize_content(
    request: CategorizationRequest, 
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Categorize content using AI"""
    try:
        result = await llm_service.categorize_note(
            request.content,
            request.context or {},
            request.existing_categories or []
        )
        return result
    except Exception as e:
        logger.error(f"Error in categorization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/summarize")
async def summarize_content(
    request: SummaryRequest,
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Generate a summary of content"""
    try:
        summary = await llm_service.generate_summary(request.content, request.max_length)
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Error in summarization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/keywords")
async def extract_keywords(
    request: KeywordRequest,
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Extract keywords from content"""
    try:
        keywords = await llm_service.extract_keywords(request.content, request.max_keywords)
        return {"keywords": keywords}
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/questions")
async def generate_questions(
    request: QuestionRequest,
    current_user: UserInfo = Depends(AuthService.verify_token)
):
    """Generate study questions from content"""
    try:
        questions = await llm_service.generate_questions(request.content, request.num_questions)
        return {"questions": questions}
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))