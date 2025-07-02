import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from firebase_admin import firestore

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self, db_client):
        self.db = db_client
    
    async def create_note(self, user_id: str, note_data: dict) -> str:
        """Create a new note for a user"""
        try:
            notes_collection = self.db.collection('users').document(user_id).collection('notes')
            doc_ref = notes_collection.add(note_data)
            return doc_ref[1].id
        except Exception as e:
            logger.error(f"Error creating note: {e}")
            raise
    
    async def get_user_notes(self, user_id: str, limit: int = 50, offset: int = 0) -> List[dict]:
        """Get notes for a user with pagination"""
        try:
            notes_collection = self.db.collection('users').document(user_id).collection('notes')
            notes_query = notes_collection.order_by('createdAt', direction=firestore.Query.DESCENDING)
            
            if offset > 0:
                # For pagination, we'd need to implement proper cursor-based pagination
                # This is a simple offset implementation
                notes_query = notes_query.offset(offset)
            
            notes_query = notes_query.limit(limit)
            
            notes = []
            for doc in notes_query.stream():
                note_data = doc.to_dict()
                note_data['id'] = doc.id
                notes.append(note_data)
            
            return notes
        except Exception as e:
            logger.error(f"Error getting notes: {e}")
            raise
    
    async def get_note_by_id(self, user_id: str, note_id: str) -> Optional[dict]:
        """Get a specific note by ID"""
        try:
            note_ref = self.db.collection('users').document(user_id).collection('notes').document(note_id)
            doc = note_ref.get()
            
            if doc.exists:
                note_data = doc.to_dict()
                note_data['id'] = doc.id
                return note_data
            return None
        except Exception as e:
            logger.error(f"Error getting note by ID: {e}")
            raise
    
    async def update_note(self, user_id: str, note_id: str, update_data: dict) -> bool:
        """Update a note"""
        try:
            note_ref = self.db.collection('users').document(user_id).collection('notes').document(note_id)
            update_data['updatedAt'] = datetime.now()
            note_ref.update(update_data)
            return True
        except Exception as e:
            logger.error(f"Error updating note: {e}")
            raise
    
    async def delete_note(self, user_id: str, note_id: str) -> bool:
        """Delete a note"""
        try:
            note_ref = self.db.collection('users').document(user_id).collection('notes').document(note_id)
            note_ref.delete()
            return True
        except Exception as e:
            logger.error(f"Error deleting note: {e}")
            raise
    
    async def search_notes(self, user_id: str, query: str, limit: int = 20) -> List[dict]:
        """Search notes by content (basic implementation)"""
        try:
            # This is a simple implementation. For full-text search, you'd want to use
            # a service like Algolia, Elasticsearch, or Firebase's text search extensions
            notes_collection = self.db.collection('users').document(user_id).collection('notes')
            
            # Get all notes and filter in memory (not efficient for large datasets)
            all_notes = []
            for doc in notes_collection.stream():
                note_data = doc.to_dict()
                note_data['id'] = doc.id
                
                # Simple text search in content
                if query.lower() in note_data.get('content', '').lower():
                    all_notes.append(note_data)
                    
                if len(all_notes) >= limit:
                    break
            
            return all_notes
        except Exception as e:
            logger.error(f"Error searching notes: {e}")
            raise
    
    async def get_notes_by_category(self, user_id: str, category: str, limit: int = 50) -> List[dict]:
        """Get notes filtered by category"""
        try:
            notes_collection = self.db.collection('users').document(user_id).collection('notes')
            notes_query = notes_collection.where('categories', 'array_contains', category)\
                                        .order_by('createdAt', direction=firestore.Query.DESCENDING)\
                                        .limit(limit)
            
            notes = []
            for doc in notes_query.stream():
                note_data = doc.to_dict()
                note_data['id'] = doc.id
                notes.append(note_data)
            
            return notes
        except Exception as e:
            logger.error(f"Error getting notes by category: {e}")
            raise
    
    async def get_user_categories(self, user_id: str) -> List[dict]:
        """Get all categories for a user"""
        try:
            categories_collection = self.db.collection('users').document(user_id).collection('categories')
            
            categories = []
            for doc in categories_collection.stream():
                category_data = doc.to_dict()
                category_data['id'] = doc.id
                categories.append(category_data)
            
            return categories
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            raise
    
    async def create_category(self, user_id: str, category_data: dict) -> str:
        """Create a new category for a user"""
        try:
            categories_collection = self.db.collection('users').document(user_id).collection('categories')
            doc_ref = categories_collection.add(category_data)
            return doc_ref[1].id
        except Exception as e:
            logger.error(f"Error creating category: {e}")
            raise
    
    async def get_notes_statistics(self, user_id: str) -> dict:
        """Get statistics about user's notes"""
        try:
            notes_collection = self.db.collection('users').document(user_id).collection('notes')
            
            # Count total notes
            total_notes = 0
            category_counts = {}
            
            for doc in notes_collection.stream():
                note_data = doc.to_dict()
                total_notes += 1
                
                # Count categories
                categories = note_data.get('categories', [])
                for category in categories:
                    category_counts[category] = category_counts.get(category, 0) + 1
            
            return {
                'total_notes': total_notes,
                'category_distribution': category_counts,
                'most_used_categories': sorted(
                    category_counts.items(), 
                    key=lambda x: x[1], 
                    reverse=True
                )[:5]
            }
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            raise