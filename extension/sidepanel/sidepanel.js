// Knowledge Graph Notes - Floating Panel JavaScript (Quick Note-taking Interface)
class FloatingPanelApp {
    constructor() {
        this.isAuthenticated = false;
        this.currentContext = null;
        this.pageContext = null;
        this.currentOpacity = 95;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeDragging();
        this.initializeOpacity();
        this.checkAuthStatus();
        this.loadPageInfo();
        this.setupMessageListener();
        this.initializeQuickNote();
    }

    initializeElements() {
        // Header elements
        this.authPrompt = document.getElementById('authPrompt');
        this.closeBtn = document.getElementById('closeBtn');
        this.opacityBtn = document.getElementById('opacity-btn');
        this.floatingPanel = document.getElementById('floating-panel');
        this.dragHandle = document.getElementById('drag-handle');
        
        // Context elements
        this.contextSection = document.getElementById('context-section');
        this.toggleContextBtn = document.getElementById('toggle-context');
        this.contextContent = document.getElementById('context-content');
        this.pageTitle = document.getElementById('page-title');
        this.pageUrl = document.getElementById('page-url');
        this.pageSummary = document.getElementById('page-summary');
        this.videoInfo = document.getElementById('video-info');
        this.videoTitle = document.getElementById('video-title');
        this.videoTime = document.getElementById('video-time');
        this.timestampedUrl = document.getElementById('timestamped-url');
        
        // JSON Context elements
        this.jsonContextSection = document.getElementById('json-context-section');
        this.toggleJsonBtn = document.getElementById('toggle-json');
        this.jsonContent = document.getElementById('json-content');
        
        // Note form elements
        this.noteContent = document.getElementById('noteContent');
        this.noteContext = document.getElementById('noteContext');
        this.contextDomain = document.getElementById('contextDomain');
        this.contextTitle = document.getElementById('contextTitle');
        this.saveBtn = document.getElementById('saveBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.saveStatus = document.getElementById('saveStatus');
        this.relatedNotes = document.getElementById('related-notes');
        
        // Action buttons
        this.captureSelectionBtn = document.getElementById('captureSelectionBtn');
        this.viewNotesBtn = document.getElementById('viewNotesBtn');
        this.manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
        
        // Status elements
        this.statusSection = document.getElementById('status-section');
        this.statusText = document.getElementById('status-text');
        this.progressBar = document.getElementById('progress-bar');
        this.progressFill = document.getElementById('progress-fill');
    }

    attachEventListeners() {
        // Header buttons
        this.closeBtn.addEventListener('click', () => this.handleClose());
        this.opacityBtn.addEventListener('click', () => this.cycleOpacity());
        
        // Context toggle
        this.toggleContextBtn.addEventListener('click', () => this.toggleContext());
        this.toggleJsonBtn.addEventListener('click', () => this.toggleJsonContext());
        
        // Note form
        this.noteContent.addEventListener('input', () => this.updateSaveButton());
        this.saveBtn.addEventListener('click', () => this.handleSaveNote());
        this.clearBtn.addEventListener('click', () => this.handleClearNote());
        
        // Action buttons
        this.captureSelectionBtn.addEventListener('click', () => this.handleCaptureSelection());
        this.viewNotesBtn.addEventListener('click', () => this.openNotesPage());
        this.manageCategoriesBtn.addEventListener('click', () => this.openCategoriesPage());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Make page URL clickable
        if (this.pageUrl) {
            this.pageUrl.addEventListener('click', () => this.openCurrentPage());
        }
    }

    initializeDragging() {
        this.dragHandle.addEventListener('mousedown', (e) => this.startDrag(e));
    }

    startDrag(e) {
        this.isDragging = true;
        const rect = this.floatingPanel.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        document.addEventListener('mousemove', this.handleDrag.bind(this));
        document.addEventListener('mouseup', this.stopDrag.bind(this));
        e.preventDefault();
    }

    handleDrag(e) {
        if (!this.isDragging) return;
        
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        
        // Constrain to window bounds
        const maxX = window.innerWidth - this.floatingPanel.offsetWidth;
        const maxY = window.innerHeight - this.floatingPanel.offsetHeight;
        
        this.floatingPanel.style.left = Math.max(0, Math.min(maxX, x)) + 'px';
        this.floatingPanel.style.top = Math.max(0, Math.min(maxY, y)) + 'px';
        this.floatingPanel.style.right = 'auto';
    }

    stopDrag() {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleDrag);
        document.removeEventListener('mouseup', this.stopDrag);
    }

