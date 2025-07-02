// Content Script for Knowledge Graph Notes Extension
class KnowledgeNotesContent {
    constructor() {
        this.isInitialized = false;
        this.selectedText = '';
        this.pageContext = null;
        
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
        switch (message.type) {
            case 'GET_PAGE_CONTEXT':
                sendResponse(this.getPageContext());
                break;
                
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