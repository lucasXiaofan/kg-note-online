// Knowledge Graph Notes - Side Panel JavaScript (Quick Note-taking Interface)
class SidePanelApp {
    constructor() {
        this.isAuthenticated = false;
        this.currentContext = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkAuthStatus();
        this.loadPageInfo();
        this.setupMessageListener();
        this.initializeQuickNote();
    }

    initializeElements() {
        // Header elements
        this.authPrompt = document.getElementById('authPrompt');
        this.openPopupBtn = document.getElementById('openPopupBtn');
        
        // Note form elements
        this.noteContent = document.getElementById('noteContent');
        this.noteContext = document.getElementById('noteContext');
        this.contextDomain = document.getElementById('contextDomain');
        this.contextTitle = document.getElementById('contextTitle');
        this.saveBtn = document.getElementById('saveBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.saveStatus = document.getElementById('saveStatus');
        
        // Page info elements
        this.pageInfo = document.getElementById('pageInfo');
        this.pageDomain = document.getElementById('pageDomain');
        this.pageTitle = document.getElementById('pageTitle');
        
        // Action buttons
        this.captureSelectionBtn = document.getElementById('captureSelectionBtn');
        this.openMainBtn = document.getElementById('openMainBtn');
    }

    attachEventListeners() {
        // Header buttons
        this.openPopupBtn.addEventListener('click', () => this.openMainPopup());
        
        // Note form
        this.noteContent.addEventListener('input', () => this.updateSaveButton());
        this.saveBtn.addEventListener('click', () => this.handleSaveNote());
        this.clearBtn.addEventListener('click', () => this.handleClearNote());
        
        // Action buttons
        this.captureSelectionBtn.addEventListener('click', () => this.handleCaptureSelection());
        this.openMainBtn.addEventListener('click', () => this.openMainPopup());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    async initializeQuickNote() {
        try {
            // Get the pending note context from session storage
            const stored = await chrome.storage.session.get(['pendingNoteContext', 'windowOpenedAt']);
            
            if (stored.pendingNoteContext && stored.windowOpenedAt) {
                // Check if this context is recent (within 5 seconds)
                const timeDiff = Date.now() - stored.windowOpenedAt;
                if (timeDiff < 5000) {
                    await this.prefillNoteContent(stored.pendingNoteContext);
                    
                    // Clear the pending context
                    await chrome.storage.session.remove(['pendingNoteContext', 'windowOpenedAt']);
                }
            }
            
            // Auto-focus the textarea
            setTimeout(() => {
                this.noteContent.focus();
                // Position cursor at the end if there's content
                const len = this.noteContent.value.length;
                this.noteContent.setSelectionRange(len, len);
            }, 100);
            
        } catch (error) {
            console.error('Error initializing quick note:', error);
            // Still focus even if prefill fails
            setTimeout(() => this.noteContent.focus(), 100);
        }
    }

    async prefillNoteContent(context) {
        try {
            // Create note content with title, URL, and a space for user notes
            const noteContent = `${context.title}

${context.url}

Notes:
`;
            
            this.noteContent.value = noteContent;
            this.currentContext = context;
            this.showNoteContext(context);
            this.updateSaveButton();
            
            console.log('Pre-filled note with context:', context);
        } catch (error) {
            console.error('Error pre-filling note content:', error);
        }
    }

    setupMessageListener() {
        // Listen for messages from background script and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'QUICK_NOTE':
                    this.handleQuickNoteMessage(message.data);
                    break;
                case 'AUTH_STATUS_CHANGED':
                    this.checkAuthStatus();
                    break;
                case 'LOAD_NOTE_FOR_EDIT':
                    this.handleLoadNoteForEdit(message.data);
                    break;
            }
        });
    }

    async checkAuthStatus() {
        try {
            const response = await this.sendMessage({ type: 'GET_AUTH_STATUS' });
            
            if (response.isAuthenticated && response.user) {
                this.isAuthenticated = true;
                this.showAuthenticatedUI();
            } else {
                this.isAuthenticated = false;
                this.showUnauthenticatedUI();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.showUnauthenticatedUI();
        }
    }

    openMainPopup() {
        // Close side panel and open main popup
        window.close();
    }

    showAuthenticatedUI() {
        this.authPrompt.style.display = 'none';
        this.updateSaveButton();
    }

    showUnauthenticatedUI() {
        this.authPrompt.style.display = 'block';
        this.saveBtn.disabled = true;
    }

    updateSaveButton() {
        const hasContent = this.noteContent.value.trim().length > 0;
        this.saveBtn.disabled = !hasContent || !this.isAuthenticated;
    }

    async handleSaveNote() {
        try {
            const content = this.noteContent.value.trim();
            if (!content) {
                this.showStatus('Please enter note content', 'error');
                return false;
            }

            this.showStatus('Saving note...', 'loading');
            this.saveBtn.disabled = true;

            // Get current tab context if not already set
            let context = this.currentContext;
            if (!context) {
                context = await this.getCurrentTabContext();
            }

            try {
                // Try background script first
                const response = await this.sendMessage({
                    type: 'SAVE_NOTE',
                    data: {
                        content: content,
                        context: context
                    }
                });

                if (response && response.success) {
                    this.showStatus('Note saved successfully!', 'success');
                    return true;
                } else {
                    throw new Error(response?.error || 'Background script failed');
                }
            } catch (bgError) {
                console.warn('Background save failed, trying direct API:', bgError.message);
                
                // Fallback: Direct API call
                return await this.saveNoteDirect(content, context);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            this.showStatus('Error saving note. Please try again.', 'error');
            return false;
        } finally {
            this.updateSaveButton();
        }
    }

    async saveNoteDirect(content, context) {
        try {
            // Get stored auth token
            const stored = await chrome.storage.local.get(['accessToken']);
            if (!stored.accessToken) {
                throw new Error('No auth token available');
            }
            
            // Prepare note data
            const noteData = {
                content: content,
                url: context.url,
                metadata: {
                    title: context.title,
                    url: context.url,
                    domain: context.domain
                }
            };
            
            // Try different ports
            const ports = [8000, 8080];
            let response;
            
            for (const port of ports) {
                try {
                    const url = `http://localhost:${port}/notes`;
                    console.log('Sidepanel: Trying direct API save to:', url);
                    
                    response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${stored.accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(noteData)
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
            console.log('Sidepanel: Direct API save response:', result);
            
            this.showStatus('Note saved successfully!', 'success');
            return true;
            
        } catch (error) {
            console.error('Direct API save failed:', error);
            this.showStatus(`Error saving note: ${error.message}`, 'error');
            return false;
        }
    }

    async getCurrentTabContext() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return {
                url: tab.url,
                title: tab.title,
                domain: new URL(tab.url).hostname
            };
        } catch (error) {
            console.error('Error getting tab context:', error);
            return {
                url: '',
                title: '',
                domain: ''
            };
        }
    }

    handleClearNote() {
        this.clearNoteForm();
    }

    clearNoteForm() {
        this.noteContent.value = '';
        this.noteContext.style.display = 'none';
        this.currentContext = null;
        this.updateSaveButton();
        this.hideStatus();
    }

    async loadPageInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && !tab.url.startsWith('chrome://')) {
                const domain = new URL(tab.url).hostname;
                this.pageDomain.textContent = domain;
                this.pageTitle.textContent = tab.title || 'Untitled';
                
                // Store current context
                this.currentContext = {
                    url: tab.url,
                    title: tab.title,
                    domain: domain
                };
            } else {
                this.pageDomain.textContent = 'Extension page';
                this.pageTitle.textContent = 'Not available';
                this.currentContext = null;
            }
        } catch (error) {
            console.error('Error loading page info:', error);
            this.pageDomain.textContent = 'Unknown';
            this.pageTitle.textContent = 'Error loading page info';
        }
    }

    handleLoadNoteForEdit(data) {
        // Handle message from popup to load a specific note for editing
        if (data.noteId) {
            // Focus the textarea and show a message
            this.noteContent.focus();
            this.showStatus('Loading note for editing...', 'loading');
            // In a real implementation, you'd fetch the note by ID
        }
    }

    async handleCaptureSelection() {
        try {
            // Get selected text from the current page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab && !tab.url.startsWith('chrome://')) {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => window.getSelection().toString()
                });
                
                const selectedText = results[0]?.result;
                if (selectedText && selectedText.trim()) {
                    // Add selected text to the note
                    const currentContent = this.noteContent.value;
                    const newContent = currentContent ? 
                        `${currentContent}\n\n"${selectedText.trim()}"` : 
                        `"${selectedText.trim()}"`;
                    
                    this.noteContent.value = newContent;
                    this.showNoteContext(this.currentContext);
                    this.updateSaveButton();
                    this.noteContent.focus();
                    
                    this.showStatus('Selection captured!', 'success');
                } else {
                    this.showStatus('No text selected on the page', 'error');
                }
            } else {
                this.showStatus('Cannot capture from this page', 'error');
            }
        } catch (error) {
            console.error('Error capturing selection:', error);
            this.showStatus('Error capturing selection', 'error');
        }
    }

    handleQuickNoteMessage(data) {
        // Handle quick note capture from hotkey
        if (data.content) {
            this.noteContent.value = data.content;
        }
        
        if (data.context) {
            this.currentContext = data.context;
            this.showNoteContext(data.context);
        }
        
        this.updateSaveButton();
        this.noteContent.focus();
    }

    showNoteContext(context) {
        if (context && context.url) {
            this.contextDomain.textContent = context.domain || new URL(context.url).hostname;
            this.contextTitle.textContent = context.title || context.url;
            this.noteContext.style.display = 'block';
        } else {
            this.noteContext.style.display = 'none';
        }
    }

    handleKeyDown(e) {
        // Enter key to save and close (like the reference behavior)
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            // Only if textarea is focused and not disabled
            if (document.activeElement === this.noteContent && !this.saveBtn.disabled) {
                e.preventDefault();
                this.handleSaveAndClose();
                return;
            }
        }
        
        // Shift + Enter for new line in textarea
        if (e.key === 'Enter' && e.shiftKey) {
            // Allow normal behavior for new line
            return;
        }
        
        // Ctrl/Cmd + Enter to save without closing
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (!this.saveBtn.disabled) {
                this.handleSaveNote();
            }
        }
        
        // Escape to close window
        if (e.key === 'Escape') {
            window.close();
        }
    }

    async handleSaveAndClose() {
        try {
            const success = await this.handleSaveNote();
            if (success) {
                // Close the window after successful save
                setTimeout(() => {
                    window.close();
                }, 500); // Small delay to show success message
            }
        } catch (error) {
            console.error('Error saving and closing:', error);
        }
    }

    // Utility methods
    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    showStatus(message, type) {
        this.saveStatus.textContent = message;
        this.saveStatus.className = `status-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => this.hideStatus(), 3000);
        }
    }

    hideStatus() {
        this.saveStatus.textContent = '';
        this.saveStatus.className = 'status-message';
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
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the side panel app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sidePanelApp = new SidePanelApp();
});