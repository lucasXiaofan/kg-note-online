# 🔧 Chrome Extension Setup Guide

## 📋 Prerequisites

1. **Backend API running** on `http://localhost:8000`
2. **Google OAuth configured** (see `GOOGLE_OAUTH_SETUP.md`)
3. **Chrome browser** with Developer mode enabled

## 🚀 Installation Steps

### Step 1: Prepare Extension Assets

The extension needs icon files. You can:

**Option A: Use placeholder icons (for testing)**
```bash
# Create simple placeholder icons
cd extension/assets
# Copy any 16x16, 32x32, 48x48, 128x128 PNG files as:
# icon-16.png, icon-32.png, icon-48.png, icon-128.png
```

**Option B: Generate from SVG**
- Use an online SVG to PNG converter
- Convert `extension/assets/icon.svg` to multiple sizes
- Save as `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`

### Step 2: Load Extension in Chrome

1. **Open Chrome Extensions page**
   - Go to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer mode**
   - Toggle "Developer mode" in top-right corner

3. **Load unpacked extension**
   - Click "Load unpacked"
   - Select the `extension/` folder
   - Extension should appear in the list

### Step 3: Configure Extension Permissions

1. **Pin the extension** (optional)
   - Click puzzle piece icon in toolbar
   - Pin "Knowledge Graph Notes"

2. **Test permissions**
   - Extension should request:
     - Identity (for Google auth)
     - Storage (for local data)
     - Active tab (for context capture)
     - Side panel (for note interface)

## 🎯 Features & Usage

### 🔐 Authentication
- **Chrome Identity API** - Seamless Google sign-in
- **JWT tokens** - Secure session management
- **Automatic sync** - Works across devices

### ⌨️ Keyboard Shortcuts
- **`Ctrl+Shift+N`** (or `Cmd+Shift+N` on Mac) - Quick note capture
- **`Ctrl+Shift+K`** (or `Cmd+Shift+K` on Mac) - Open side panel

### 📝 Note Taking Methods

#### Method 1: Side Panel
1. Click extension icon or use `Ctrl+Shift+K`
2. Side panel opens on the right
3. Sign in with Google
4. Type note and save

#### Method 2: Quick Capture Hotkey
1. Select text on any webpage
2. Press `Ctrl+Shift+N`
3. Side panel opens with selected text
4. Add context and save

#### Method 3: Context Menu
1. Right-click on selected text
2. Choose "Save selection as note"
3. Note saved with page context

#### Method 4: Quick Actions
- **Capture Page** - Save current page title and URL
- **Open Web App** - Open full web application

## 🔧 Testing Checklist

### ✅ Authentication Flow
- [ ] Side panel opens successfully
- [ ] "Sign in with Google" button appears
- [ ] Google sign-in popup works
- [ ] User info displays after sign-in
- [ ] Sign out works correctly

### ✅ Note Creation
- [ ] Can type in note textarea
- [ ] Save button enables when typing
- [ ] Notes save successfully
- [ ] Success message appears
- [ ] Notes appear in recent list

### ✅ Context Capture
- [ ] Page context shows (domain, title)
- [ ] Selected text appears in note content
- [ ] URL metadata is captured correctly

### ✅ Keyboard Shortcuts
- [ ] `Ctrl+Shift+N` opens side panel
- [ ] `Ctrl+Shift+K` opens side panel
- [ ] Selected text is captured with hotkey
- [ ] `Ctrl+Enter` saves note
- [ ] `Escape` clears note form

### ✅ Context Menu
- [ ] Right-click menu shows "Save selection as note"
- [ ] Context menu saves notes correctly
- [ ] Page context is captured

### ✅ Notes Management
- [ ] Notes list loads after sign-in
- [ ] Search functionality works
- [ ] Click note to edit
- [ ] Refresh button updates list

## 🐛 Troubleshooting

### Issue: Extension won't load
**Solution:**
1. Check manifest.json syntax
2. Ensure all files exist
3. Create placeholder icon files if missing
4. Check Chrome console for errors

### Issue: Authentication fails
**Solution:**
1. Verify Google Client ID in manifest.json
2. Check if backend is running on port 8000
3. Ensure CORS is configured correctly
4. Check browser console for auth errors

### Issue: Notes won't save
**Solution:**
1. Check network tab for API call failures
2. Verify backend authentication endpoint
3. Ensure user is signed in
4. Check background script console logs

### Issue: Hotkeys don't work
**Solution:**
1. Check if hotkeys conflict with other extensions
2. Try different key combinations
3. Reload extension after changes
4. Check commands in chrome://extensions/shortcuts

### Issue: Side panel won't open
**Solution:**
1. Ensure Chrome version supports side panel API
2. Check extension permissions
3. Try clicking extension icon instead
4. Reload extension

## 📝 Development Tips

### Debugging
```javascript
// Check background script
chrome://extensions/ → Extension Details → Inspect views: background page

// Check side panel
Right-click side panel → Inspect

// Check content script
F12 → Console (on any webpage)
```

### Reload After Changes
```bash
# After editing extension files:
1. Go to chrome://extensions/
2. Click reload icon for your extension
3. Test changes
```

### Production Deployment
```bash
# For production:
1. Update manifest.json host_permissions
2. Change API base URL from localhost
3. Set up proper domain authentication
4. Package extension for Chrome Web Store
```

## 🎉 Success Criteria

The extension is working correctly if:

- ✅ Loads without errors
- ✅ Google authentication works
- ✅ Notes can be created and saved
- ✅ Keyboard shortcuts function
- ✅ Context menu integration works
- ✅ Side panel displays correctly
- ✅ Notes sync with web application
- ✅ Search and filtering work

## 🔗 Related Files

- **Manifest**: `extension/manifest.json`
- **Background**: `extension/background/background.js`
- **Side Panel**: `extension/sidepanel/sidepanel.html`
- **Content Script**: `extension/content/content.js`
- **Web App**: `frontend/auth.html`

## 📱 Next Steps

1. **Test all functionality** with this guide
2. **Create proper icons** for professional look
3. **Deploy backend** to production server
4. **Submit to Chrome Web Store** when ready
5. **Add advanced features** (tags, folders, etc.)