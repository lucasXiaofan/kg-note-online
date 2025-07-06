/**
 * API Configuration for Chrome Extension
 * Handles switching between local and production API endpoints
 */

class ApiConfig {
    constructor() {
        this.environment = this.getEnvironment();
        this.apiUrl = this.getApiUrl();
    }

    /**
     * Get current environment from storage or default to production
     */
    getEnvironment() {
        // Check localStorage first (for testing)
        const stored = localStorage.getItem('kg-note-environment');
        if (stored && ['local', 'production'].includes(stored)) {
            return stored;
        }
        
        // Default to production for extension
        return 'production';
    }

    /**
     * Get API URL based on environment
     */
    getApiUrl() {
        const urls = {
            local: 'http://localhost:8000',
            production: 'https://updateport-kg-note-185618387669.us-west2.run.app'
        };
        return urls[this.environment];
    }

    /**
     * Switch environment and update API URL
     */
    switchEnvironment(newEnvironment) {
        if (!['local', 'production'].includes(newEnvironment)) {
            throw new Error('Invalid environment. Use "local" or "production".');
        }
        
        this.environment = newEnvironment;
        this.apiUrl = this.getApiUrl();
        
        // Save to localStorage
        localStorage.setItem('kg-note-environment', newEnvironment);
        
        console.log(`🔄 Switched to ${newEnvironment} environment`);
        console.log(`📍 API URL: ${this.apiUrl}`);
        
        return this.apiUrl;
    }

    /**
     * Get current API configuration
     */
    getConfig() {
        return {
            environment: this.environment,
            apiUrl: this.apiUrl,
            endpoints: {
                auth: `${this.apiUrl}/auth`,
                notes: `${this.apiUrl}/notes`,
                categories: `${this.apiUrl}/categories`,
                categorize: `${this.apiUrl}/categorize`,
                health: `${this.apiUrl}/health`
            }
        };
    }

    /**
     * Check if API is reachable
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            const data = await response.json();
            return {
                reachable: true,
                status: data.status,
                environment: this.environment,
                apiUrl: this.apiUrl
            };
        } catch (error) {
            return {
                reachable: false,
                error: error.message,
                environment: this.environment,
                apiUrl: this.apiUrl
            };
        }
    }

    /**
     * Get headers for API requests
     */
    getHeaders(token = null) {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }
}

// Create global instance
const apiConfig = new ApiConfig();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiConfig;
}

// Make available globally
window.apiConfig = apiConfig;

console.log('🔧 API Config loaded:', apiConfig.getConfig());