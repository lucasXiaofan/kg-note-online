// Knowledge Graph Notes - All Notes Page
class NotesManager {
    constructor() {
        this.notes = [];
        this.filteredNotes = [];
        this.categories = [];
        this.currentPage = 1;
        this.notesPerPage = 20;
        this.currentView = 'grid';
        this.sortBy = 'date-desc';
        this.filters = {
            search: '',
            dateRange: 'all',
            categories: [],
            domains: [],
            noteTypes: ['text', 'youtube', 'selections']
        };
        
        this.initialize();
    }

    async initialize() {
        this.showLoading();
        
        try {
            await this.loadNotes();
            await this.loadCategories();
            this.setupEventListeners();
            this.renderFilters();
            this.applyFilters();
            this.renderNotes();
            
            // Check if we should open categories modal
            if (window.location.hash === '#categories') {
                setTimeout(() => {
                    this.showCategoryModal();
                }, 500);
            }
        } catch (error) {
            console.error('Error initializing notes manager:', error);
            this.showError('Failed to load notes');
        } finally {
            this.hideLoading();
        }
    }

    async loadNotes() {
        try {
            const response = await this.sendMessage({ type: 'GET_NOTES' });
            if (response && response.success && response.notes) {
                this.notes = response.notes.map(note => ({
                    ...note,
                    domain: this.extractDomain(note.metadata?.url || note.url || ''),
                    type: this.determineNoteType(note),
                    searchableText: this.createSearchableText(note)
                }));
                console.log('Loaded notes:', this.notes.length);
            } else {
                this.notes = [];
                console.warn('No notes received from API');
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            this.notes = [];
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
                    { id: 'reference', name: 'Reference', definition: 'Reference materials and documentation' },
                    { id: 'learning', name: 'Learning', definition: 'Educational content and study notes' }
                ];
                await this.saveCategories();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = [];
        }
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'Unknown';
        }
    }

    determineNoteType(note) {
        const url = note.metadata?.url || note.url || '';
        if (url.includes('youtube.com') || note.metadata?.youtube) {
            return 'youtube';
        }
        if (note.metadata?.selection || (note.content && note.content.length < 200)) {
            return 'selection';
        }
        return 'text';
    }

    createSearchableText(note) {
        const parts = [
            note.content || '',
            note.metadata?.title || '',
            note.metadata?.url || '',
            note.metadata?.domain || '',
            note.category || ''
        ];
        return parts.join(' ').toLowerCase();
    }

    setupEventListeners() {
        // Search
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Date filter
        document.getElementById('date-filter').addEventListener('change', (e) => {
            this.filters.dateRange = e.target.value;
            this.applyFilters();
        });

        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.id.replace('view-', '');
                this.renderNotes();
            });
        });

        // Sort controls
        document.getElementById('sort-by').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.applyFilters();
        });

        // Header actions
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refresh();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportNotes();
        });

        document.getElementById('manage-categories-btn').addEventListener('click', () => {
            this.showCategoryModal();
        });

        // Note type filters
        ['filter-text', 'filter-youtube', 'filter-selections'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.updateNoteTypeFilters();
            });
        });

        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideModal('note-modal');
        });

        document.getElementById('close-category-modal').addEventListener('click', () => {
            this.hideModal('category-modal');
        });

        // Category management
        document.getElementById('add-category').addEventListener('click', () => {
            this.addCategory();
        });

        // Note actions
        document.getElementById('edit-note').addEventListener('click', () => {
            this.editNote();
        });

        document.getElementById('delete-note').addEventListener('click', () => {
            this.deleteNote();
        });

        document.getElementById('categorize-note').addEventListener('click', () => {
            this.categorizeNote();
        });

        // Close modals on background click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });
    }

    renderFilters() {
        this.renderCategoryFilters();
        this.renderDomainFilters();
    }

    renderCategoryFilters() {
        const container = document.getElementById('category-filters');
        container.innerHTML = this.categories.map(category => `
            <label>
                <input type="checkbox" value="${category.id}" ${this.filters.categories.includes(category.id) ? 'checked' : ''}>
                ${category.name}
            </label>
        `).join('');

        container.addEventListener('change', () => {
            this.updateCategoryFilters();
        });
    }

    renderDomainFilters() {
        const domains = [...new Set(this.notes.map(note => note.domain))].sort();
        const container = document.getElementById('domain-filters');
        
        container.innerHTML = domains.slice(0, 10).map(domain => `
            <label>
                <input type="checkbox" value="${domain}" ${this.filters.domains.includes(domain) ? 'checked' : ''}>
                ${domain}
            </label>
        `).join('');

        if (domains.length > 10) {
            container.innerHTML += `<p class="more-domains">+${domains.length - 10} more domains</p>`;
        }

        container.addEventListener('change', () => {
            this.updateDomainFilters();
        });
    }

    updateCategoryFilters() {
        const checkboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
        this.filters.categories = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.applyFilters();
    }

    updateDomainFilters() {
        const checkboxes = document.querySelectorAll('#domain-filters input[type="checkbox"]');
        this.filters.domains = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.applyFilters();
    }

    updateNoteTypeFilters() {
        const types = [];
        if (document.getElementById('filter-text').checked) types.push('text');
        if (document.getElementById('filter-youtube').checked) types.push('youtube');
        if (document.getElementById('filter-selections').checked) types.push('selection');
        
        this.filters.noteTypes = types;
        this.applyFilters();
    }

    applyFilters() {
        let filtered = [...this.notes];

        // Search filter
        if (this.filters.search) {
            filtered = filtered.filter(note => 
                note.searchableText.includes(this.filters.search)
            );
        }

        // Date filter
        if (this.filters.dateRange !== 'all') {
            const now = new Date();
            let cutoffDate;
            
            switch (this.filters.dateRange) {
                case 'today':
                    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }
            
            if (cutoffDate) {
                filtered = filtered.filter(note => {
                    const noteDate = this.parseNoteDate(note.created_at);
                    return noteDate >= cutoffDate;
                });
            }
        }

        // Category filter
        if (this.filters.categories.length > 0) {
            filtered = filtered.filter(note => 
                this.filters.categories.includes(note.category)
            );
        }

        // Domain filter
        if (this.filters.domains.length > 0) {
            filtered = filtered.filter(note => 
                this.filters.domains.includes(note.domain)
            );
        }

        // Note type filter
        if (this.filters.noteTypes.length > 0 && this.filters.noteTypes.length < 3) {
            filtered = filtered.filter(note => 
                this.filters.noteTypes.includes(note.type)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            switch (this.sortBy) {
                case 'date-desc':
                    return this.parseNoteDate(b.created_at) - this.parseNoteDate(a.created_at);
                case 'date-asc':
                    return this.parseNoteDate(a.created_at) - this.parseNoteDate(b.created_at);
                case 'title-asc':
                    return (a.metadata?.title || a.content || '').localeCompare(b.metadata?.title || b.content || '');
                case 'title-desc':
                    return (b.metadata?.title || b.content || '').localeCompare(a.metadata?.title || a.content || '');
                case 'domain-asc':
                    return a.domain.localeCompare(b.domain);
                default:
                    return 0;
            }
        });

        this.filteredNotes = filtered;
        this.currentPage = 1;
        this.renderNotes();
        this.updateNotesCount();
    }

    parseNoteDate(timestamp) {
        if (!timestamp) return new Date(0);
        
        if (timestamp._seconds) {
            return new Date(timestamp._seconds * 1000);
        }
        return new Date(timestamp);
    }

    renderNotes() {
        const container = document.getElementById('notes-container');
        const startIdx = (this.currentPage - 1) * this.notesPerPage;
        const endIdx = startIdx + this.notesPerPage;
        const notesToShow = this.filteredNotes.slice(startIdx, endIdx);

        // Update view class
        container.className = `notes-container ${this.currentView}-view`;

        if (notesToShow.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        container.innerHTML = notesToShow.map(note => this.renderNoteCard(note)).join('');

        // Add click listeners
        container.querySelectorAll('.note-card').forEach((card, index) => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('note-action')) {
                    this.showNoteDetail(notesToShow[startIdx + index]);
                }
            });
        });

        this.renderPagination();
    }

    renderNoteCard(note) {
        const title = note.metadata?.title || this.truncateText(note.content, 50);
        const content = this.truncateText(note.content, 150);
        const date = this.formatDate(note.created_at);
        const category = note.category || 'Uncategorized';
        
        return `
            <div class="note-card" data-note-id="${note.id}">
                ${note.type === 'youtube' ? '<div class="youtube-indicator">📺 YouTube</div>' : ''}
                
                <div class="note-header">
                    <div>
                        <div class="note-title">${this.escapeHtml(title)}</div>
                        <a href="${note.metadata?.url || '#'}" class="note-domain" target="_blank" onclick="event.stopPropagation()">
                            ${note.domain}
                        </a>
                    </div>
                </div>
                
                <div class="note-content">${this.escapeHtml(content)}</div>
                
                <div class="note-footer">
                    <div class="note-date">
                        📅 ${date}
                    </div>
                    <div class="note-actions">
                        <button class="note-action" title="Edit" onclick="event.stopPropagation(); notesApp.editNoteFromCard('${note.id}')">✏️</button>
                        <button class="note-action" title="Categorize" onclick="event.stopPropagation(); notesApp.categorizeNoteFromCard('${note.id}')">🏷️</button>
                        <button class="note-action" title="Delete" onclick="event.stopPropagation(); notesApp.deleteNoteFromCard('${note.id}')">🗑️</button>
                    </div>
                </div>
                
                ${category !== 'Uncategorized' ? `<div class="note-category">${this.escapeHtml(category)}</div>` : ''}
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="empty-state">
                <h3>📭 No notes found</h3>
                <p>No notes match your current filters. Try adjusting your search criteria or create some notes!</p>
                <button class="btn btn-primary" onclick="chrome.tabs.create({url: 'chrome://newtab'})">
                    🌐 Browse the web to create notes
                </button>
            </div>
        `;
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredNotes.length / this.notesPerPage);
        
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;
        
        prevBtn.onclick = () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderNotes();
            }
        };
        
        nextBtn.onclick = () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderNotes();
            }
        };
    }

    updateNotesCount() {
        const total = this.notes.length;
        const filtered = this.filteredNotes.length;
        const countElement = document.getElementById('notes-count');
        
        if (filtered === total) {
            countElement.textContent = `${total} notes`;
        } else {
            countElement.textContent = `${filtered} of ${total} notes`;
        }
    }

    showNoteDetail(note) {
        const modal = document.getElementById('note-modal');
        
        document.getElementById('modal-title').textContent = note.metadata?.title || 'Note Details';
        document.getElementById('note-url').textContent = note.metadata?.url || 'No URL';
        document.getElementById('note-url').href = note.metadata?.url || '#';
        document.getElementById('note-date').textContent = this.formatDate(note.created_at);
        document.getElementById('note-category').textContent = note.category || 'Uncategorized';
        document.getElementById('note-full-content').textContent = note.content;
        
        this.currentNoteId = note.id;
        this.showModal('note-modal');
    }

    showCategoryModal() {
        this.renderCategoryList();
        this.showModal('category-modal');
    }

    renderCategoryList() {
        const container = document.getElementById('category-list');
        container.innerHTML = this.categories.map(category => `
            <div class="category-item">
                <div class="category-info">
                    <h5>${this.escapeHtml(category.name)}</h5>
                    <p>${this.escapeHtml(category.definition || 'No definition')}</p>
                </div>
                <div class="category-actions">
                    <button class="btn btn-danger btn-sm" onclick="notesApp.deleteCategory('${category.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    async addCategory() {
        const name = document.getElementById('category-name').value.trim();
        const definition = document.getElementById('category-definition').value.trim();
        
        if (!name) {
            alert('Please enter a category name');
            return;
        }
        
        const id = name.toLowerCase().replace(/\s+/g, '-');
        const newCategory = { id, name, definition };
        
        this.categories.push(newCategory);
        await this.saveCategories();
        
        document.getElementById('category-name').value = '';
        document.getElementById('category-definition').value = '';
        
        this.renderCategoryList();
        this.renderCategoryFilters();
    }

    async deleteCategory(categoryId) {
        if (confirm('Are you sure you want to delete this category?')) {
            this.categories = this.categories.filter(cat => cat.id !== categoryId);
            await this.saveCategories();
            this.renderCategoryList();
            this.renderCategoryFilters();
        }
    }

    async saveCategories() {
        await this.setStorage({ categories: this.categories });
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    async refresh() {
        this.showLoading();
        await this.loadNotes();
        await this.loadCategories();
        this.renderFilters();
        this.applyFilters();
        this.hideLoading();
    }

    exportNotes() {
        const dataStr = JSON.stringify(this.notes, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `knowledge-notes-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    // Utility methods
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        const date = this.parseNoteDate(timestamp);
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

    // Chrome extension communication
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

    async setStorage(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, resolve);
        });
    }

    // Note action methods (placeholder implementations)
    editNoteFromCard(noteId) {
        console.log('Edit note:', noteId);
        // TODO: Implement note editing
    }

    categorizeNoteFromCard(noteId) {
        console.log('Categorize note:', noteId);
        // TODO: Implement note categorization
    }

    deleteNoteFromCard(noteId) {
        if (confirm('Are you sure you want to delete this note?')) {
            console.log('Delete note:', noteId);
            // TODO: Implement note deletion
        }
    }

    editNote() {
        console.log('Edit current note:', this.currentNoteId);
        // TODO: Implement note editing
    }

    deleteNote() {
        if (confirm('Are you sure you want to delete this note?')) {
            console.log('Delete current note:', this.currentNoteId);
            // TODO: Implement note deletion
        }
    }

    categorizeNote() {
        console.log('Categorize current note:', this.currentNoteId);
        // TODO: Implement note categorization
    }
}

// Initialize the notes manager
const notesApp = new NotesManager();