// Content Script for Knowledge Graph Notes Extension with In-Page Overlays
class KnowledgeNotesContent {
    constructor() {
        this.isInitialized = false;
        this.selectedText = '';
        this.pageContext = null;
        this.notesOverlay = null;
        this.categoriesOverlay = null;
        this.noteCaptureOverlay = null;
        this.notes = [];
        this.categories = [];
        
        this.initialize();
    }

    initialize() {
        if (this.isInitialized) return;
        
        // Get page context
        this.pageContext = this.getPageContext();
        
        // Listen for selection changes
        document.addEventListener('selectionchange', () => this.handleSelectionChange());
        
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        this.isInitialized = true;
        console.log('Knowledge Notes content script initialized');
    }

    getPageContext() {
        return {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            pathname: window.location.pathname,
            timestamp: Date.now()
        };
    }

    handleSelectionChange() {
        const selection = window.getSelection();
        this.selectedText = selection.toString().trim();
        
        // Store selection for potential use
        if (this.selectedText.length > 0) {
            // Could add visual indicators or floating buttons here
            this.handleTextSelection(this.selectedText);
        }
    }

    handleTextSelection(text) {
        // Store the selected text and context for potential quick capture
        const selectionData = {
            text: text,
            context: this.pageContext,
            range: this.getSelectionRange()
        };
        
        // Send to background script for storage
        chrome.runtime.sendMessage({
            type: 'SELECTION_MADE',
            data: selectionData
        });
    }

