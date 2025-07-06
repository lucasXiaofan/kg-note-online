/**
 * API Client for Chrome Extension
 * Provides methods for interacting with the API
 */

class ApiClient {
    constructor() {
        this.config = window.apiConfig || new ApiConfig();
        this.token = null;
        this.loadToken();
    }

    /**
     * Load token from storage
     */
    loadToken() {
        const stored = localStorage.getItem('kg-note-token');
        if (stored) {
            this.token = stored;
        }
    }

    /**
     * Save token to storage
     */
    saveToken(token) {
        this.token = token;
        localStorage.setItem('kg-note-token', token);
    }

    /**
     * Clear token from storage
     */
    clearToken() {
        this.token = null;
        localStorage.removeItem('kg-note-token');
    }

    /**
     * Make API request with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.config.apiUrl}${endpoint}`;
        const headers = this.config.getHeaders(this.token);

        const requestOptions = {
            headers,
            ...options
        };

        try {
            console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
            
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ API Response: ${response.status}`, data);
            return data;

        } catch (error) {
            console.error(`❌ API Error: ${error.message}`);
            
            // Handle authentication errors
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                this.clearToken();
                throw new Error('Authentication required. Please log in again.');
            }
            
            throw error;
        }
    }

    /**
     * Authentication methods
     */
    async login(credentials) {
        const response = await this.request('/auth/chrome-extension', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        this.saveToken(response.access_token);
        return response;
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    /**
     * Notes methods
     */
    async createNote(noteData) {
        return this.request('/notes', {
            method: 'POST',
            body: JSON.stringify(noteData)
        });
    }

    async getNotes(limit = 50) {
        return this.request(`/notes?limit=${limit}`);
    }

    async updateNote(noteId, noteData) {
        return this.request(`/notes/${noteId}`, {
            method: 'PUT',
            body: JSON.stringify(noteData)
        });
    }

    async deleteNote(noteId) {
        return this.request(`/notes/${noteId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Categories methods
     */
    async getCategories() {
        return this.request('/categories');
    }

    async createCategory(categoryData) {
        return this.request('/categories', {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    }

    async updateCategory(categoryId, categoryData) {
        return this.request(`/categories/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify(categoryData)
        });
    }

    async deleteCategory(categoryId) {
        return this.request(`/categories/${categoryId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Categorization methods
     */
    async categorizeNote(noteData) {
        return this.request('/categorize', {
            method: 'POST',
            body: JSON.stringify(noteData)
        });
    }

    /**
     * Health check
     */
    async checkHealth() {
        return this.request('/health');
    }

    /**
     * Switch API environment
     */
    switchEnvironment(environment) {
        this.config.switchEnvironment(environment);
        // Clear token when switching environments
        this.clearToken();
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return this.config.getConfig();
    }
}

// Create global instance
const apiClient = new ApiClient();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}

// Make available globally
window.apiClient = apiClient;

console.log('🔌 API Client loaded:', apiClient.getConfig());