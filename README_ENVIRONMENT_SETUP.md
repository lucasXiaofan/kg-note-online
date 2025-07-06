# Environment Setup Guide

This guide explains how to set up and switch between local development and production environments for the KG Note API.

## 🚀 Quick Start

### 1. Local Development
```bash
# Set up local environment
cp .env.local .env.local.example  # Configure your local settings
python3 scripts/run_local.py      # Start local server
```

### 2. Production Testing
```bash
# Test with production configuration
python3 scripts/run_production.py  # Start with production config
```

### 3. Environment Switcher (Chrome Extension)
```bash
# Open the visual environment switcher
npm run open:switcher
# or manually open: extension/dev-tools/environment-switcher.html
```

## 📁 Configuration Files

### Environment Files
- `.env.local` - Local development settings
- `.env.production` - Production environment settings  
- `.env` - Fallback/default settings

### Key Configuration
```python
# config.py
ENVIRONMENT = "local"  # or "production"
LOCAL_API_URL = "http://localhost:8000"
PRODUCTION_API_URL = "https://updateport-kg-note-185618387669.us-west2.run.app"
```

## 🔧 Available Scripts

```bash
# Development
npm run dev                 # Start local development server
npm run dev:local          # Explicitly use local configuration
npm run dev:production     # Use production config locally

# Testing
npm run test:health        # Check local API health
npm run test:health:prod   # Check production API health

# Utilities
npm run open:switcher      # Open environment switcher tool
```

## 🌐 API Endpoints

### Local Development
- **Base URL:** `http://localhost:8000`
- **Docs:** `http://localhost:8000/docs`
- **Health:** `http://localhost:8000/health`

### Production
- **Base URL:** `https://updateport-kg-note-185618387669.us-west2.run.app`
- **Docs:** `https://updateport-kg-note-185618387669.us-west2.run.app/docs`
- **Health:** `https://updateport-kg-note-185618387669.us-west2.run.app/health`

## 🔌 Chrome Extension Configuration

### Automatic Environment Detection
The extension automatically detects and uses the configured environment:

```javascript
// In your extension code
const apiClient = new ApiClient();
console.log(apiClient.getConfig());
```

### Manual Environment Switching
```javascript
// Switch to local development
apiClient.switchEnvironment('local');

// Switch to production
apiClient.switchEnvironment('production');
```

### Using the Visual Switcher
1. Open `extension/dev-tools/environment-switcher.html`
2. Click "Switch to Local" or "Switch to Production"
3. Test the connection with "Check Health"
4. Your extension will automatically use the selected environment

## 🚨 Important Notes

### Local Development Requirements
- Python 3.8+ installed
- All dependencies installed: `pip install -r requirements.txt`
- Firebase credentials configured
- API keys set in `.env.local`

### Production Testing
- Production environment variables configured
- Network access to Google Cloud Run
- Valid authentication tokens

### CORS Configuration
- **Local:** Allows `localhost:3000`, `localhost:8080`, `localhost:5173`
- **Production:** Configured for your production domain

## 🔍 Troubleshooting

### Common Issues

1. **Local server not starting**
   ```bash
   # Check if port 8000 is available
   lsof -i :8000
   
   # Kill process if needed
   kill -9 <PID>
   ```

2. **Environment not switching**
   ```bash
   # Check current environment
   echo $ENVIRONMENT
   
   # Force environment
   export ENVIRONMENT=local
   python3 scripts/run_local.py
   ```

3. **Extension not connecting**
   - Check console for errors
   - Verify API URL in extension settings
   - Test API health using the switcher tool

4. **CORS errors**
   - Ensure your frontend URL is in CORS origins
   - Check if environment matches expected URLs

### Health Check Commands
```bash
# Test local API
curl -s http://localhost:8000/health

# Test production API  
curl -s https://updateport-kg-note-185618387669.us-west2.run.app/health

# Test both environments
npm run test:health && npm run test:health:prod
```

## 📊 Environment Switcher Features

The visual environment switcher provides:
- ✅ Real-time environment status
- 🔄 One-click environment switching  
- 🚀 Health check for both environments
- 📋 Configuration display
- 🔍 Connection testing

## 🔐 Security Notes

- Never commit `.env.local` or `.env.production` to version control
- Use different JWT secrets for local and production
- Rotate API keys regularly
- Test authentication in both environments

## 📝 Next Steps

1. Configure your `.env.local` file with your development settings
2. Test local API server: `python3 scripts/run_local.py`
3. Open the environment switcher and test both endpoints
4. Configure your Chrome extension for development
5. Deploy to production when ready

For more detailed information, check the individual configuration files and the API documentation.