    getSelectionRange() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        return {
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            boundingRect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            }
        };
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.type || message.action) {
            case 'GET_PAGE_CONTEXT':
            case 'getPageContent':
                this.getPageContent(sendResponse);
                return true;
                
            case 'GET_SELECTED_TEXT':
                sendResponse({
                    text: this.selectedText,
                    context: this.pageContext
                });
                break;
                
            case 'CAPTURE_VISIBLE_TEXT':
                const visibleText = this.extractVisibleText();
                sendResponse({
                    text: visibleText,
                    context: this.pageContext
                });
                break;
                
            case 'HIGHLIGHT_TEXT':
                this.highlightText(message.data.text);
                sendResponse({ success: true });
                break;
                
            case 'pauseVideo':
                this.pauseVideo();
                break;
                
            case 'resumeVideo':
                this.resumeVideo();
                break;
                
            case 'showNotesOverlay':
                this.showNotesOverlay();
                break;
                
            case 'showCategoriesOverlay':
                this.showCategoriesOverlay();
                break;
                
            case 'showNoteCapture':
                this.showNoteCaptureOverlay();
                break;
                
            case 'hideOverlays':
                this.hideAllOverlays();
                break;
                
            default:
                sendResponse({ error: 'Unknown message type' });
        }
        
        return true; // Keep message channel open
    }

    extractVisibleText() {
        // Extract meaningful text from the page
        const contentSelectors = [
            'main',
            'article', 
            '[role="main"]',
            '.content',
            '.post-content',
            '.entry-content',
            '#content'
        ];
        
        let content = '';
        
        // Try to find main content area
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                content = this.extractTextFromElement(element);
                break;
            }
        }
        
        // Fallback to body if no main content found
        if (!content) {
            content = this.extractTextFromElement(document.body);
        }
        
        // Clean up and limit length
        return this.cleanText(content).substring(0, 2000);
    }

    extractTextFromElement(element) {
        // Clone element to avoid modifying the original
        const clone = element.cloneNode(true);
        
        // Remove script and style elements
        const unwantedElements = clone.querySelectorAll('script, style, nav, header, footer, aside, .nav, .menu');
        unwantedElements.forEach(el => el.remove());
        
        // Get text content
        return clone.textContent || clone.innerText || '';
    }

    cleanText(text) {
        return text
            .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
            .replace(/\n\s*\n/g, '\n') // Remove empty lines
            .trim();
    }

    highlightText(searchText) {
        // Simple text highlighting (could be enhanced)
        if (!searchText) return;
        
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            if (node.textContent.includes(searchText)) {
                textNodes.push(node);
            }
        }
        
        textNodes.forEach(textNode => {
            const parent = textNode.parentNode;
            const text = textNode.textContent;
            const highlightedText = text.replace(
                new RegExp(this.escapeRegExp(searchText), 'gi'),
                `<mark style="background-color: #ffeb3b;">$&</mark>`
            );
            
            const wrapper = document.createElement('span');
            wrapper.innerHTML = highlightedText;
            parent.replaceChild(wrapper, textNode);
        });
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getPageContent(sendResponse) {
        try {
            const title = document.title;
            const url = window.location.href;
            const domain = window.location.hostname;
            
            // Get page summary from meta description or first paragraph
            let summary = '';
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                summary = metaDesc.getAttribute('content');
            } else {
                const firstP = document.querySelector('p');
                if (firstP && firstP.textContent.length > 50) {
                    summary = firstP.textContent.substring(0, 200) + '...';
                }
            }
            
            // Check if this is YouTube and get video info
            const isYouTube = url.includes('youtube.com/watch');
            let youtube = null;
            
            if (isYouTube) {
                youtube = this.getYouTubeInfo();
            }
            
            sendResponse({
                title,
                url,
                domain,
                summary,
                isYouTube,
                youtube
            });
        } catch (error) {
            console.error('Error getting page content:', error);
            sendResponse(null);
        }
    }

    getYouTubeInfo() {
        try {
            // Get video title
            const videoTitle = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || 
                              document.querySelector('h1.title')?.textContent?.trim() || 
                              document.title;
            
            // Get channel name
            const channelName = document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
                               document.querySelector('.ytd-video-owner-renderer a')?.textContent?.trim() ||
                               'Unknown Channel';
            
            // Get current video time
            const video = document.querySelector('video');
            const currentTime = video ? Math.floor(video.currentTime) : 0;
            const timeString = this.formatTime(currentTime);
            
            // Get video ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const videoId = urlParams.get('v');
            
            // Create timestamped URL
            const timestampedUrl = videoId ? 
                `https://www.youtube.com/watch?v=${videoId}&t=${currentTime}s` : 
                window.location.href;
            
            return {
                videoTitle,
                channelName,
                currentTime,
                timeString,
                videoId,
                timestampedUrl
            };
        } catch (error) {
            console.error('Error getting YouTube info:', error);
            return null;
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    pauseVideo() {
        const video = document.querySelector('video');
        if (video && !video.paused) {
            video.pause();
        }
    }

    resumeVideo() {
        const video = document.querySelector('video');
        if (video && video.paused) {
            video.play();
        }
    }

    async showNotesOverlay() {
        if (this.notesOverlay) {
            this.notesOverlay.style.display = 'flex';
            return;
        }
        
        // Inject CSS first
        this.injectOverlayCSS();
        
        // Load notes first
        await this.loadNotes();
        
        // Create notes overlay
        this.notesOverlay = this.createNotesOverlay();
        document.body.appendChild(this.notesOverlay);
    }

    async showCategoriesOverlay() {
        if (this.categoriesOverlay) {
            this.categoriesOverlay.style.display = 'flex';
            return;
        }
        
        // Inject CSS first
        this.injectOverlayCSS();
        
        // Load categories first
        await this.loadCategories();
        
        // Create categories overlay
        this.categoriesOverlay = this.createCategoriesOverlay();
        document.body.appendChild(this.categoriesOverlay);
    }

    hideAllOverlays() {
        if (this.notesOverlay) {
            this.notesOverlay.style.display = 'none';
        }
        if (this.categoriesOverlay) {
            this.categoriesOverlay.style.display = 'none';
        }
        if (this.noteCaptureOverlay) {
            this.noteCaptureOverlay.style.display = 'none';
        }
    }

    createNotesOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'kg-notes-overlay';
        overlay.innerHTML = `
            <div class="kg-overlay-content">
                <div class="kg-overlay-header">
                    <h2>📚 Notes for this page</h2>
                    <div class="kg-overlay-actions">
                        <button class="kg-btn kg-btn-secondary" id="kg-refresh-notes">🔄</button>
                        <button class="kg-btn kg-btn-secondary" id="kg-close-notes">✕</button>
                    </div>
                </div>
                <div class="kg-overlay-body">
                    <div class="kg-search-box">
                        <input type="text" id="kg-search-notes" placeholder="Search notes...">
                    </div>
                    <div class="kg-notes-list" id="kg-notes-list">
                        ${this.renderNotesList()}
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        overlay.querySelector('#kg-close-notes').addEventListener('click', () => {
            this.hideAllOverlays();
        });
        
        overlay.querySelector('#kg-refresh-notes').addEventListener('click', () => {
            this.refreshNotes();
        });
        
        overlay.querySelector('#kg-search-notes').addEventListener('input', (e) => {
            this.filterNotes(e.target.value);
        });
        
        // Close on outside click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideAllOverlays();
            }
        });
        
        return overlay;
    }

    createCategoriesOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'kg-categories-overlay';
        overlay.innerHTML = `
            <div class="kg-overlay-content">
                <div class="kg-overlay-header">
                    <h2>🏷️ Categories</h2>
                    <div class="kg-overlay-actions">
                        <button class="kg-btn kg-btn-primary" id="kg-add-category">+ Add</button>
                        <button class="kg-btn kg-btn-secondary" id="kg-close-categories">✕</button>
                    </div>
                </div>
                <div class="kg-overlay-body">
                    <div class="kg-categories-list" id="kg-categories-list">
                        ${this.renderCategoriesList()}
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        overlay.querySelector('#kg-close-categories').addEventListener('click', () => {
            this.hideAllOverlays();
        });
        
        // Close on outside click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideAllOverlays();
            }
        });
        
        return overlay;
    }

    async showNoteCaptureOverlay() {
        if (this.noteCaptureOverlay) {
            this.noteCaptureOverlay.style.display = 'flex';
            // Focus the textarea
            const textarea = this.noteCaptureOverlay.querySelector('#kg-note-textarea');
            if (textarea) textarea.focus();
            return;
        }
        
        // Inject CSS first
        this.injectOverlayCSS();
        
        // Get current page context
        const pageContext = await this.getCurrentPageContext();
        
        // Create note capture overlay
        this.noteCaptureOverlay = this.createNoteCaptureOverlay(pageContext);
        document.body.appendChild(this.noteCaptureOverlay);
        
        // Focus the textarea after a brief delay
        setTimeout(() => {
            const textarea = this.noteCaptureOverlay.querySelector('#kg-note-textarea');
            if (textarea) textarea.focus();
        }, 100);
    }

    async getCurrentPageContext() {
        const url = window.location.href;
        const title = document.title;
        const domain = window.location.hostname;
        const timestamp = new Date().toISOString();
        
        // Get page summary
        let summary = '';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            summary = metaDesc.getAttribute('content');
        } else {
            const firstP = document.querySelector('p');
            if (firstP && firstP.textContent.length > 50) {
                summary = firstP.textContent.substring(0, 200) + '...';
            }
        }
        
        // Check if YouTube and get video info
        const isYouTube = url.includes('youtube.com/watch');
        let youtube = null;
        
        if (isYouTube) {
            youtube = this.getYouTubeInfo();
        }
        
        return {
            url,
            title,
            domain,
            timestamp,
            summary,
            isYouTube,
            youtube,
            type: isYouTube ? 'youtube' : 'webpage'
        };
    }

    createNoteCaptureOverlay(pageContext) {
        const overlay = document.createElement('div');
        overlay.className = 'kg-note-capture-overlay';
        
        const jsonContext = {
            metadata: {
                url: pageContext.url,
                title: pageContext.title,
                domain: pageContext.domain,
                timestamp: pageContext.timestamp,
                type: pageContext.type
            },
            content: {
                summary: pageContext.summary || null
            }
        };
        
        if (pageContext.youtube) {
            jsonContext.youtube = pageContext.youtube;
        }
        
        overlay.innerHTML = `
            <div class="kg-note-capture-content">
                <!-- Header with drag handle -->
                <div class="kg-note-capture-header">
                    <div class="kg-drag-handle">
                        <div class="kg-window-controls">
                            <div class="kg-control kg-control-red"></div>
                            <div class="kg-control kg-control-yellow"></div>
                            <div class="kg-control kg-control-green"></div>
                        </div>
                        <span class="kg-window-title">📝 Knowledge Graph Notes</span>
                    </div>
                    <div class="kg-header-actions">
                        <button class="kg-opacity-btn" id="kg-opacity-btn">🔍 95%</button>
                        <button class="kg-close-btn" id="kg-close-capture">×</button>
                    </div>
                </div>
                
                <!-- Context Section -->
                <div class="kg-context-section">
                    <div class="kg-context-header">
                        <h3>📄 Context</h3>
                        <button class="kg-toggle-btn" id="kg-toggle-context">Hide</button>
                    </div>
                    <div class="kg-context-content" id="kg-context-content">
                        <div class="kg-page-title">${this.escapeHtml(pageContext.title)}</div>
                        <div class="kg-page-url">${this.escapeHtml(pageContext.url)}</div>
                        ${pageContext.summary ? `<div class="kg-page-summary">${this.escapeHtml(pageContext.summary)}</div>` : ''}
                        ${pageContext.youtube ? `
                            <div class="kg-video-info">
                                <div class="kg-video-label">🎥 YouTube Video</div>
                                <div class="kg-video-title">${this.escapeHtml(pageContext.youtube.videoTitle || '')}</div>
                                <div class="kg-video-meta">⏰ ${pageContext.youtube.timeString || '0:00'} • 📺 ${this.escapeHtml(pageContext.youtube.channelName || '')}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- JSON Context -->
                <div class="kg-json-section">
                    <div class="kg-json-header">
                        <h3>🗂️ Context JSON</h3>
                        <button class="kg-toggle-btn" id="kg-toggle-json">Hide</button>
                    </div>
                    <div class="kg-json-content" id="kg-json-content">
                        <pre>${JSON.stringify(jsonContext, null, 2)}</pre>
                    </div>
                </div>
                
                <!-- Note Input -->
                <div class="kg-note-section">
                    <textarea 
                        id="kg-note-textarea" 
                        placeholder="Your notes here... (Press Ctrl+Enter to save)"
                        rows="6"
                    ></textarea>
                    
                    <div class="kg-note-actions">
                        <button id="kg-capture-selection" class="kg-btn kg-btn-secondary">📋 Get Selection</button>
                        <div class="kg-note-main-actions">
                            <button id="kg-clear-note" class="kg-btn kg-btn-secondary">Clear</button>
                            <button id="kg-save-note" class="kg-btn kg-btn-primary">💾 Save Note</button>
                        </div>
                    </div>
                    
                    <div id="kg-note-status" class="kg-note-status" style="display: none;"></div>
                </div>
            </div>
        `;
        
        // Add event listeners
        this.setupNoteCaptureEvents(overlay, pageContext);
        
        return overlay;
    }

    setupNoteCaptureEvents(overlay, pageContext) {
        const textarea = overlay.querySelector('#kg-note-textarea');
        const saveBtn = overlay.querySelector('#kg-save-note');
        const clearBtn = overlay.querySelector('#kg-clear-note');
        const closeBtn = overlay.querySelector('#kg-close-capture');
        const captureBtn = overlay.querySelector('#kg-capture-selection');
        const toggleContextBtn = overlay.querySelector('#kg-toggle-context');
        const toggleJsonBtn = overlay.querySelector('#kg-toggle-json');
        const contextContent = overlay.querySelector('#kg-context-content');
        const jsonContent = overlay.querySelector('#kg-json-content');
        const statusDiv = overlay.querySelector('#kg-note-status');
        
        // Close overlay
        closeBtn.addEventListener('click', () => {
            this.hideAllOverlays();
            // Resume video if YouTube
            if (pageContext.isYouTube) {
                this.resumeVideo();
            }
        });
        
        // Toggle context
        toggleContextBtn.addEventListener('click', () => {
            if (contextContent.style.display === 'none') {
                contextContent.style.display = 'block';
                toggleContextBtn.textContent = 'Hide';
            } else {
                contextContent.style.display = 'none';
                toggleContextBtn.textContent = 'Show';
            }
        });
        
        // Toggle JSON
        toggleJsonBtn.addEventListener('click', () => {
            if (jsonContent.style.display === 'none') {
                jsonContent.style.display = 'block';
                toggleJsonBtn.textContent = 'Hide';
            } else {
                jsonContent.style.display = 'none';
                toggleJsonBtn.textContent = 'Show';
            }
        });
        
        // Capture selection
        captureBtn.addEventListener('click', () => {
            const selectedText = window.getSelection().toString().trim();
            if (selectedText) {
                const currentContent = textarea.value;
                textarea.value = currentContent ? 
                    `${currentContent}\n\n"${selectedText}"` : 
                    `"${selectedText}"`;
                this.showNoteStatus('Selection captured!', 'success', statusDiv);
            } else {
                this.showNoteStatus('No text selected', 'error', statusDiv);
            }
        });
        
        // Clear note
        clearBtn.addEventListener('click', () => {
            textarea.value = '';
            textarea.focus();
        });
        
        // Save note
        saveBtn.addEventListener('click', async () => {
            await this.saveNoteFromOverlay(textarea.value, pageContext, statusDiv, saveBtn);
        });
        
        // Keyboard shortcuts
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveNoteFromOverlay(textarea.value, pageContext, statusDiv, saveBtn);
            }
            if (e.key === 'Escape') {
                this.hideAllOverlays();
            }
        });
        
        // Close on outside click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideAllOverlays();
            }
        });
        
        // Pause video if YouTube
        if (pageContext.isYouTube) {
            this.pauseVideo();
        }
    }

    async saveNoteFromOverlay(noteText, pageContext, statusDiv, saveBtn) {
        if (!noteText.trim()) {
            this.showNoteStatus('Please enter some content', 'error', statusDiv);
            return;
        }
        
        this.showNoteStatus('💾 Saving note...', 'loading', statusDiv);
        saveBtn.disabled = true;
        
        try {
            const enhancedContext = {
                ...pageContext,
                metadata: {
                    url: pageContext.url,
                    title: pageContext.title,
                    domain: pageContext.domain,
                    timestamp: pageContext.timestamp,
                    type: pageContext.type,
                    summary: pageContext.summary || null
                },
                youtube: pageContext.youtube || null
            };
            
            const response = await this.sendMessage({
                type: 'SAVE_NOTE',
                data: {
                    content: noteText.trim(),
                    context: enhancedContext
                }
            });
            
            if (response && response.success) {
                this.showNoteStatus('✅ Note saved successfully!', 'success', statusDiv);
                
                // Resume video if YouTube
                if (pageContext.isYouTube) {
                    this.resumeVideo();
                }
                
                // Close overlay after delay
                setTimeout(() => {
                    this.hideAllOverlays();
                }, 1500);
            } else {
                throw new Error(response?.error || 'Save failed');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            this.showNoteStatus('❌ Failed to save note', 'error', statusDiv);
        } finally {
            saveBtn.disabled = false;
        }
    }

    showNoteStatus(message, type, statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `kg-note-status kg-status-${type}`;
        statusDiv.style.display = 'block';
        
        if (type !== 'loading') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }

    async loadNotes() {
        try {
            const response = await this.sendMessage({ type: 'GET_NOTES' });
            if (response && response.success && response.notes) {
                this.notes = response.notes;
                
                // Filter notes for current page
                const currentUrl = window.location.href;
                const currentDomain = window.location.hostname;
                
                this.pageNotes = this.notes.filter(note => {
                    const noteUrl = note.metadata?.url || note.url;
                    const noteDomain = noteUrl ? new URL(noteUrl).hostname : '';
                    return noteUrl === currentUrl || noteDomain === currentDomain;
                });
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            this.notes = [];
            this.pageNotes = [];
        }
    }

    async loadCategories() {
        try {
            const stored = await this.getFromStorage(['categories']);
            if (stored.categories && stored.categories.length > 0) {
                this.categories = stored.categories;
            } else {
                // Default categories
                this.categories = [
                    { id: 'research', name: 'Research', definition: 'Academic or professional research notes' },
                    { id: 'ideas', name: 'Ideas', definition: 'Creative ideas and brainstorming' },
                    { id: 'todo', name: 'To-Do', definition: 'Tasks and action items' },
                    { id: 'reference', name: 'Reference', definition: 'Reference materials and documentation' }
                ];
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = [];
        }
    }

    renderNotesList() {
        if (!this.pageNotes || this.pageNotes.length === 0) {
            return '<div class="kg-empty-state">No notes found for this page</div>';
        }
        
        return this.pageNotes.map(note => `
            <div class="kg-note-item" data-note-id="${note.id}">
                <div class="kg-note-content">${this.escapeHtml(note.content)}</div>
                <div class="kg-note-meta">
                    <span class="kg-note-date">${this.formatDate(note.created_at)}</span>
                </div>
            </div>
        `).join('');
    }

    renderCategoriesList() {
        if (!this.categories || this.categories.length === 0) {
            return '<div class="kg-empty-state">No categories found</div>';
        }
        
        return this.categories.map(category => `
            <div class="kg-category-item" data-category-id="${category.id}">
                <div class="kg-category-header">
                    <h4>${this.escapeHtml(category.name)}</h4>
                </div>
                <div class="kg-category-definition">${this.escapeHtml(category.definition || 'No definition')}</div>
            </div>
        `).join('');
    }

    async refreshNotes() {
        await this.loadNotes();
        if (this.notesOverlay) {
            const notesList = this.notesOverlay.querySelector('#kg-notes-list');
            notesList.innerHTML = this.renderNotesList();
        }
    }

    filterNotes(query) {
        const filteredNotes = this.pageNotes.filter(note => 
            note.content.toLowerCase().includes(query.toLowerCase())
        );
        
        if (this.notesOverlay) {
            const notesList = this.notesOverlay.querySelector('#kg-notes-list');
            notesList.innerHTML = filteredNotes.length > 0 ? 
                filteredNotes.map(note => `
                    <div class="kg-note-item" data-note-id="${note.id}">
                        <div class="kg-note-content">${this.escapeHtml(note.content)}</div>
                        <div class="kg-note-meta">
                            <span class="kg-note-date">${this.formatDate(note.created_at)}</span>
                        </div>
                    </div>
                `).join('') : 
                '<div class="kg-empty-state">No matching notes found</div>';
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        
        let date;
        if (timestamp._seconds) {
            date = new Date(timestamp._seconds * 1000);
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

    injectOverlayCSS() {
        if (document.getElementById('kg-overlay-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'kg-overlay-styles';
        style.textContent = `
            .kg-notes-overlay, .kg-categories-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
            }
            
            .kg-overlay-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .kg-overlay-header {
                padding: 20px;
                border-bottom: 1px solid #e1e5e9;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .kg-overlay-header h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .kg-overlay-actions {
                display: flex;
                gap: 8px;
            }
            
            .kg-overlay-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }
            
            .kg-search-box {
                margin-bottom: 16px;
            }
            
            .kg-search-box input {
                width: 100%;
                padding: 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .kg-search-box input:focus {
                outline: none;
                border-color: #667eea;
            }
            
            .kg-notes-list, .kg-categories-list {
                max-height: 400px;
                overflow-y: auto;
            }
            
            .kg-note-item, .kg-category-item {
                background: #f8f9fa;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                transition: all 0.2s ease;
            }
            
            .kg-note-item:hover, .kg-category-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .kg-note-content {
                font-size: 14px;
                line-height: 1.5;
                margin-bottom: 12px;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            
            .kg-note-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: #6c757d;
            }
            
            .kg-category-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .kg-category-header h4 {
                margin: 0;
                font-size: 16px;
                color: #2c3e50;
            }
            
            .kg-category-definition {
                font-size: 13px;
                color: #6c757d;
                line-height: 1.4;
            }
            
            .kg-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .kg-btn-primary {
                background: #667eea;
                color: white;
            }
            
            .kg-btn-primary:hover {
                background: #5a67d8;
            }
            
            .kg-btn-secondary {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            
            .kg-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .kg-empty-state {
                text-align: center;
                padding: 40px 20px;
                color: #6c757d;
                font-style: italic;
            }
            
            /* Note Capture Overlay Styles */
            .kg-note-capture-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
            }
            
            .kg-note-capture-content {
                background: rgba(31, 41, 55, 0.95);
                border: 1px solid rgba(75, 85, 99, 0.5);
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                backdrop-filter: blur(20px);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }
            
            .kg-note-capture-header {
                background: linear-gradient(90deg, rgba(59, 130, 246, 0.5), rgba(147, 51, 234, 0.5));
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
            }
            
            .kg-drag-handle {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: move;
            }
            
            .kg-window-controls {
                display: flex;
                gap: 6px;
            }
            
            .kg-control {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            
            .kg-control-red {
                background-color: #ef4444;
            }
            
            .kg-control-yellow {
                background-color: #eab308;
            }
            
            .kg-control-green {
                background-color: #22c55e;
            }
            
            .kg-window-title {
                color: white;
                font-size: 12px;
                font-weight: 500;
            }
            
            .kg-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .kg-opacity-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: rgba(255, 255, 255, 0.8);
                font-size: 10px;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .kg-close-btn {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                font-size: 16px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .kg-close-btn:hover {
                color: white;
            }
            
            .kg-context-section, .kg-json-section {
                padding: 12px;
                border-bottom: 1px solid rgba(75, 85, 99, 0.3);
                flex-shrink: 0;
            }
            
            .kg-context-header, .kg-json-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .kg-context-header h3, .kg-json-header h3 {
                color: #93c5fd;
                font-size: 12px;
                font-weight: 500;
                margin: 0;
            }
            
            .kg-toggle-btn {
                background: none;
                border: none;
                color: #9ca3af;
                font-size: 10px;
                cursor: pointer;
            }
            
            .kg-toggle-btn:hover {
                color: #d1d5db;
            }
            
            .kg-context-content {
                color: #d1d5db;
                font-size: 11px;
                line-height: 1.4;
            }
            
            .kg-page-title {
                font-weight: 500;
                margin-bottom: 4px;
                word-wrap: break-word;
            }
            
            .kg-page-url {
                color: #9ca3af;
                font-size: 10px;
                margin-bottom: 8px;
                word-wrap: break-word;
            }
            
            .kg-page-summary {
                background: rgba(55, 65, 81, 0.3);
                padding: 6px;
                border-radius: 4px;
                border-left: 2px solid rgba(59, 130, 246, 0.3);
                margin-bottom: 8px;
                max-height: 60px;
                overflow-y: auto;
            }
            
            .kg-video-info {
                background: rgba(220, 38, 127, 0.2);
                padding: 6px;
                border-radius: 4px;
                border: 1px solid rgba(239, 68, 68, 0.3);
            }
            
            .kg-video-label {
                color: #f87171;
                font-size: 10px;
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .kg-video-title {
                font-weight: 500;
                margin-bottom: 4px;
            }
            
            .kg-video-meta {
                color: #9ca3af;
                font-size: 10px;
            }
            
            .kg-json-content {
                background: rgba(0, 0, 0, 0.3);
                padding: 8px;
                border-radius: 4px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 9px;
                color: #e5e7eb;
                border: 1px solid rgba(75, 85, 99, 0.3);
                max-height: 120px;
                overflow-y: auto;
            }
            
            .kg-json-content pre {
                margin: 0;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            
            .kg-note-section {
                padding: 12px;
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            
            .kg-note-section textarea {
                width: 100%;
                padding: 12px;
                border: 2px solid rgba(107, 114, 128, 0.5);
                border-radius: 8px;
                font-size: 13px;
                font-family: inherit;
                resize: vertical;
                background: rgba(55, 65, 81, 0.8);
                color: #f9fafb;
                flex: 1;
                min-height: 120px;
                box-sizing: border-box;
            }
            
            .kg-note-section textarea::placeholder {
                color: #9ca3af;
            }
            
            .kg-note-section textarea:focus {
                outline: none;
                border-color: #3b82f6;
            }
            
            .kg-note-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 12px;
                gap: 8px;
            }
            
            .kg-note-main-actions {
                display: flex;
                gap: 8px;
            }
            
            .kg-note-status {
                margin-top: 8px;
                padding: 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
                text-align: center;
            }
            
            .kg-status-success {
                background-color: rgba(34, 197, 94, 0.2);
                color: #4ade80;
                border: 1px solid rgba(34, 197, 94, 0.3);
            }
            
            .kg-status-error {
                background-color: rgba(239, 68, 68, 0.2);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.3);
            }
            
            .kg-status-loading {
                background-color: rgba(59, 130, 246, 0.2);
                color: #60a5fa;
                border: 1px solid rgba(59, 130, 246, 0.3);
            }
        `;
        
        document.head.appendChild(style);
    }

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

    async getFromStorage(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, resolve);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Method to create floating note button (optional enhancement)
    createFloatingNoteButton(text, position) {
        // Remove existing button
        const existing = document.getElementById('kg-floating-note-btn');
        if (existing) existing.remove();
        
        // Create new button
        const button = document.createElement('button');
        button.id = 'kg-floating-note-btn';
        button.innerHTML = '📝';
        button.style.cssText = `
            position: fixed;
            top: ${position.top + 20}px;
            left: ${position.left}px;
            z-index: 10000;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 14px;
        `;
        
        button.addEventListener('click', () => {
            // Send message to open side panel with selected text
            chrome.runtime.sendMessage({
                type: 'QUICK_NOTE_FROM_SELECTION',
                data: {
                    content: text,
                    context: this.pageContext
                }
            });
            
            button.remove();
        });
        
        document.body.appendChild(button);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (button.parentNode) {
                button.remove();
            }
        }, 5000);
    }

    // Clean up method
    cleanup() {
        const floatingBtn = document.getElementById('kg-floating-note-btn');
        if (floatingBtn) floatingBtn.remove();
        
        // Remove any highlights
        const highlights = document.querySelectorAll('mark[style*="background-color: #ffeb3b"]');
        highlights.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
    }
}

// Initialize content script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new KnowledgeNotesContent();
    });
} else {
    new KnowledgeNotesContent();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.knowledgeNotesContent) {
        window.knowledgeNotesContent.cleanup();
    }
});