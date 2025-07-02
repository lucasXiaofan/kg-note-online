# Extension Testing Steps - UPDATED

## CRITICAL FIX APPLIED: Message Port Handling

**Problem**: "The message port closed before a response was received" error
**Root Cause**: Async message handling with improper response timing
**Solution**: Simplified message handler to send responses immediately

## To test the save functionality fix:

1. **Reload the extension:**
   - Open Chrome and go to `chrome://extensions/`
   - Find "Knowledge Graph Notes" extension
   - Click the refresh/reload button 🔄

2. **Test the save functionality:**
   - Go to any website (e.g., YouTube, news site, etc.)
   - Press `Ctrl+Shift+Y` or click the extension icon
   - Type a test note in the overlay
   - Click "💾 Save" or press Enter

3. **Check the console logs:**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for these logs:
     - `Sending saveNote message with data:` (from content script)
     - `Background: Received message: saveNote` (from background script)
     - `Save response received:` (from content script)

4. **Expected behavior:**
   - Note should save successfully
   - UI should show "✅ Saved!" 
   - Overlay should close after 500ms
   - No "❌ Connection error" or "❌ Failed to save"

## Troubleshooting:

### If you see "❌ Connection error":
- The background script is not responding
- Check the extension is properly loaded
- Check browser console for background script errors
- Try reloading the extension

### If you see "❌ Failed to save":
- The background script responded but save failed
- Check network connectivity to localhost:8000 or localhost:8080
- Check API server is running

### If you see "✅ Saved!" but note doesn't appear in database:
- UI communication is fixed, but API server issue
- Check API server logs
- Verify authentication

## Debug Console Commands:

In the background script console (chrome://extensions/ -> inspect views -> service worker):
```javascript
// Check if background service is running
console.log('Background service status:', !!window.KnowledgeNotesBackground);

// Test message handling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Message intercepted:', msg);
});
```