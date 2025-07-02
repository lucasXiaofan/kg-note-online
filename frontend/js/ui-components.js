// UI Components - Handles all user interface interactions
class UIComponents {
    constructor(noteManager) {
        this.noteManager = noteManager;
        this.currentUser = null;
        this.notesListener = null;
        this.categoriesListener = null;
        
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Form elements
        this.noteContentInput = document.getElementById('noteContent');
        this.noteUrlInput = document.getElementById('noteUrl');
        this.noteTitleInput = document.getElementById('noteTitle');
        this.saveNoteBtn = document.getElementById('saveNote');
        this.saveStatus = document.getElementById('saveStatus');
        
        // Display elements
        this.notesList = document.getElementById('notesList');
        this.categoriesList = document.getElementById('categoriesList');
        this.searchInput = document.getElementById('searchNotes');
        this.categoryFilter = document.getElementById('categoryFilter');
        
        // Auth elements (will be added)
        this.authSection = null;
        this.userInfo = null;
    }

    attachEventListeners() {
        // Save note button
        this.saveNoteBtn.addEventListener('click', () => this.handleSaveNote());
        
        // Enter key on textarea
        this.noteContentInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleSaveNote();
            }
        });
        
        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        // Category filter
        this.categoryFilter.addEventListener('change', (e) => {
            this.handleCategoryFilter(e.target.value);
        });
        
        // Auto-populate title from URL
        this.noteUrlInput.addEventListener('blur', () => {
            this.autoPopulateTitle();
        });
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.noteManager.setCurrentUser(user);
        
        if (user) {
            this.showMainInterface();
            this.setupRealTimeListeners();
            this.loadInitialData();
        } else {
            this.showAuthInterface();
            this.cleanupListeners();
        }
    }

    showMainInterface() {
        // Show main app interface
        const mainSections = document.querySelectorAll('section');
        mainSections.forEach(section => {
            section.style.display = 'block';
        });
        
        // Hide auth interface if it exists
        if (this.authSection) {
            this.authSection.style.display = 'none';
        }
        
        this.updateUserInfo();
    }

    showAuthInterface() {
        // Hide main interface
        const mainSections = document.querySelectorAll('section');
        mainSections.forEach(section => {
            section.style.display = 'none';
        });
        
        // Show auth interface
        this.createAuthInterface();
    }

    createAuthInterface() {
        if (this.authSection) {
            this.authSection.style.display = 'block';
            return;
        }

        this.authSection = document.createElement('section');
        this.authSection.className = 'auth-section';
        this.authSection.innerHTML = `
            <h2>Welcome to Knowledge Graph Notes</h2>
            <p>Please sign in to start taking notes</p>
            <div class="auth-buttons">
                <button id="signInAnonymously" class="btn-primary">
                    Start Taking Notes (Anonymous)
                </button>
                <button id="signInWithGoogle" class="btn-secondary" style="display: none;">
                    Sign in with Google
                </button>
            </div>
            <div id="authStatus" class="status-message"></div>
        `;
        
        // Insert after header
        const header = document.querySelector('header');
        header.insertAdjacentElement('afterend', this.authSection);
        
        // Attach auth event listeners
        document.getElementById('signInAnonymously').addEventListener('click', () => {
            this.handleAnonymousSignIn();
        });
    }

    updateUserInfo() {
        if (!this.userInfo) {
            this.userInfo = document.createElement('div');
            this.userInfo.className = 'user-info';
            const header = document.querySelector('header');
            header.appendChild(this.userInfo);
        }
        
        if (this.currentUser) {
            const displayName = this.currentUser.isAnonymous ? 
                'Anonymous User' : 
                (this.currentUser.displayName || this.currentUser.email || 'User');
                
            this.userInfo.innerHTML = `
                <span>Welcome, ${displayName}</span>
                <button id="signOut" class="btn-secondary">Sign Out</button>
            `;
            
            document.getElementById('signOut').addEventListener('click', () => {
                this.handleSignOut();
            });
        }
    }

    async handleAnonymousSignIn() {
        try {
            this.showStatus('authStatus', 'Signing in...', 'loading');
            
            const { signInAnonymously } = window.firebaseModules;
            const userCredential = await signInAnonymously(window.auth);
            
            console.log('Anonymous sign in successful');
            this.showStatus('authStatus', 'Signed in successfully!', 'success');
            
            // User will be set by the auth state listener in app.js
            
        } catch (error) {
            console.error('Anonymous sign in failed:', error);
            this.showStatus('authStatus', `Sign in failed: ${error.message}`, 'error');
        }
    }

    async handleSignOut() {
        try {
            await window.auth.signOut();
            console.log('User signed out');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }

    setupRealTimeListeners() {
        // Listen for notes updates
        this.notesListener = this.noteManager.onNotesUpdate((notes) => {
            this.displayNotes(notes);
        });
        
        // Listen for categories updates
        this.categoriesListener = this.noteManager.onCategoriesUpdate((categories) => {
            this.displayCategories(categories);
            this.updateCategoryFilter(categories);
        });
    }

    cleanupListeners() {
        if (this.notesListener) {
            this.notesListener();
            this.notesListener = null;
        }
        
        if (this.categoriesListener) {
            this.categoriesListener();
            this.categoriesListener = null;
        }
    }

    async loadInitialData() {
        try {
            // Load initial data if real-time listeners fail
            const [notes, categories] = await Promise.all([
                this.noteManager.getNotes(),
                this.noteManager.getCategories()
            ]);
            
            // Only update if real-time listeners haven't already populated the data
            if (this.notesList.children.length === 0) {
                this.displayNotes(notes);
            }
            
            if (this.categoriesList.children.length === 0) {
                this.displayCategories(categories);
                this.updateCategoryFilter(categories);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async handleSaveNote() {
        try {
            if (!this.currentUser) {
                this.showStatus('saveStatus', 'Please sign in first', 'error');
                return;
            }

            const content = this.noteContentInput.value.trim();
            if (!content) {
                this.showStatus('saveStatus', 'Please enter note content', 'error');
                return;
            }

            this.showStatus('saveStatus', 'Saving note...', 'loading');
            
            // Prepare note data
            const noteData = {
                content: content,
                metadata: {
                    url: this.noteUrlInput.value.trim(),
                    title: this.noteTitleInput.value.trim(),
                    domain: this.extractDomain(this.noteUrlInput.value.trim())
                }
            };

            // Get categorization from backend API
            const categories = await this.getCategorization(noteData);
            noteData.categories = categories;

            // Save to Firestore
            await this.noteManager.createNote(noteData);
            
            this.showStatus('saveStatus', 'Note saved successfully!', 'success');
            this.clearForm();
            
        } catch (error) {
            console.error('Error saving note:', error);
            this.showStatus('saveStatus', `Error saving note: ${error.message}`, 'error');
        }
    }

    async getCategorization(noteData) {
        try {
            // Call the FastAPI backend for categorization
            const response = await fetch('http://localhost:8000/categorize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: noteData.content,
                    metadata: noteData.metadata
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.categories || ['General'];
            
        } catch (error) {
            console.error('Error getting categorization:', error);
            return ['General']; // Fallback category
        }
    }

    extractDomain(url) {
        try {
            if (!url) return '';
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            return urlObj.hostname;
        } catch (error) {
            return '';
        }
    }

    async autoPopulateTitle() {
        const url = this.noteUrlInput.value.trim();
        if (!url || this.noteTitleInput.value.trim()) return;

        try {
            // Simple title extraction - in a real app, you might want to fetch the page
            const domain = this.extractDomain(url);
            if (domain) {
                this.noteTitleInput.value = `Page from ${domain}`;
            }
        } catch (error) {
            console.error('Error auto-populating title:', error);
        }
    }

    clearForm() {
        this.noteContentInput.value = '';
        this.noteUrlInput.value = '';
        this.noteTitleInput.value = '';
        this.noteContentInput.focus();
    }

    displayNotes(notes) {
        if (!notes || notes.length === 0) {
            this.notesList.innerHTML = `
                <div class="empty-state">
                    <h3>No notes yet</h3>
                    <p>Create your first note to get started!</p>
                </div>
            `;
            return;
        }

        this.notesList.innerHTML = notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-content">${this.escapeHtml(note.content)}</div>
                <div class="note-metadata">
                    <div class="note-categories">
                        ${(note.categories || []).map(cat => 
                            `<span class="category-tag">${this.escapeHtml(cat)}</span>`
                        ).join('')}
                    </div>
                    <div class="note-info">
                        ${note.metadata?.url ? 
                            `<a href="${note.metadata.url}" class="note-url" target="_blank">${this.extractDomain(note.metadata.url)}</a>` : 
                            ''
                        }
                        <span class="note-date">${this.formatDate(note.createdAt)}</span>
                    </div>
                </div>
                <div class="note-actions">
                    <button class="btn-secondary" onclick="uiComponents.editNote('${note.id}')">Edit</button>
                    <button class="btn-danger" onclick="uiComponents.deleteNote('${note.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    displayCategories(categories) {
        if (!categories || categories.length === 0) {
            this.categoriesList.innerHTML = `
                <div class="empty-state">
                    <h3>No categories yet</h3>
                    <p>Categories will appear here as you create notes</p>
                </div>
            `;
            return;
        }

        this.categoriesList.innerHTML = categories.map(category => `
            <div class="category-item">
                <div class="category-name">${this.escapeHtml(category.name)}</div>
                <div class="category-definition">${this.escapeHtml(category.definition)}</div>
                <div class="category-count">${category.noteCount || 0} notes</div>
            </div>
        `).join('');
    }

    updateCategoryFilter(categories) {
        const currentValue = this.categoryFilter.value;
        this.categoryFilter.innerHTML = '<option value="">All Categories</option>';
        
        if (categories && categories.length > 0) {
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                this.categoryFilter.appendChild(option);
            });
        }
        
        // Restore previous selection if it still exists
        if (currentValue) {
            this.categoryFilter.value = currentValue;
        }
    }

    async handleSearch(searchTerm) {
        if (!searchTerm.trim()) {
            // If search is empty, reload all notes
            this.loadInitialData();
            return;
        }

        try {
            const notes = await this.noteManager.searchNotes(searchTerm);
            this.displayNotes(notes);
        } catch (error) {
            console.error('Error searching notes:', error);
        }
    }

    async handleCategoryFilter(category) {
        try {
            const notes = await this.noteManager.getNotes({ category });
            this.displayNotes(notes);
        } catch (error) {
            console.error('Error filtering by category:', error);
        }
    }

    async editNote(noteId) {
        // Simple implementation - populate form for editing
        try {
            const notes = await this.noteManager.getNotes();
            const note = notes.find(n => n.id === noteId);
            
            if (note) {
                this.noteContentInput.value = note.content;
                this.noteUrlInput.value = note.metadata?.url || '';
                this.noteTitleInput.value = note.metadata?.title || '';
                
                // Change save button to update mode
                this.saveNoteBtn.textContent = 'Update Note';
                this.saveNoteBtn.onclick = () => this.handleUpdateNote(noteId);
                
                // Scroll to form
                document.querySelector('.note-creator').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error loading note for editing:', error);
        }
    }

    async handleUpdateNote(noteId) {
        try {
            const content = this.noteContentInput.value.trim();
            if (!content) {
                this.showStatus('saveStatus', 'Please enter note content', 'error');
                return;
            }

            this.showStatus('saveStatus', 'Updating note...', 'loading');
            
            const updateData = {
                content: content,
                metadata: {
                    url: this.noteUrlInput.value.trim(),
                    title: this.noteTitleInput.value.trim(),
                    domain: this.extractDomain(this.noteUrlInput.value.trim())
                }
            };

            await this.noteManager.updateNote(noteId, updateData);
            
            this.showStatus('saveStatus', 'Note updated successfully!', 'success');
            this.clearForm();
            this.resetSaveButton();
            
        } catch (error) {
            console.error('Error updating note:', error);
            this.showStatus('saveStatus', `Error updating note: ${error.message}`, 'error');
        }
    }

    async deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }

        try {
            await this.noteManager.deleteNote(noteId);
            console.log('Note deleted successfully');
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Error deleting note. Please try again.');
        }
    }

    resetSaveButton() {
        this.saveNoteBtn.textContent = 'Save Note';
        this.saveNoteBtn.onclick = () => this.handleSaveNote();
    }

    showStatus(elementId, message, type) {
        const statusElement = document.getElementById(elementId);
        if (!statusElement) return;

        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                statusElement.style.opacity = '0';
            }, 3000);
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        
        // Handle Firestore timestamp
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for global access
window.UIComponents = UIComponents;