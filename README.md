# 📚 KG Note Online - Knowledge Graph Note-Taking System

A powerful Chrome extension and API system for intelligent note-taking with AI-powered categorization and knowledge graph organization. Capture, categorize, and connect your knowledge seamlessly across the web.

## 🌟 Key Features

### 🧠 **AI-Powered Intelligence**
- **Smart Categorization**: Automatic note categorization using DeepSeek LLM
- **Context-Aware**: Analyzes webpage content, titles, and domains for better categorization
- **Dynamic Categories**: Creates new categories automatically when existing ones don't fit

### 📝 **Seamless Note Capture**
- **One-Click Capture**: Save notes instantly from any webpage
- **Text Selection**: Capture selected text with automatic context
- **YouTube Integration**: Timestamped notes for video content
- **Rich Metadata**: Automatic extraction of page titles, URLs, and domains

### 🔒 **User-Centric Design**
- **Personal Categories**: Each user has their own category system
- **Google OAuth**: Secure authentication with your Google account
- **Cloud Sync**: All notes and categories stored in Firestore database
- **Cross-Device**: Access your notes from anywhere

### 🔍 **Advanced Organization**
- **Multi-Category Notes**: Notes can belong to multiple categories
- **Smart Search**: Search through content, categories, titles, and domains
- **Date Filtering**: Filter notes by creation date (today, week, month)
- **Domain Grouping**: Organize notes by website source

### 🛠️ **Developer Features**
- **Environment Switching**: Easy toggle between local development and production
- **REST API**: Full RESTful API for notes and categories management
- **Real-time Sync**: Live updates between extension and database
- **Extensive Logging**: Detailed debug information for development

### 🎨 **Beautiful Interface**
- **Modern UI**: Clean, responsive design with gradient themes
- **Multiple Views**: Grid, list, and timeline view options
- **Visual Categories**: Color-coded category badges
- **Floating Panel**: Non-intrusive note-taking overlay

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Chrome         │    │  FastAPI         │    │  Firebase       │
│  Extension      │◄──►│  Backend         │◄──►│  Firestore      │
│                 │    │  (api_simple.py) │    │  Database       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌──────────────────┐            │
         └─────────────►│  DeepSeek LLM    │            │
                        │  (Categorization) │            │
                        └──────────────────┘            │
                                                        │
                    ┌─────────────────────────────────────┘
                    │
                    ▼
              User Collections:
              /users/{user_id}/notes/
              /users/{user_id}/categories/
```

---

## 🔧 Critical Fixes Applied

this fix seems critical:
● Update(background/background.js)
  ⎿ Updated background/background.js       
    with 3 additions and 7 removals        
      818    try {
      819        backgroundInstance =      
            new
    KnowledgeNotesBackgrou
            nd();
      820
            console.log('Background        
            service initialized
            successfully');
      821 +      console.log('Message      
          + listener registered in         
          + constructor');
      822
      823 -      // Test message 
          - listener immediately
      824 -      
    chrome.runtime.onMess
          - age.addListener((message,      
          - sender, sendResponse) =>       
    {
      825 -
          - console.log('Message 
          - listener test 
    triggered:',
          -  message.type || 
          - message.action);
      826 -          return 
          - 
    backgroundInstance.handleM
          - essage(message, sender,        
          - sendResponse);
      827 -      });
      828 -      
      823    } catch (error) {
      824
    console.error('Failed
             to initialize background      
            service:', error);
      825 +      console.error('Error      
          + details:', error.stack);       
      826
      827 -      // Fallback message       
    handler
          - handler
      827 +      // Fallback message       
    handler only if initialization         
    failed
          + handler only if 
          + initialization failed
      828
    chrome.runtime.onMess
            age.addListener((message,      
            sender, sendResponse) =>       
    {
      829
            console.error('Fallback        
            message handler - service      
            not initialized');
      830            sendResponse({        
            success: false, error:
            'Background service
            initialization failed'
    });

● Perfect! Now let me create a
  comprehensive summary of the fixes       
  applied:

  🔧 CRITICAL FIX: Duplicate Message       
  Listeners Removed

  Root Cause of "Message Port Closed"      
  Error:

  The background script was
  registering two message listeners:       
  1. One in the
  KnowledgeNotesBackground constructor     
   (line 21)
  2. Another at the bottom of the file     
   (line 823)

  This caused conflicts where:
  - Multiple handlers tried to respond     
   to the same message
  - The message port was closed by one     
   handler before the other could
  respond
  - Chrome extension messaging system      
  got confused about which handler
  should respond

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Chrome Browser
- Firebase Project with Firestore
- DeepSeek API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kg-note-online
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Start local development**
   ```bash
   python3 scripts/run_local.py
   ```

5. **Load Chrome extension**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` folder

### Usage

1. **Authenticate**: Click the extension icon and sign in with Google
2. **Capture Notes**: Use Ctrl+Shift+Y on any webpage or click the extension
3. **Manage Categories**: Visit the notes page to view and organize categories
4. **Search & Filter**: Use the powerful search and filtering options

## 📖 API Documentation

### Core Endpoints

**Authentication**
- `POST /auth/google` - Google OAuth login
- `POST /auth/chrome-extension` - Extension authentication
- `GET /auth/me` - Get current user

**Notes Management**
- `GET /notes` - Get user's notes
- `POST /notes` - Create new note (auto-categorized)
- `PUT /notes/{id}` - Update note
- `DELETE /notes/{id}` - Delete note

**Categories Management**
- `GET /categories` - Get user's categories
- `POST /categories` - Create category
- `PUT /categories/{id}` - Update category
- `DELETE /categories/{id}` - Delete category

**AI Services**
- `POST /categorize` - Categorize content with AI

## 🛠️ Development

### Local Development
```bash
# Switch to local mode
python3 scripts/run_local.py

# Test API endpoints
open file:///path/to/test_note_creation.html
```

### Environment Switching
```bash
# Visual environment switcher
open extension/dev-tools/environment-switcher.html

# Or programmatically
localStorage.setItem('kg-note-environment', 'local');
```

### Testing
```bash
# Test API health
curl http://localhost:8000/health

# Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/notes
```

## 📂 Project Structure

```
kg-note-online/
├── api_simple.py              # Main FastAPI application
├── config.py                  # Environment configuration
├── requirements.txt           # Python dependencies
├── extension/                 # Chrome extension files
│   ├── manifest.json         # Extension manifest
│   ├── background/           # Service worker
│   ├── content/              # Content scripts
│   ├── popup/                # Extension popup
│   ├── sidepanel/            # Floating note panel
│   ├── notes/                # Notes management UI
│   └── dev-tools/            # Development utilities
├── api/                      # Modular API services
│   ├── database/             # Database service
│   ├── llm/                  # LLM service
│   └── core/                 # Core utilities
└── scripts/                  # Development scripts
    ├── run_local.py          # Local development server
    └── run_production.py     # Production configuration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **DeepSeek**: AI-powered categorization
- **Firebase**: Cloud database and authentication
- **FastAPI**: High-performance Python web framework
- **Chrome Extensions**: Platform for seamless web integration