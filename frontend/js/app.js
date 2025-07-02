// Main Application - Initializes and coordinates all components
class App {
    constructor() {
        this.db = null;
        this.auth = null;
        this.noteManager = null;
        this.uiComponents = null;
        this.currentUser = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Knowledge Graph Notes App...');
            
            // Initialize Firebase
            await this.initializeFirebase();
            
            // Initialize components
            this.initializeComponents();
            
            // Set up authentication listener
            this.setupAuthListener();
            
            console.log('App initialized successfully');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    async initializeFirebase() {
        try {
            // Wait for Firebase modules to be loaded
            let attempts = 0;
            while (!window.firebaseModules && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.firebaseModules) {
                throw new Error('Firebase modules not loaded');
            }
            
            // Initialize Firebase
            const firebaseInit = await window.initFirebase();
            this.db = firebaseInit.db;
            this.auth = firebaseInit.auth;
            
            console.log('Firebase initialized');
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    }

    initializeComponents() {
        // Initialize Note Manager
        this.noteManager = new window.NoteManager(this.db, this.auth);
        
        // Initialize UI Components
        this.uiComponents = new window.UIComponents(this.noteManager);
        
        // Make UI components globally accessible for inline event handlers
        window.uiComponents = this.uiComponents;
        
        console.log('Components initialized');
    }

    setupAuthListener() {
        // Listen for authentication state changes
        this.auth.onAuthStateChanged((user) => {
            console.log('Auth state changed:', user ? `User ${user.uid}` : 'No user');
            
            this.currentUser = user;
            
            // Update UI based on auth state
            this.uiComponents.setCurrentUser(user);
            
            if (user) {
                console.log('User authenticated:', {
                    uid: user.uid,
                    isAnonymous: user.isAnonymous,
                    email: user.email
                });
                
                // User is signed in
                this.onUserSignedIn(user);
            } else {
                // User is signed out
                this.onUserSignedOut();
            }
        });
    }

    onUserSignedIn(user) {
        console.log('User signed in successfully');
        
        // Any additional setup needed when user signs in
        this.trackUserSession(user);
    }

    onUserSignedOut() {
        console.log('User signed out');
        
        // Clean up any user-specific data
        this.currentUser = null;
    }

    trackUserSession(user) {
        // Track user session for analytics (optional)
        console.log('User session started:', {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
            timestamp: new Date().toISOString()
        });
    }

    showError(message) {
        // Create error display if it doesn't exist
        let errorDiv = document.getElementById('appError');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'appError';
            errorDiv.className = 'app-error';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #f8d7da;
                color: #721c24;
                padding: 15px 20px;
                border: 1px solid #f5c6cb;
                border-radius: 8px;
                z-index: 1000;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(errorDiv);
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }, 5000);
    }

    // Utility methods
    getCurrentUser() {
        return this.currentUser;
    }

    getNoteManager() {
        return this.noteManager;
    }

    getUIComponents() {
        return this.uiComponents;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Handle app errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    if (window.app) {
        window.app.showError('An unexpected error occurred. Please refresh the page.');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.app) {
        window.app.showError('An error occurred while processing your request.');
    }
    
    // Prevent the default browser behavior
    event.preventDefault();
});