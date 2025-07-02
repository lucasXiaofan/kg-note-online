// Background Service Worker for Knowledge Graph Notes Extension
class KnowledgeNotesBackground {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8000'; // Try 8000 first, fallback to 8080 if needed
        
        // Add debugging
        console.log('Background script initialized with API URL:', this.apiBaseUrl);
        console.log('Extension ID:', chrome.runtime.id);
        this.currentUser = null;
        this.accessToken = null;
        
        this.initialize();
    }

    initialize() {
        // Set up event listeners
        chrome.runtime.onInstalled.addListener(() => this.handleInstall());
        chrome.commands.onCommand.addListener((command) => this.handleCommand(command));
        chrome.action.onClicked.addListener(() => this.openSidePanel());
        chrome.contextMenus.onClicked.addListener((info, tab) => this.handleContextMenu(info, tab));
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => this.handleMessage(message, sender, sendResponse));
        
        // Check authentication on startup
        this.checkAuthStatus();
    }

    async handleInstall() {
        console.log('Knowledge Graph Notes extension installed');
        
        // Create context menu
        chrome.contextMenus.create({
            id: 'save-selection',
            title: 'Save selection as note',
            contexts: ['selection']
        });
        
        chrome.contextMenus.create({
            id: 'save-page',
            title: 'Save page as note',
            contexts: ['page']
        });

        // Try to authenticate if not already done
        await this.checkAuthStatus();
    }

    async handleCommand(command) {
        console.log('Command received:', command);
        switch (command) {
            case 'quick-note':
                console.log('Executing quick-note command');
                await this.captureQuickNote();
                break;
            case 'open-sidepanel':
                console.log('Executing open-sidepanel command');
                await this.openSidePanel();
                break;
            default:
                console.log('Unknown command:', command);
        }
    }

    async openSidePanel() {
        try {
            // Get current tab context first
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Get page context
            const context = {
                url: tab.url,
                title: tab.title,
                domain: new URL(tab.url).hostname
            };

            // Store context for the floating window to use
            await chrome.storage.session.set({ 
                pendingNoteContext: context,
                windowOpenedAt: Date.now()
            });

            // Create a floating window positioned on the right
            // Get display info to position window correctly
            const displays = await chrome.system.display.getInfo();
            const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
            const screenWidth = primaryDisplay.workArea.width;
            
            const window = await chrome.windows.create({
                url: chrome.runtime.getURL('sidepanel/sidepanel.html'),
                type: 'popup',
                width: 420,
                height: 500,
                left: screenWidth - 470, // Position on the right side
                top: 150,
                focused: true
            });
            
            console.log('Opened floating note window with context:', window.id, context);
        } catch (error) {
            console.error('Error opening floating window:', error);
        }
    }

    async handleContextMenu(info, tab) {
        try {
            let noteContent = '';
            let context = {
                url: tab.url,
                title: tab.title,
                domain: new URL(tab.url).hostname
            };

            switch (info.menuItemId) {
                case 'save-selection':
                    noteContent = info.selectionText;
                    break;
                case 'save-page':
                    noteContent = `Page: ${tab.title}\n\n${info.selectionText || 'Saved from: ' + tab.url}`;
                    break;
            }

            if (noteContent) {
                await this.saveNote(noteContent, context);
                this.showNotification('Note saved successfully!');
            }
        } catch (error) {
            console.error('Error handling context menu:', error);
            this.showNotification('Error saving note', 'error');
        }
    }

    async captureQuickNote() {
        try {
            // Get current tab info
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Get page context
            const context = {
                url: tab.url,
                title: tab.title,
                domain: new URL(tab.url).hostname
            };

            // Get selected text if any
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => window.getSelection().toString()
            });
            
            const selectedText = results[0]?.result || '';
            
            // Send message to side panel to open with context
            chrome.runtime.sendMessage({
                type: 'QUICK_NOTE',
                data: {
                    content: selectedText,
                    context: context
                }
            });

            // Open floating window
            await this.openSidePanel();
            
        } catch (error) {
            console.error('Error capturing quick note:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        console.log('Background: Received message:', message.type);
        
        // Use async wrapper to properly handle promises
        (async () => {
            try {
                let result;
                
                switch (message.type) {
                    case 'AUTHENTICATE':
                        console.log('Background: Handling AUTHENTICATE');
                        result = await this.authenticate();
                        break;
                        
                    case 'GET_AUTH_STATUS':
                        console.log('Background: Handling GET_AUTH_STATUS');
                        result = {
                            isAuthenticated: !!this.accessToken,
                            user: this.currentUser
                        };
                        break;
                        
                    case 'SAVE_NOTE':
                        console.log('Background: Handling SAVE_NOTE');
                        result = await this.saveNote(message.data.content, message.data.context);
                        break;
                        
                    case 'GET_NOTES':
                        console.log('Background: Handling GET_NOTES');
                        result = await this.getNotes();
                        break;
                        
                    case 'LOGOUT':
                        console.log('Background: Handling LOGOUT');
                        await this.logout();
                        result = { success: true };
                        break;
                        
                    case 'OPEN_FLOATING_WINDOW':
                        console.log('Background: Opening floating window');
                        await this.openSidePanel();
                        result = { success: true };
                        break;
                        
                    default:
                        console.log('Background: Unknown message type:', message.type);
                        result = { error: 'Unknown message type' };
                }
                
                console.log('Background: Sending response:', result);
                sendResponse(result);
                
            } catch (error) {
                console.error('Background: Error handling message:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true; // Keep message channel open for async response
    }

    async authenticate() {
        try {
            console.log('Starting authentication...');
            
            // Check if we should use development mode (OAuth client not configured)
            const devMode = false; // OAuth is now properly configured!
            
            if (devMode) {
                console.log('Using development authentication mode');
                return await this.authenticateDevelopmentMode();
            }
            
            console.log('Starting Chrome Identity authentication...');
            console.log('Expected Extension ID: gpkaepmdolpcppjmjcglmlllkjhjdfdk');
            console.log('Actual Extension ID:', chrome.runtime.id);
            
            if (chrome.runtime.id !== 'gpkaepmdolpcppjmjcglmlllkjhjdfdk') {
                console.warn('Extension ID mismatch! You may need to update the OAuth client in Google Cloud Console');
                console.warn('Current ID:', chrome.runtime.id);
                console.warn('Expected ID: gpkaepmdolpcppjmjcglmlllkjhjdfdk');
            }
            
            // Get OAuth token using Chrome Identity API with persistent login
            console.log('Requesting auth token from Chrome Identity API...');
            const accessToken = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ 
                    interactive: true,
                    // Don't force interactive if user already granted permission
                    // This allows silent re-authentication
                }, (token) => {
                    if (chrome.runtime.lastError) {
                        console.error('Chrome Identity error:', chrome.runtime.lastError);
                        console.error('Error details:', {
                            message: chrome.runtime.lastError.message,
                            stack: chrome.runtime.lastError.stack
                        });
                        reject(new Error(`Chrome Identity failed: ${chrome.runtime.lastError.message}`));
                    } else if (!token) {
                        console.error('Chrome Identity returned empty token');
                        reject(new Error('Chrome Identity returned empty token'));
                    } else {
                        console.log('Chrome Identity token received (length:', token.length, ')');
                        resolve(token);
                    }
                });
            });

            console.log('Got Chrome Identity access token');

            // Get user info from Google using the access token
            console.log('Fetching user info from Google API...');
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!userInfoResponse.ok) {
                const errorText = await userInfoResponse.text();
                console.error('Google API error:', userInfoResponse.status, errorText);
                throw new Error(`Failed to get user info: ${userInfoResponse.status} - ${errorText}`);
            }

            const userInfo = await userInfoResponse.json();
            console.log('Got user info from Google:', userInfo);

            // Try backend API first, but fall back to local storage if API is unavailable
            let authData;
            let useLocalAuth = false;
            
            try {
                console.log('Calling backend API for authentication...');
                
                const response = await this.tryApiCall('/auth/chrome-extension', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        access_token: accessToken,
                        user_info: userInfo
                    })
                });

                console.log('Backend response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Backend auth error:', response.status, errorText);
                    throw new Error(`Backend authentication failed: ${response.status} - ${errorText}`);
                }

                authData = await response.json();
                console.log('Backend authentication successful');
                
            } catch (backendError) {
                console.warn('Backend API unavailable, using local authentication:', backendError.message);
                useLocalAuth = true;
                
                // Create a local auth token for testing
                authData = {
                    access_token: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    user_id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    expires_in: 3600
                };
            }
            
            // Store authentication data
            this.accessToken = authData.access_token;
            this.currentUser = {
                user_id: authData.user_id,
                email: authData.email || userInfo.email,
                name: authData.name || userInfo.name,
                is_anonymous: false
            };

            // Store in chrome storage with persistent login flag
            await chrome.storage.local.set({
                accessToken: this.accessToken,
                user: this.currentUser,
                authTimestamp: Date.now(),
                persistentLogin: true // Flag to indicate user wants to stay logged in
            });

            console.log('Authentication successful:', this.currentUser);
            
            return {
                success: true,
                user: this.currentUser
            };
            
        } catch (error) {
            console.error('Authentication error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async authenticateDevelopmentMode() {
        try {
            // Create a simple development user
            const devUser = {
                id: 'dev_user_123',
                email: 'developer@example.com',
                name: 'Development User',
                picture: 'https://ui-avatars.com/api/?name=Dev+User&background=667eea&color=fff'
            };
            
            console.log('Created development user:', devUser);

            // Try backend API first, but fall back to local storage if API is unavailable
            let authData;
            
            try {
                console.log('Calling backend API for development authentication...');
                
                const response = await this.tryApiCall('/auth/chrome-extension', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        access_token: 'dev_token_' + Date.now(),
                        user_info: devUser
                    })
                });

                if (response.ok) {
                    authData = await response.json();
                    console.log('Backend authentication successful');
                } else {
                    throw new Error('Backend not available');
                }
                
            } catch (backendError) {
                console.warn('Backend API unavailable, using local authentication:', backendError.message);
                
                // Create a local auth token for testing
                authData = {
                    access_token: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    user_id: devUser.id,
                    email: devUser.email,
                    name: devUser.name,
                    expires_in: 3600
                };
            }
            
            // Store authentication data
            this.accessToken = authData.access_token;
            this.currentUser = {
                user_id: authData.user_id,
                email: authData.email,
                name: authData.name,
                is_anonymous: false
            };

            // Store in chrome storage with persistent login flag
            await chrome.storage.local.set({
                accessToken: this.accessToken,
                user: this.currentUser,
                authMode: 'development',
                authTimestamp: Date.now(),
                persistentLogin: true // Flag to indicate user wants to stay logged in
            });

            console.log('Development authentication successful:', this.currentUser);
            
            return {
                success: true,
                user: this.currentUser
            };
            
        } catch (error) {
            console.error('Development authentication error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async checkAuthStatus() {
        try {
            // Check stored authentication
            const stored = await chrome.storage.local.get(['accessToken', 'user', 'persistentLogin', 'authTimestamp']);
            
            if (stored.accessToken && stored.user && stored.persistentLogin) {
                console.log('Found stored authentication, attempting to restore...');
                
                // Check if auth is not too old (30 days max)
                const authAge = Date.now() - (stored.authTimestamp || 0);
                const maxAuthAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                
                if (authAge > maxAuthAge) {
                    console.log('Stored authentication is too old, clearing...');
                    await this.logout();
                    return;
                }
                
                // Try to verify token is still valid
                try {
                    const response = await this.tryApiCall('/auth/me', {
                        headers: {
                            'Authorization': `Bearer ${stored.accessToken}`
                        }
                    });
                    
                    if (response.ok) {
                        this.accessToken = stored.accessToken;
                        this.currentUser = stored.user;
                        console.log('Successfully restored authentication for:', this.currentUser.email);
                    } else {
                        console.log('Stored token is invalid, attempting silent refresh...');
                        // Try to get a fresh token silently
                        await this.attemptSilentAuth();
                    }
                } catch (error) {
                    console.log('Cannot verify token, API not available:', error.message);
                    // Assume token is still valid if API is unavailable
                    this.accessToken = stored.accessToken;
                    this.currentUser = stored.user;
                    console.log('Restored authentication (API unavailable) for:', this.currentUser.email);
                }
            } else {
                console.log('No stored authentication found');
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
        }
    }

    async attemptSilentAuth() {
        try {
            console.log('Attempting silent authentication...');
            
            // Try to get a fresh token without user interaction
            const accessToken = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ 
                    interactive: false // Silent authentication
                }, (token) => {
                    if (chrome.runtime.lastError) {
                        console.log('Silent auth failed:', chrome.runtime.lastError.message);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (!token) {
                        reject(new Error('No token returned'));
                    } else {
                        console.log('Silent auth successful');
                        resolve(token);
                    }
                });
            });

            // Get fresh user info
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json();
                
                // Update stored authentication
                this.accessToken = accessToken;
                this.currentUser = {
                    user_id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    is_anonymous: false
                };

                await chrome.storage.local.set({
                    accessToken: this.accessToken,
                    user: this.currentUser,
                    authTimestamp: Date.now(),
                    persistentLogin: true
                });

                console.log('Silent authentication successful for:', this.currentUser.email);
            } else {
                throw new Error('Failed to get user info');
            }
            
        } catch (error) {
            console.log('Silent authentication failed:', error.message);
            // Clear stored auth since it's no longer valid
            await this.logout();
        }
    }

    async saveNote(content, context) {
        try {
            if (!this.accessToken) {
                throw new Error('Not authenticated');
            }

            const noteData = {
                content: content,
                url: context.url,
                metadata: {
                    title: context.title,
                    url: context.url,
                    domain: context.domain,
                    selection: content !== context.title ? content : undefined
                }
            };

            const response = await this.tryApiCall('/notes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(noteData)
            });

            if (!response.ok) {
                throw new Error(`Failed to save note: ${response.status}`);
            }

            const result = await response.json();
            console.log('Note saved:', result);
            
            return { success: true, noteId: result.noteId };
            
        } catch (error) {
            console.error('Error saving note:', error);
            return { success: false, error: error.message };
        }
    }

    async getNotes() {
        try {
            console.log('getNotes: Starting to fetch notes...');
            
            if (!this.accessToken) {
                throw new Error('Not authenticated');
            }

            console.log('getNotes: Making API call...');
            const response = await this.tryApiCall('/notes', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            console.log('getNotes: API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('getNotes: API error:', response.status, errorText);
                throw new Error(`Failed to get notes: ${response.status} - ${errorText}`);
            }

            console.log('getNotes: Parsing JSON response...');
            const result = await response.json();
            console.log('getNotes: Raw API response:', result);
            
            // Handle different response structures
            let notes = [];
            if (result.notes) {
                notes = result.notes;
            } else if (Array.isArray(result)) {
                notes = result;
            } else if (result.data && Array.isArray(result.data)) {
                notes = result.data;
            }
            
            console.log('getNotes: Processed notes:', notes);
            return { success: true, notes: notes };
            
        } catch (error) {
            console.error('Error getting notes:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            console.log('Starting logout process...');
            
            // Clear Chrome Identity token
            if (this.accessToken) {
                chrome.identity.removeCachedAuthToken({ token: this.accessToken });
                
                // Also revoke the token to fully log out from Google
                try {
                    await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
                        method: 'POST'
                    });
                    console.log('Google token revoked successfully');
                } catch (revokeError) {
                    console.warn('Failed to revoke token:', revokeError.message);
                }
            }
            
            // Clear all authentication-related storage
            await chrome.storage.local.remove([
                'accessToken', 
                'user', 
                'persistentLogin', 
                'authTimestamp', 
                'authMode'
            ]);
            
            // Clear instance variables
            this.accessToken = null;
            this.currentUser = null;
            
            console.log('Logged out successfully - all authentication data cleared');
            
        } catch (error) {
            console.error('Error during logout:', error);
            // Ensure we clear local data even if remote logout fails
            await chrome.storage.local.clear();
            this.accessToken = null;
            this.currentUser = null;
        }
    }

    async tryApiCall(endpoint, options = {}) {
        const ports = [8000, 8080];
        let lastError;
        
        for (const port of ports) {
            try {
                const url = `http://localhost:${port}${endpoint}`;
                console.log('Trying API call to:', url);
                const response = await fetch(url, options);
                
                // If we get a response (even if not ok), use this port
                this.apiBaseUrl = `http://localhost:${port}`;
                console.log('API call successful on port:', port);
                return response;
                
            } catch (error) {
                console.log(`Port ${port} failed:`, error.message);
                lastError = error;
            }
        }
        
        throw new Error(`All API ports failed. Last error: ${lastError?.message}`);
    }

    showNotification(message, type = 'success') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: 'Knowledge Graph Notes',
            message: message
        });
    }
}

// Initialize the background service
new KnowledgeNotesBackground();