// Enhanced App with Google OAuth Authentication
class AuthApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8000';
        this.currentUser = null;
        this.accessToken = null;
        this.notes = [];
        this.categories = [];
        
        // Google OAuth configuration
        this.googleClientId = '185618387669-6sjnqp7r3tfghjemo1q0eniktd8hjhlc.apps.googleusercontent.com'; // Replace with actual client ID
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeGoogleAuth();
        this.checkExistingAuth();
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
        
        // Auth elements
        this.createAuthSection();
        this.createUserInfoSection();
    }

    createAuthSection() {
        const authSection = document.createElement('section');
        authSection.id = 'authSection';
        authSection.className = 'auth-section';
        authSection.innerHTML = `
            <h2>Welcome to Knowledge Graph Notes</h2>
            <p>Please sign in to start taking notes and sync across devices</p>
            <div class="auth-buttons">
                <div id="googleSignInButton"></div>
                <button id="anonymousSignIn" class="btn-secondary">
                    Continue as Guest
                </button>
            </div>
            <div id="authStatus" class="status-message"></div>
        `;
        
        // Insert after header
        const header = document.querySelector('header');
        header.insertAdjacentElement('afterend', authSection);
        
        // Hide main sections initially
        this.hideMainSections();
    }

    createUserInfoSection() {
        const header = document.querySelector('header');
        const userInfo = document.createElement('div');
        userInfo.id = 'userInfo';
        userInfo.className = 'user-info';
        userInfo.style.display = 'none';
        header.appendChild(userInfo);
    }

    hideMainSections() {
        const mainSections = document.querySelectorAll('main section');
        mainSections.forEach(section => {
            section.style.display = 'none';
        });
    }

    showMainSections() {
        const mainSections = document.querySelectorAll('main section');
        mainSections.forEach(section => {
            section.style.display = 'block';
        });
        
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
    }

    async initializeGoogleAuth() {
        try {
            // Load Google Identity Services
            await this.loadGoogleIdentityScript();
            
            // Initialize Google Sign-In
            window.google.accounts.id.initialize({
                client_id: this.googleClientId,
                callback: (response) => this.handleGoogleSignIn(response),
                auto_select: false,
                cancel_on_tap_outside: false
            });

            // Render the sign-in button
            window.google.accounts.id.renderButton(
                document.getElementById('googleSignInButton'),
                {
                    theme: 'outline',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left'
                }
            );

        } catch (error) {
            console.error('Failed to initialize Google Auth:', error);
            this.showAuthStatus('Google Sign-In unavailable. Please use guest mode.', 'error');
        }
    }

    loadGoogleIdentityScript() {
        return new Promise((resolve, reject) => {
            if (window.google) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async handleGoogleSignIn(response) {
        try {
            this.showAuthStatus('Signing in with Google...', 'loading');

            const loginResponse = await fetch(`${this.apiBaseUrl}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_token: response.credential
                })
            });

            if (!loginResponse.ok) {
                throw new Error(`HTTP error! status: ${loginResponse.status}`);
            }

            const authData = await loginResponse.json();
            
            // Store authentication data
            this.accessToken = authData.access_token;
            this.currentUser = {
                user_id: authData.user_id,
                email: authData.email,
                name: authData.name,
                is_anonymous: false
            };

            // Store in localStorage for persistence
            localStorage.setItem('accessToken', this.accessToken);
            localStorage.setItem('user', JSON.stringify(this.currentUser));

            this.showAuthStatus('Successfully signed in!', 'success');
            this.onAuthSuccess();

        } catch (error) {
            console.error('Google sign in failed:', error);
            this.showAuthStatus(`Sign in failed: ${error.message}`, 'error');
        }
    }

    async handleAnonymousSignIn() {
        try {
            this.showAuthStatus('Creating guest session...', 'loading');
            
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
            
            // For anonymous users, we'll use a simple session without JWT
            this.currentUser = {
                user_id: result.userId,
                email: 'guest@example.com',
                name: 'Guest User',
                is_anonymous: true
            };

            // Store anonymous session
            localStorage.setItem('anonymousUserId', result.userId);
            localStorage.setItem('user', JSON.stringify(this.currentUser));

            this.showAuthStatus('Guest session created!', 'success');
            this.onAuthSuccess();
            
        } catch (error) {
            console.error('Anonymous sign in failed:', error);
            this.showAuthStatus(`Failed to create session: ${error.message}`, 'error');
        }
    }

    checkExistingAuth() {
        const storedToken = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user');
        const anonymousUserId = localStorage.getItem('anonymousUserId');

        if (storedToken && storedUser) {
            // Check if token is still valid
            this.verifyToken(storedToken).then(isValid => {
                if (isValid) {
                    this.accessToken = storedToken;
                    this.currentUser = JSON.parse(storedUser);
                    this.onAuthSuccess();
                } else {
                    this.clearAuth();
                }
            });
        } else if (anonymousUserId && storedUser) {
            this.currentUser = JSON.parse(storedUser);
            if (this.currentUser.is_anonymous) {
                this.onAuthSuccess();
            } else {
                this.clearAuth();
            }
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    onAuthSuccess() {
        this.updateUserInfo();
        this.showMainSections();
        this.loadUserData();
    }

    updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        const displayName = this.currentUser.is_anonymous ? 
            'Guest User' : 
            this.currentUser.name;
        const email = this.currentUser.is_anonymous ? 
            '' : 
            this.currentUser.email;

        userInfo.innerHTML = `
            <div class="user-details">
                <span class="user-name">${displayName}</span>
                ${email ? `<span class="user-email">${email}</span>` : ''}
            </div>
            <button id="signOut" class="btn-secondary">Sign Out</button>
        `;

        document.getElementById('signOut').addEventListener('click', () => {
            this.handleSignOut();
        });
    }

    handleSignOut() {
        // Clear authentication
        this.clearAuth();
        
        // Google sign out
        if (window.google && !this.currentUser?.is_anonymous) {
            window.google.accounts.id.disableAutoSelect();
        }
        
        // Reset UI
        this.currentUser = null;
        this.accessToken = null;
        this.notes = [];
        this.categories = [];
        
        // Show auth section
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('userInfo').style.display = 'none';
        this.hideMainSections();
        
        this.showAuthStatus('Signed out successfully', 'success');
    }

    clearAuth() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        localStorage.removeItem('anonymousUserId');
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

        // Anonymous sign in button
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'anonymousSignIn') {
                this.handleAnonymousSignIn();
            }
        });
    }

    getAuthHeaders() {
        if (this.accessToken) {
            return {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            };
        } else {
            return {
                'Content-Type': 'application/json'
            };
        }
    }

    async loadUserData() {
        try {
            await Promise.all([
                this.loadNotes(),
                this.loadCategories()
            ]);
        } catch (error) {
            console.error('Error loading user data:', error);
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
            
            const noteData = {
                content: content,
                url: this.noteUrlInput.value.trim(),
                metadata: {
                    title: this.noteTitleInput.value.trim(),
                    url: this.noteUrlInput.value.trim(),
                    domain: this.extractDomain(this.noteUrlInput.value.trim())
                }
            };

            const endpoint = this.currentUser.is_anonymous ? 
                `${this.apiBaseUrl}/users/${this.currentUser.user_id}/notes` :
                `${this.apiBaseUrl}/notes`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(noteData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            this.showStatus('saveStatus', 'Note saved successfully!', 'success');
            this.clearForm();
            
            // Reload notes
            await this.loadNotes();
            
        } catch (error) {
            console.error('Error saving note:', error);
            this.showStatus('saveStatus', `Error saving note: ${error.message}`, 'error');
        }
    }

    async loadNotes() {
        try {
            if (!this.currentUser) return;

            const endpoint = this.currentUser.is_anonymous ? 
                `${this.apiBaseUrl}/users/${this.currentUser.user_id}/notes` :
                `${this.apiBaseUrl}/notes`;

            const response = await fetch(endpoint, {
                headers: this.getAuthHeaders()
            });
            
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
            if (!this.currentUser) return;

            const endpoint = this.currentUser.is_anonymous ? 
                `${this.apiBaseUrl}/users/${this.currentUser.user_id}/categories` :
                `${this.apiBaseUrl}/categories`;

            const response = await fetch(endpoint, {
                headers: this.getAuthHeaders()
            });
            
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
            const endpoint = this.currentUser.is_anonymous ? 
                `${this.apiBaseUrl}/users/${this.currentUser.user_id}/notes/${noteId}` :
                `${this.apiBaseUrl}/notes/${noteId}`;

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

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
            
            this.saveNoteBtn.textContent = 'Update Note';
            this.saveNoteBtn.onclick = () => this.handleUpdateNote(noteId);
            
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

            const endpoint = this.currentUser.is_anonymous ? 
                `${this.apiBaseUrl}/users/${this.currentUser.user_id}/notes/${noteId}` :
                `${this.apiBaseUrl}/notes/${noteId}`;

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.showStatus('saveStatus', 'Note updated successfully!', 'success');
            this.clearForm();
            this.resetSaveButton();
            
            await this.loadNotes();
            
        } catch (error) {
            console.error('Error updating note:', error);
            this.showStatus('saveStatus', `Error updating note: ${error.message}`, 'error');
        }
    }

    // UI Helper Methods (same as simple-app.js)
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

    showAuthStatus(message, type) {
        const authStatus = document.getElementById('authStatus');
        if (!authStatus) return;

        authStatus.textContent = message;
        authStatus.className = `status-message ${type}`;
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
    window.app = new AuthApp();
});