#!/usr/bin/env python3
"""
Local development server script
Usage: python scripts/run_local.py
"""
import os
import sys
import subprocess

def main():
    """Run the local development server"""
    # Set environment to local
    os.environ['ENVIRONMENT'] = 'local'
    
    # Change to project root directory
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(project_root)
    
    print("🚀 Starting local development server...")
    print("📍 Environment: LOCAL")
    print("🔗 API URL: http://localhost:8000")
    print("📋 API Documentation: http://localhost:8000/docs")
    print("🔄 Auto-reload: ENABLED")
    print("=" * 50)
    
    # Run uvicorn with local configuration
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "api_simple:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload",
            "--log-level", "info"
        ], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()