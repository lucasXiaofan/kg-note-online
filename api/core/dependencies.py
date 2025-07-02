from fastapi import HTTPException

# Global database instance - will be set by main app
_db = None

def set_database(db):
    """Set the global database instance"""
    global _db
    _db = db

def get_db():
    """Dependency to get database instance"""
    if _db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return _db