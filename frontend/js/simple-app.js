// Simplified App - Works purely through backend API calls
class SimpleApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8000';
        this.currentUserId = null;
        this.notes = [];
        this.categories = [];
        
        this.initializeElements();
        this.attachEventListeners();
        this.handleAnonymousLogin();
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
        
        // Create user info section
        this.createUserInfoSection();
    }

    createUserInfoSection() {
        const header = document.querySelector('header');
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <div id="userStatus">Connecting...</div>
            <button id="newSession" class="btn-secondary" style="display: none;">New Session</button>
        `;
        header.appendChild(userInfo);

        document.getElementById('newSession').addEventListener('click', () => {
            this.handleAnonymousLogin();
        });
    }

    attachEventListeners() {
        this.saveNoteBtn.addEventListener('click', () => this.handleSaveNote());
        
        this.noteContentInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleSaveNote();
            }
        });
        
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        this.categoryFilter.addEventListener('change', (e) => {
            this.handleCategoryFilter(e.target.value);
        });
        
        this.noteUrlInput.addEventListener('blur', () => {
            this.autoPopulateTitle();
        });
    }

    async handleAnonymousLogin() {
        try {
            this.showUserStatus('Creating session...', 'loading');
            
            const response = await fetch(`${this.apiBaseUrl}/auth/anonymous`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.currentUserId = result.userId;
            
            this.showUserStatus(`Connected as ${result.userId}`, 'success');
            document.getElementById('newSession').style.display = 'inline-block';
            
            // Load initial data
            await this.loadNotes();
            await this.loadCategories();
            
        } catch (error) {
            console.error('Error creating anonymous user:', error);
            this.showUserStatus('Connection failed. Please refresh.', 'error');
        }
    }

    async handleSaveNote() {
        try {
            if (!this.currentUserId) {
                this.showStatus('saveStatus', 'Please wait for connection', 'error');
                return;
            }

            const content = this.noteContentInput.value.trim();
            if (!content) {
                this.showStatus('saveStatus', 'Please enter note content', 'error');
                return;
            }

            this.showStatus('saveStatus', 'Saving note...', 'loading');
            
            const noteData = {
                content: content,
                url: this.noteUrlInput.value.trim(),
                metadata: {
                    title: this.noteTitleInput.value.trim(),
                    url: this.noteUrlInput.value.trim(),
                    domain: this.extractDomain(this.noteUrlInput.value.trim())
                }
            };

            const response = await fetch(`${this.apiBaseUrl}/users/${this.currentUserId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(noteData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            this.showStatus('saveStatus', 'Note saved successfully!', 'success');
            this.clearForm();
            
            // Reload notes to show the new one
            await this.loadNotes();
            
        } catch (error) {
            console.error('Error saving note:', error);
            this.showStatus('saveStatus', `Error saving note: ${error.message}`, 'error');
        }
    }

    async loadNotes() {
        try {
            if (!this.currentUserId) return;

            const response = await fetch(`${this.apiBaseUrl}/users/${this.currentUserId}/notes`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.notes = result.notes || [];
            this.displayNotes(this.notes);
            
        } catch (error) {
            console.error('Error loading notes:', error);
            this.notesList.innerHTML = '<div class="error">Error loading notes</div>';
        }
    }

    async loadCategories() {
        try {
            if (!this.currentUserId) return;

            const response = await fetch(`${this.apiBaseUrl}/users/${this.currentUserId}/categories`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.categories = result.categories || [];
            this.displayCategories(this.categories);
            this.updateCategoryFilter(this.categories);
            
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categoriesList.innerHTML = '<div class="error">Error loading categories</div>';
        }
    }

    async deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/users/${this.currentUserId}/notes/${noteId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Reload notes
            await this.loadNotes();
            
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Error deleting note. Please try again.');
        }
    }

    async editNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        
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
                url: this.noteUrlInput.value.trim(),
                metadata: {
                    title: this.noteTitleInput.value.trim(),
                    url: this.noteUrlInput.value.trim(),
                    domain: this.extractDomain(this.noteUrlInput.value.trim())
                }
            };

            const response = await fetch(`${this.apiBaseUrl}/users/${this.currentUserId}/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.showStatus('saveStatus', 'Note updated successfully!', 'success');
            this.clearForm();
            this.resetSaveButton();
            
            // Reload notes
            await this.loadNotes();
            
        } catch (error) {
            console.error('Error updating note:', error);
            this.showStatus('saveStatus', `Error updating note: ${error.message}`, 'error');
        }
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
                    <button class="btn-secondary" onclick="app.editNote('${note.id}')">Edit</button>
                    <button class="btn-danger" onclick="app.deleteNote('${note.id}')">Delete</button>
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
                <div class="category-definition">${this.escapeHtml(category.definition || '')}</div>
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
        
        if (currentValue) {
            this.categoryFilter.value = currentValue;
        }
    }

    handleSearch(searchTerm) {
        if (!searchTerm.trim()) {
            this.displayNotes(this.notes);
            return;
        }

        const searchTermLower = searchTerm.toLowerCase();
        const filteredNotes = this.notes.filter(note => 
            note.content.toLowerCase().includes(searchTermLower) ||
            note.metadata?.title?.toLowerCase().includes(searchTermLower) ||
            note.metadata?.url?.toLowerCase().includes(searchTermLower) ||
            (note.categories || []).some(cat => cat.toLowerCase().includes(searchTermLower))
        );
        
        this.displayNotes(filteredNotes);
    }

    handleCategoryFilter(category) {
        if (!category) {
            this.displayNotes(this.notes);
            return;
        }

        const filteredNotes = this.notes.filter(note => 
            (note.categories || []).includes(category)
        );
        
        this.displayNotes(filteredNotes);
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

    autoPopulateTitle() {
        const url = this.noteUrlInput.value.trim();
        if (!url || this.noteTitleInput.value.trim()) return;

        try {
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

    showUserStatus(message, type) {
        const userStatus = document.getElementById('userStatus');
        if (!userStatus) return;

        userStatus.textContent = message;
        userStatus.className = `user-status ${type}`;
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        
        // Handle different timestamp formats
        let date;
        if (timestamp._seconds) {
            // Firestore timestamp
            date = new Date(timestamp._seconds * 1000);
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            date = new Date(timestamp);
        }
        
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SimpleApp();
});