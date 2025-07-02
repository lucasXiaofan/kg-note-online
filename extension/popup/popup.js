// Extension Popup - Main interface for authentication and note management
class ExtensionPopup {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.notes = [];
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkAuthStatus();
    }

    initializeElements() {
        // Auth elements
        this.authSection = document.getElementById('authSection');
        this.mainContent = document.getElementById('mainContent');
        this.userInfo = document.getElementById('userInfo');
        this.userInitials = document.getElementById('userInitials');
        this.userName = document.getElementById('userName');
        this.userEmail = document.getElementById('userEmail');
        this.loginBtn = document.getElementById('loginBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.authStatus = document.getElementById('authStatus');
        
        // Action buttons
        this.openSidePanelBtn = document.getElementById('openSidePanelBtn');
        this.capturePageBtn = document.getElementById('capturePageBtn');
        this.openWebAppBtn = document.getElementById('openWebAppBtn');
        this.openSettingsBtn = document.getElementById('openSettingsBtn');
        this.refreshNotesBtn = document.getElementById('refreshNotesBtn');
        
        // Notes elements
        this.searchInput = document.getElementById('searchInput');
        this.recentNotesList = document.getElementById('recentNotesList');
    }

    attachEventListeners() {
        // Auth buttons
        this.loginBtn.addEventListener('click', () => this.handleLogin());
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        
        // Action buttons
        this.openSidePanelBtn.addEventListener('click', () => this.openSidePanel());
        this.capturePageBtn.addEventListener('click', () => this.capturePage());
        this.openWebAppBtn.addEventListener('click', () => this.openWebApp());
        this.openSettingsBtn.addEventListener('click', () => this.openSettings());
        this.refreshNotesBtn.addEventListener('click', () => this.loadRecentNotes());
        
        // Search
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    async checkAuthStatus() {
        try {
            const response = await this.sendMessage({ type: 'GET_AUTH_STATUS' });
            
            if (response.isAuthenticated && response.user) {
                this.currentUser = response.user;
                this.isAuthenticated = true;
                this.showAuthenticatedUI();
                this.loadRecentNotes();
            } else {
                this.isAuthenticated = false;
                this.showUnauthenticatedUI();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.showUnauthenticatedUI();
        }
    }

    async handleLogin() {
        try {
            this.showStatus('Signing in with Google...', 'loading');
            this.loginBtn.disabled = true;
            
            // Start authentication in background without waiting for direct response
            chrome.runtime.sendMessage({ type: 'AUTHENTICATE' }, (response) => {
                // Don't wait for this response due to timeout issues
                console.log('Auth message sent to background');
            });
            
            // Poll for authentication completion
            await this.pollForAuthCompletion();
            
        } catch (error) {
            console.error('Login error:', error);
            this.showStatus('Sign in failed. Please try again.', 'error');
        } finally {
            this.loginBtn.disabled = false;
        }
    }
    
    async pollForAuthCompletion() {
        const maxAttempts = 30; // 30 seconds total
        let attempts = 0;
        
        return new Promise((resolve, reject) => {
            const checkAuth = async () => {
                attempts++;
                
                try {
                    // Check Chrome storage for auth completion
                    const stored = await chrome.storage.local.get(['accessToken', 'user']);
                    
                    if (stored.accessToken && stored.user) {
                        // Authentication successful
                        this.currentUser = stored.user;
                        this.isAuthenticated = true;
                        this.showAuthenticatedUI();
                        this.showStatus('Signed in successfully!', 'success');
                        this.loadRecentNotes();
                        resolve();
                        return;
                    }
                    
                    if (attempts >= maxAttempts) {
                        throw new Error('Authentication timeout - please try again');
                    }
                    
                    // Update status to show progress
                    if (attempts % 3 === 0) {
                        const dots = '.'.repeat((attempts / 3) % 4);
                        this.showStatus(`Signing in with Google${dots}`, 'loading');
                    }
                    
                    // Check again in 1 second
                    setTimeout(checkAuth, 1000);
                    
                } catch (error) {
                    this.showStatus(`Sign in failed: ${error.message}`, 'error');
                    reject(error);
                }
            };
            
            // Start checking
            checkAuth();
        });
    }

    async handleLogout() {
        try {
            await this.sendMessage({ type: 'LOGOUT' });
            this.currentUser = null;
            this.isAuthenticated = false;
            this.notes = [];
            this.showUnauthenticatedUI();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    showAuthenticatedUI() {
        this.authSection.style.display = 'none';
        this.mainContent.style.display = 'block';
        this.userInfo.style.display = 'flex';
        
        if (this.currentUser) {
            this.userName.textContent = this.currentUser.name || 'User';
            this.userEmail.textContent = this.currentUser.email || '';
            
            // Set user initials
            const name = this.currentUser.name || this.currentUser.email || 'U';
            const initials = name.split(' ')
                .map(part => part.charAt(0).toUpperCase())
                .slice(0, 2)
                .join('');
            this.userInitials.textContent = initials;
        }
    }

    showUnauthenticatedUI() {
        this.authSection.style.display = 'flex';
        this.mainContent.style.display = 'none';
        this.userInfo.style.display = 'none';
    }

    async openSidePanel() {
        try {
            // Send message to background to open floating window
            await this.sendMessage({ type: 'OPEN_FLOATING_WINDOW' });
            
            // Close popup
            window.close();
        } catch (error) {
            console.error('Error opening floating window:', error);
        }
    }

    async capturePage() {
        try {
            // Get current tab context
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const context = {
                url: tab.url,
                title: tab.title,
                domain: new URL(tab.url).hostname
            };

            // Send to background to save
            const content = `Page: ${tab.title}\n\nSaved from: ${tab.url}`;
            
            const response = await this.sendMessage({
                type: 'SAVE_NOTE',
                data: {
                    content: content,
                    context: context
                }
            });

            if (response.success) {
                this.showStatus('Page saved successfully!', 'success');
                this.loadRecentNotes(); // Refresh notes list
            } else {
                this.showStatus(`Error saving page: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error capturing page:', error);
            this.showStatus('Error capturing page', 'error');
        }
    }

    openWebApp() {
        chrome.tabs.create({ url: 'http://localhost:8080/auth.html' });
        window.close();
    }

    openSettings() {
        // For now, just open the options page or web app settings
        chrome.tabs.create({ url: 'http://localhost:8080/auth.html#settings' });
        window.close();
    }

    async loadRecentNotes() {
        try {
            if (!this.isAuthenticated) return;

            this.recentNotesList.innerHTML = '<div class="loading">Loading notes...</div>';
            
            try {
                // First try to get notes through background script
                const response = await this.sendMessage({ type: 'GET_NOTES' });
                
                if (response && response.success) {
                    this.notes = response.notes || [];
                    this.displayRecentNotes(this.notes.slice(0, 5));
                    return;
                } else {
                    throw new Error(response?.error || 'Failed to load notes from background');
                }
            } catch (bgError) {
                console.warn('Background script failed, trying direct API call:', bgError.message);
                
                // Fallback: Direct API call from popup
                await this.loadNotesDirectly();
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            this.recentNotesList.innerHTML = '<div class="loading">Error loading notes - try refreshing</div>';
        }
    }
    
    async loadNotesDirectly() {
        try {
            // Get stored auth token
            const stored = await chrome.storage.local.get(['accessToken']);
            if (!stored.accessToken) {
                throw new Error('No auth token available');
            }
            
            // Try different ports
            const ports = [8000, 8080];
            let response;
            
            for (const port of ports) {
                try {
                    const url = `http://localhost:${port}/notes`;
                    console.log('Popup: Trying direct API call to:', url);
                    
                    response = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${stored.accessToken}`
                        }
                    });
                    
                    if (response.ok) {
                        break; // Success, exit loop
                    }
                } catch (portError) {
                    console.log(`Port ${port} failed:`, portError.message);
                }
            }
            
            if (!response || !response.ok) {
                throw new Error('All API ports failed');
            }
            
            const result = await response.json();
            console.log('Popup: Direct API response:', result);
            
            this.notes = result.notes || [];
            this.displayRecentNotes(this.notes.slice(0, 5));
            
        } catch (error) {
            console.error('Direct API call failed:', error);
            this.recentNotesList.innerHTML = '<div class="loading">Cannot connect to backend API</div>';
        }
    }

    displayRecentNotes(notes) {
        if (!notes || notes.length === 0) {
            this.recentNotesList.innerHTML = `
                <div class="empty-state">
                    <h4>No notes yet</h4>
                    <p>Start by creating your first note!</p>
                </div>
            `;
            return;
        }

        this.recentNotesList.innerHTML = notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-content">${this.escapeHtml(note.content)}</div>
                <div class="note-metadata">
                    <div class="note-categories">
                        ${(note.categories || []).slice(0, 2).map(cat => 
                            `<span class="category-tag">${this.escapeHtml(cat)}</span>`
                        ).join('')}
                        ${(note.categories || []).length > 2 ? '<span class="category-tag">+' + ((note.categories || []).length - 2) + '</span>' : ''}
                    </div>
                    <span class="note-date">${this.formatDate(note.createdAt)}</span>
                </div>
            </div>
        `).join('');

        // Add click listeners to note items
        this.recentNotesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.handleNoteClick(noteId);
            });
        });
    }

    handleNoteClick(noteId) {
        // Open side panel with this note for editing
        this.openSidePanel();
        
        // Send message to side panel to load this note
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'LOAD_NOTE_FOR_EDIT',
                data: { noteId: noteId }
            });
        }, 500);
    }

    handleSearch(searchTerm) {
        if (!searchTerm.trim()) {
            this.displayRecentNotes(this.notes.slice(0, 5));
            return;
        }

        const searchTermLower = searchTerm.toLowerCase();
        const filteredNotes = this.notes.filter(note => 
            note.content.toLowerCase().includes(searchTermLower) ||
            note.metadata?.title?.toLowerCase().includes(searchTermLower) ||
            (note.categories || []).some(cat => cat.toLowerCase().includes(searchTermLower))
        ).slice(0, 5);
        
        this.displayRecentNotes(filteredNotes);
    }

    handleKeyDown(e) {
        // Escape to close popup
        if (e.key === 'Escape') {
            window.close();
        }
        
        // Enter in search to open side panel
        if (e.key === 'Enter' && e.target === this.searchInput) {
            this.openSidePanel();
        }
    }

    // Utility methods
    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn('Message timeout for:', message.type);
                reject(new Error('Message timeout - background script may be busy'));
            }, 5000); // Reduced to 5 second timeout
            
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    clearTimeout(timeout);
                    
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError.message;
                        console.warn('Runtime error for', message.type, ':', error);
                        
                        // Don't reject for certain "expected" errors
                        if (error.includes('message port closed') || error.includes('receiving end does not exist')) {
                            console.log('Background script may be restarting, returning default response');
                            resolve({ success: false, error: 'Background script unavailable' });
                            return;
                        }
                        
                        reject(new Error(error));
                    } else if (!response) {
                        console.warn('Empty response from background script for:', message.type);
                        resolve({ success: false, error: 'Empty response' });
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                console.error('Error sending message:', error);
                reject(error);
            }
        });
    }

    showStatus(message, type) {
        this.authStatus.textContent = message;
        this.authStatus.className = `status-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                this.authStatus.style.opacity = '0';
            }, 2000);
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        
        let date;
        if (timestamp._seconds) {
            date = new Date(timestamp._seconds * 1000);
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            date = new Date(timestamp);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMinutes < 1) return 'Now';
        if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.extensionPopup = new ExtensionPopup();
});