import os
from typing import Literal

class Config:
    """Configuration class for API endpoints and environment settings"""
    
    # Environment settings
    ENVIRONMENT: Literal["local", "production"] = os.getenv("ENVIRONMENT", "local")
    
    # API Base URLs
    LOCAL_API_URL = "http://localhost:8000"
    PRODUCTION_API_URL = "https://updateport-kg-note-185618387669.us-west2.run.app"
    
    # CORS settings for local development
    LOCAL_CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:5173",
        "file://",
        "null",
        "chrome-extension://*",  # Allow all Chrome extensions
        "moz-extension://*"      # Allow all Firefox extensions
    ]
    
    PRODUCTION_CORS_ORIGINS = [
        "https://updateport-kg-note-185618387669.us-west2.run.app",
        "https://your-frontend-domain.com",  # Add your actual frontend domain
        "file://",
        "null"
    ]
    
    @classmethod
    def get_api_url(cls) -> str:
        """Get the appropriate API URL based on environment"""
        if cls.ENVIRONMENT == "local":
            return cls.LOCAL_API_URL
        return cls.PRODUCTION_API_URL
    
    @classmethod
    def get_cors_origins(cls) -> list[str]:
        """Get CORS origins based on environment"""
        if cls.ENVIRONMENT == "local":
            return cls.LOCAL_CORS_ORIGINS
        return cls.PRODUCTION_CORS_ORIGINS
    
    @classmethod
    def is_local(cls) -> bool:
        """Check if running in local environment"""
        return cls.ENVIRONMENT == "local"
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production environment"""
        return cls.ENVIRONMENT == "production"

# Environment configuration
config = Config()