    initializeOpacity() {
        // Load saved opacity
        const savedOpacity = localStorage.getItem('panelOpacity');
        if (savedOpacity) {
            this.updateOpacity(parseInt(savedOpacity));
        }
    }

    updateOpacity(opacity) {
        this.currentOpacity = opacity;
        document.documentElement.style.setProperty('--panel-opacity', opacity / 100);
        this.opacityBtn.textContent = `🔍 ${opacity}%`;
        localStorage.setItem('panelOpacity', opacity);
    }

    cycleOpacity() {
        const opacities = [95, 85, 75, 65, 55];
        const currentIndex = opacities.indexOf(this.currentOpacity);
        const nextIndex = (currentIndex + 1) % opacities.length;
        this.updateOpacity(opacities[nextIndex]);
    }

    toggleContext() {
        if (this.contextContent.style.display === 'none') {
            this.contextContent.style.display = 'block';
            this.toggleContextBtn.textContent = 'Hide';
        } else {
            this.contextContent.style.display = 'none';
            this.toggleContextBtn.textContent = 'Show';
        }
    }

    toggleJsonContext() {
        if (this.jsonContent.style.display === 'none') {
            this.jsonContent.style.display = 'block';
            this.toggleJsonBtn.textContent = 'Hide';
        } else {
            this.jsonContent.style.display = 'none';
            this.toggleJsonBtn.textContent = 'Show';
        }
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

    async loadPageInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && !tab.url.startsWith('chrome://')) {
                // Send message to content script to get page content
                const response = await this.sendMessage({ 
                    action: 'getPageContent',
                    tabId: tab.id 
                });
                
                if (response) {
                    this.setupPageContext(response);
                } else {
                    // Fallback to basic tab info
                    this.setupBasicPageContext(tab);
                }
            } else {
                this.pageTitle.textContent = 'Extension page';
                this.pageUrl.textContent = 'Not available';
                this.currentContext = null;
            }
        } catch (error) {
            console.error('Error loading page info:', error);
            this.pageTitle.textContent = 'Unknown';
            this.pageUrl.textContent = 'Error loading page info';
        }
    }

    setupBasicPageContext(tab) {
        const domain = new URL(tab.url).hostname;
        const timestamp = new Date().toISOString();
        
        this.pageContext = {
            title: tab.title,
            url: tab.url,
            domain: domain,
            timestamp: timestamp,
            isYouTube: tab.url.includes('youtube.com'),
            youtube: null,
            type: 'webpage'
        };
        
        this.pageTitle.textContent = tab.title;
        this.pageUrl.textContent = tab.url;
        
        // Store current context
        this.currentContext = {
            url: tab.url,
            title: tab.title,
            domain: domain,
            timestamp: timestamp,
            type: 'webpage'
        };
        
        this.updateJsonContext();
        this.checkRelatedNotes(tab.url);
    }

    setupPageContext(response) {
        const timestamp = new Date().toISOString();
        const domain = new URL(response.url).hostname;
        
        this.pageContext = {
            title: response.title,
            url: response.url,
            summary: response.summary || '',
            domain: domain,
            timestamp: timestamp,
            isYouTube: response.isYouTube || false,
            youtube: response.youtube || null,
            type: response.isYouTube ? 'youtube' : 'webpage'
        };
        
        // Display context
        this.pageTitle.textContent = response.title;
        this.pageUrl.textContent = response.url;
        
        // Show summary if available
        if (response.summary && response.summary.trim()) {
            this.pageSummary.textContent = response.summary;
            this.pageSummary.style.display = 'block';
        }
        
        // Handle YouTube-specific content
        if (response.isYouTube && response.youtube) {
            this.setupYouTubeContext(response.youtube);
        }
        
        // Store current context
        this.currentContext = {
            url: response.url,
            title: response.title,
            domain: domain,
            timestamp: timestamp,
            summary: response.summary || '',
            type: response.isYouTube ? 'youtube' : 'webpage',
            youtube: response.youtube || null
        };
        
        this.updateJsonContext();
        this.checkRelatedNotes(response.url);
    }

    setupYouTubeContext(youtube) {
        this.videoTitle.textContent = youtube.videoTitle;
        this.videoTime.textContent = `⏰ Current time: ${youtube.timeString} • 📺 ${youtube.channelName}`;
        
        if (youtube.timestampedUrl) {
            this.timestampedUrl.textContent = `🔗 Open at ${youtube.timeString}`;
            this.timestampedUrl.addEventListener('click', () => {
                chrome.tabs.create({ url: youtube.timestampedUrl });
            });
        }
        
        this.videoInfo.style.display = 'block';
        
        // Update context with YouTube info
        if (this.pageContext) {
            this.pageContext.youtube = {
                videoTitle: youtube.videoTitle,
                channelName: youtube.channelName,
                currentTime: youtube.currentTime || 0,
                timeString: youtube.timeString,
                timestampedUrl: youtube.timestampedUrl,
                videoId: youtube.videoId || null
            };
            
            this.currentContext.youtube = this.pageContext.youtube;
            this.updateJsonContext();
        }
        
        // Auto-pause video
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'pauseVideo' });
            }
        });
    }

    async checkRelatedNotes(url) {
        try {
            const response = await this.sendMessage({ type: 'GET_NOTES' });
            
            if (response && response.success && response.notes) {
                const notes = response.notes;
                const domain = new URL(url).hostname;
                const exactUrlNotes = notes.filter(note => (note.metadata?.url || note.url) === url);
                const sameWebsiteNotes = notes.filter(note => {
                    const noteUrl = note.metadata?.url || note.url;
                    return noteUrl && new URL(noteUrl).hostname === domain && noteUrl !== url;
                });
                
                if (exactUrlNotes.length > 0 || sameWebsiteNotes.length > 0) {
                    let relatedText = '';
                    
                    if (exactUrlNotes.length > 0) {
                        relatedText += `📝 ${exactUrlNotes.length} note(s) from this page`;
                    }
                    if (sameWebsiteNotes.length > 0) {
                        if (relatedText) relatedText += ' • ';
                        relatedText += `🌐 ${sameWebsiteNotes.length} note(s) from ${domain}`;
                    }
                    
                    this.relatedNotes.textContent = relatedText;
                    this.relatedNotes.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error checking related notes:', error);
        }
    }

    openCurrentPage() {
        if (this.currentContext && this.currentContext.url) {
            chrome.tabs.create({ url: this.currentContext.url });
        }
    }

    async handleSaveNote() {
        const noteText = this.noteContent.value.trim();
        if (!noteText) {
            this.noteContent.focus();
            return false;
        }

        // Show progress
        this.showStatus('💾 Saving note...', true);
        this.saveBtn.disabled = true;
        this.clearBtn.disabled = true;

        try {
            // Get current tab context if not already set
            let context = this.currentContext;
            if (!context) {
                context = await this.getCurrentTabContext();
            }

            // Send note to background for processing with enhanced context
            const enhancedContext = {
                ...context,
                metadata: {
                    url: context.url,
                    title: context.title,
                    domain: context.domain,
                    timestamp: context.timestamp || new Date().toISOString(),
                    type: context.type || 'webpage',
                    summary: context.summary || null
                },
                youtube: context.youtube || null
            };

            const response = await this.sendMessage({
                type: 'SAVE_NOTE',
                data: {
                    content: noteText,
                    context: enhancedContext
                }
            });

            if (response && response.success) {
                this.showStatus('✅ Note saved!', false);
                
                // Resume video if YouTube
                if (this.pageContext?.isYouTube) {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, { action: 'resumeVideo' });
                        }
                    });
                }
                
                // Close panel after brief delay
                setTimeout(() => {
                    window.close();
                }, 800);
                
                return true;
            } else {
                throw new Error(response?.error || 'Save failed');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            this.showStatus('❌ Failed to save note', false);
            return false;
        } finally {
            this.saveBtn.disabled = false;
            this.clearBtn.disabled = false;
        }
    }

    showStatus(text, showProgress) {
        this.statusText.textContent = text;
        this.statusSection.style.display = 'block';
        
        if (showProgress) {
            this.progressBar.style.display = 'block';
            // Animate progress bar
            let width = 0;
            const interval = setInterval(() => {
                width += 10;
                this.progressFill.style.width = width + '%';
                if (width >= 90) clearInterval(interval);
            }, 100);
        } else {
            this.progressBar.style.display = 'none';
        }
    }

    async getCurrentTabContext() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return {
                url: tab.url,
                title: tab.title,
                domain: new URL(tab.url).hostname,
                timestamp: new Date().toISOString(),
                type: tab.url.includes('youtube.com') ? 'youtube' : 'webpage'
            };
        } catch (error) {
            console.error('Error getting tab context:', error);
            return {
                url: '',
                title: '',
                domain: '',
                timestamp: new Date().toISOString(),
                type: 'webpage'
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

    hideStatus() {
        this.statusSection.style.display = 'none';
    }

    handleClose() {
        // Resume video if YouTube
        if (this.pageContext?.isYouTube) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'resumeVideo' });
                }
            });
        }
        window.close();
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
                    
                    this.showStatus('Selection captured!', false);
                } else {
                    this.showStatus('No text selected on the page', false);
                }
            } else {
                this.showStatus('Cannot capture from this page', false);
            }
        } catch (error) {
            console.error('Error capturing selection:', error);
            this.showStatus('Error capturing selection', false);
        }
    }

    async openNotesPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !tab.url.startsWith('chrome://')) {
                // Send message to content script to show notes overlay
                chrome.tabs.sendMessage(tab.id, { action: 'showNotesOverlay' });
                // Close the sidepanel after triggering overlay
                setTimeout(() => window.close(), 300);
            } else {
                this.showStatus('Cannot show overlay on this page', false);
            }
        } catch (error) {
            console.error('Error opening notes overlay:', error);
            this.showStatus('Error opening notes overlay', false);
        }
    }

    async openCategoriesPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !tab.url.startsWith('chrome://')) {
                // Send message to content script to show categories overlay
                chrome.tabs.sendMessage(tab.id, { action: 'showCategoriesOverlay' });
                // Close the sidepanel after triggering overlay
                setTimeout(() => window.close(), 300);
            } else {
                this.showStatus('Cannot show overlay on this page', false);
            }
        } catch (error) {
            console.error('Error opening categories overlay:', error);
            this.showStatus('Error opening categories overlay', false);
        }
    }

    handleLoadNoteForEdit(data) {
        // Handle message from popup to load a specific note for editing
        if (data.noteId) {
            // Focus the textarea and show a message
            this.noteContent.focus();
            this.showStatus('Loading note for editing...', false);
            // In a real implementation, you'd fetch the note by ID
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
        // Enter key to save and close
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
            this.handleClose();
        }
    }

    async handleSaveAndClose() {
        try {
            const success = await this.handleSaveNote();
            if (success) {
                // Close the window after successful save
                setTimeout(() => {
                    this.handleClose();
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

    updateJsonContext() {
        if (!this.currentContext) return;
        
        // Create structured JSON context for categorization
        const jsonContext = {
            metadata: {
                url: this.currentContext.url,
                title: this.currentContext.title,
                domain: this.currentContext.domain,
                timestamp: this.currentContext.timestamp,
                type: this.currentContext.type
            },
            content: {
                summary: this.currentContext.summary || null
            }
        };
        
        // Add YouTube-specific context
        if (this.currentContext.type === 'youtube' && this.currentContext.youtube) {
            jsonContext.youtube = {
                videoTitle: this.currentContext.youtube.videoTitle,
                channelName: this.currentContext.youtube.channelName,
                currentTime: this.currentContext.youtube.currentTime,
                timeString: this.currentContext.youtube.timeString,
                videoId: this.currentContext.youtube.videoId,
                timestampedUrl: this.currentContext.youtube.timestampedUrl
            };
        }
        
        // Display formatted JSON
        this.jsonContent.textContent = JSON.stringify(jsonContext, null, 2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the floating panel app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.floatingPanelApp = new FloatingPanelApp();
});