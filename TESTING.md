# 🧪 Testing Guide - Simplified Version

## Prerequisites

### 1. Set Up Environment
```bash
# Copy environment file
cp .env.example .env

# Edit .env file and add your DeepSeek API key
# DEEPSEEK_API_KEY=your_actual_api_key_here
```

### 2. Verify Firebase Service Account
Make sure the service account file exists:
- File: `config/kg-note-e7fdd-firebase-adminsdk-fbsvc-c0d3fce41b.json`
- This should already be in place from your test-firestore.py setup

### 3. Install Python Dependencies
```bash
pip install fastapi uvicorn python-dotenv openai firebase-admin
```

## 🚀 How to Test

### Step 1: Start the Backend API
```bash
# Navigate to project directory
cd /mnt/c/production_projects/kg-note-online

# Start the FastAPI server
python api.py
```

**Expected Output:**
```
INFO: Firebase Admin SDK initialized successfully
INFO: Uvicorn running on http://0.0.0.0:8000
INFO: Application startup complete.
```

### Step 2: Open Simplified Frontend

**Option A: Local HTTP Server (Recommended)**
```bash
# Using Python's built-in server
cd frontend
python -m http.server 8080

# Then open: http://localhost:8080/simple.html
```

**Option B: Direct File Opening**
```bash
# Open the simplified HTML file directly
start frontend/simple.html
# or on Mac: open frontend/simple.html
# or on Linux: xdg-open frontend/simple.html
```

**Option C: Using Live Server (VS Code)**
- Install "Live Server" extension in VS Code
- Right-click on `frontend/simple.html`
- Select "Open with Live Server"

## 🧪 Test Scenarios

### Test 1: Automatic Connection
1. **Open the simplified web app** (`simple.html`)
2. **Expected**: You should see "Creating session..." then "Connected as anonymous_XXXXXXXX"
3. **Expected**: Notes and categories sections should appear
4. **Expected**: "New Session" button should be visible

### Test 2: Create a Note
1. **Enter note content**: "This is my first test note"
2. **Add URL** (optional): "https://example.com"
3. **Add title** (optional): "Test Page"
4. **Click "Save Note"**
5. **Expected**: "Note saved successfully!" message
6. **Expected**: Note appears in "Your Notes" section with auto-generated categories

### Test 3: Real-time Updates
1. **Open the same app in another browser tab**
2. **Create a note in one tab**
3. **Expected**: Note should appear in both tabs immediately

### Test 4: Search and Filter
1. **Create multiple notes with different content**
2. **Use the search box** to find specific notes
3. **Use category filter** to filter by category
4. **Expected**: Notes should filter correctly

### Test 5: Edit and Delete
1. **Click "Edit" on any note**
2. **Modify the content**
3. **Click "Update Note"**
4. **Expected**: Note should update
5. **Click "Delete" on any note**
6. **Confirm deletion**
7. **Expected**: Note should disappear

## 🐛 Troubleshooting

### Issue: Connection Error
**Problem**: "Connection failed. Please refresh." message

**Solution**: 
1. Check that backend is running on port 8000
2. Verify the service account file is in correct location
3. Check browser console for detailed error messages

### Issue: API Call Fails
**Problem**: Notes don't get categorized or save fails

**Solution**:
1. Check that backend is running on port 8000
2. Check browser console for CORS errors
3. Verify your DeepSeek API key in `.env` file

### Issue: Firestore Permission Denied
**Problem**: "Permission denied" when saving notes

**Solution**:
1. Go to Firebase Console → Firestore Database → Rules
2. Set test rules (⚠️ NOT for production):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Allow all operations for testing
    }
  }
}
```

### Issue: CORS Errors
**Problem**: "Access to fetch blocked by CORS policy"

**Solution**:
1. Make sure backend is running
2. Try using local HTTP server instead of opening HTML directly
3. Check that CORS origins are configured correctly in `api.py`

## 📊 Expected Database Structure

After creating notes, check your Firestore database:

```
Firestore Database: kg-note
├── users/
│   └── {anonymousUserId}/
│       ├── notes/
│       │   └── {noteId}: {
│       │       content: "Your note content",
│       │       categories: ["Category1", "Category2"],
│       │       metadata: { url, title, domain },
│       │       createdAt: timestamp,
│       │       updatedAt: timestamp
│       │     }
│       └── categories/
│           └── {categoryId}: {
│               name: "Category Name",
│               definition: "Category description",
│               createdAt: timestamp
│             }
```

## ✅ Success Criteria

The system is working correctly if:

- ✅ Automatic anonymous session creation works
- ✅ Notes can be created and appear in the list
- ✅ Notes get auto-categorized by the AI
- ✅ Search and filtering work
- ✅ Edit and delete operations work
- ✅ Data persists in Firestore database
- ✅ Health check shows Firebase as "connected"

## 🔗 URLs to Test

- **Simplified Frontend**: `http://localhost:8080/simple.html` (if using local server)
- **Backend API**: `http://localhost:8000` 
- **Health Check**: `http://localhost:8000/health` (should show `"firebase": "connected"`)
- **API Docs**: `http://localhost:8000/docs` (FastAPI automatic docs)