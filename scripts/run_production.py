#!/usr/bin/env python3
"""
Production server script for testing production configuration locally
Usage: python scripts/run_production.py
"""
import os
import sys
import subprocess

def main():
    """Run the server with production configuration"""
    # Set environment to production
    os.environ['ENVIRONMENT'] = 'production'
    
    # Change to project root directory
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(project_root)
    
    print("🚀 Starting server with PRODUCTION configuration...")
    print("📍 Environment: PRODUCTION")
    print("🔗 Production API URL: https://updateport-kg-note-185618387669.us-west2.run.app")
    print("📋 API Documentation: http://localhost:8000/docs")
    print("🔄 Auto-reload: DISABLED")
    print("=" * 50)
    
    # Run uvicorn with production configuration
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "api_simple:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--log-level", "warning"
        ], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()