// Firebase Configuration
// Using your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBvQiTtE_B9YBDlZPBGPbTVrJqhOqhGXSg", // You'll need to get this from Firebase Console
    authDomain: "kg-note-e7fdd.firebaseapp.com",
    projectId: "kg-note-e7fdd",
    storageBucket: "kg-note-e7fdd.appspot.com",
    messagingSenderId: "112056484565272089814",
    appId: "1:112056484565272089814:web:your-app-id" // You'll need to get this from Firebase Console
};

// Initialize Firebase
let app, db, auth;

async function initFirebase() {
    try {
        const { initializeApp, getFirestore, getAuth } = window.firebaseModules;
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        console.log('Firebase initialized successfully');
        return { app, db, auth };
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        throw error;
    }
}

// Export for global access
window.initFirebase = initFirebase;