// Note Manager - Handles all note-related database operations
class NoteManager {
    constructor(db, auth) {
        this.db = db;
        this.auth = auth;
        this.currentUser = null;
        
        // Firebase Firestore functions
        this.firestoreModules = null;
        this.loadFirestoreModules();
    }

    async loadFirestoreModules() {
        // Dynamically load Firestore functions
        const { 
            collection, 
            doc, 
            addDoc, 
            getDocs, 
            updateDoc, 
            deleteDoc, 
            query, 
            where, 
            orderBy, 
            limit,
            onSnapshot,
            serverTimestamp
        } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        this.firestoreModules = {
            collection,
            doc,
            addDoc,
            getDocs,
            updateDoc,
            deleteDoc,
            query,
            where,
            orderBy,
            limit,
            onSnapshot,
            serverTimestamp
        };
    }

    setCurrentUser(user) {
        this.currentUser = user;
        console.log('Current user set:', user?.uid);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    // Get user's notes collection reference
    getUserNotesCollection() {
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }
        
        const { collection, doc } = this.firestoreModules;
        return collection(this.db, 'users', this.currentUser.uid, 'notes');
    }

    // Get user's categories collection reference
    getUserCategoriesCollection() {
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }
        
        const { collection } = this.firestoreModules;
        return collection(this.db, 'users', this.currentUser.uid, 'categories');
    }

    // Create a new note
    async createNote(noteData) {
        try {
            if (!this.currentUser) {
                throw new Error('User must be authenticated to create notes');
            }

            const { addDoc, serverTimestamp } = this.firestoreModules;
            const notesCollection = this.getUserNotesCollection();
            
            const noteToSave = {
                content: noteData.content || '',
                categories: noteData.categories || [],
                metadata: {
                    title: noteData.metadata?.title || '',
                    url: noteData.metadata?.url || '',
                    domain: noteData.metadata?.domain || '',
                    summary: noteData.metadata?.summary || '',
                    selection: noteData.metadata?.selection || ''
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                userId: this.currentUser.uid
            };

            const docRef = await addDoc(notesCollection, noteToSave);
            console.log('Note created with ID:', docRef.id);
            
            return {
                id: docRef.id,
                ...noteToSave
            };
        } catch (error) {
            console.error('Error creating note:', error);
            throw error;
        }
    }

    // Get all notes for current user
    async getNotes(filters = {}) {
        try {
            if (!this.currentUser) {
                throw new Error('User must be authenticated to get notes');
            }

            const { getDocs, query, where, orderBy, limit } = this.firestoreModules;
            const notesCollection = this.getUserNotesCollection();
            
            let notesQuery = query(notesCollection, orderBy('createdAt', 'desc'));
            
            // Apply filters
            if (filters.category) {
                notesQuery = query(notesCollection, 
                    where('categories', 'array-contains', filters.category),
                    orderBy('createdAt', 'desc')
                );
            }
            
            if (filters.limit) {
                notesQuery = query(notesQuery, limit(filters.limit));
            }

            const querySnapshot = await getDocs(notesQuery);
            const notes = [];
            
            querySnapshot.forEach((doc) => {
                notes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`Retrieved ${notes.length} notes`);
            return notes;
        } catch (error) {
            console.error('Error getting notes:', error);
            throw error;
        }
    }

    // Search notes by content
    async searchNotes(searchTerm) {
        try {
            if (!this.currentUser || !searchTerm) {
                return [];
            }

            const notes = await this.getNotes();
            
            // Client-side search (Firestore doesn't support full-text search natively)
            const searchTermLower = searchTerm.toLowerCase();
            return notes.filter(note => 
                note.content.toLowerCase().includes(searchTermLower) ||
                note.metadata.title?.toLowerCase().includes(searchTermLower) ||
                note.metadata.url?.toLowerCase().includes(searchTermLower) ||
                note.categories.some(cat => cat.toLowerCase().includes(searchTermLower))
            );
        } catch (error) {
            console.error('Error searching notes:', error);
            throw error;
        }
    }

    // Update a note
    async updateNote(noteId, updateData) {
        try {
            if (!this.currentUser) {
                throw new Error('User must be authenticated to update notes');
            }

            const { doc, updateDoc, serverTimestamp } = this.firestoreModules;
            const notesCollection = this.getUserNotesCollection();
            const noteRef = doc(notesCollection, noteId);

            const updatePayload = {
                ...updateData,
                updatedAt: serverTimestamp()
            };

            await updateDoc(noteRef, updatePayload);
            console.log('Note updated:', noteId);
            
            return { id: noteId, ...updatePayload };
        } catch (error) {
            console.error('Error updating note:', error);
            throw error;
        }
    }

    // Delete a note
    async deleteNote(noteId) {
        try {
            if (!this.currentUser) {
                throw new Error('User must be authenticated to delete notes');
            }

            const { doc, deleteDoc } = this.firestoreModules;
            const notesCollection = this.getUserNotesCollection();
            const noteRef = doc(notesCollection, noteId);

            await deleteDoc(noteRef);
            console.log('Note deleted:', noteId);
            
            return true;
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    }

    // Create or update a category
    async saveCategory(categoryData) {
        try {
            if (!this.currentUser) {
                throw new Error('User must be authenticated to save categories');
            }

            const { addDoc, serverTimestamp } = this.firestoreModules;
            const categoriesCollection = this.getUserCategoriesCollection();
            
            const categoryToSave = {
                name: categoryData.name || categoryData.category,
                definition: categoryData.definition || '',
                color: categoryData.color || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                noteCount: 0,
                userId: this.currentUser.uid
            };

            const docRef = await addDoc(categoriesCollection, categoryToSave);
            console.log('Category created with ID:', docRef.id);
            
            return {
                id: docRef.id,
                ...categoryToSave
            };
        } catch (error) {
            console.error('Error saving category:', error);
            throw error;
        }
    }

    // Get all categories for current user
    async getCategories() {
        try {
            if (!this.currentUser) {
                throw new Error('User must be authenticated to get categories');
            }

            const { getDocs, query, orderBy } = this.firestoreModules;
            const categoriesCollection = this.getUserCategoriesCollection();
            
            const categoriesQuery = query(categoriesCollection, orderBy('name'));
            const querySnapshot = await getDocs(categoriesQuery);
            const categories = [];
            
            querySnapshot.forEach((doc) => {
                categories.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`Retrieved ${categories.length} categories`);
            return categories;
        } catch (error) {
            console.error('Error getting categories:', error);
            throw error;
        }
    }

    // Listen to real-time updates for notes
    onNotesUpdate(callback) {
        if (!this.currentUser) {
            console.warn('User not authenticated for real-time updates');
            return null;
        }

        const { onSnapshot, query, orderBy } = this.firestoreModules;
        const notesCollection = this.getUserNotesCollection();
        const notesQuery = query(notesCollection, orderBy('createdAt', 'desc'));

        return onSnapshot(notesQuery, (snapshot) => {
            const notes = [];
            snapshot.forEach((doc) => {
                notes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(notes);
        }, (error) => {
            console.error('Error in notes real-time listener:', error);
        });
    }

    // Listen to real-time updates for categories
    onCategoriesUpdate(callback) {
        if (!this.currentUser) {
            console.warn('User not authenticated for real-time updates');
            return null;
        }

        const { onSnapshot, query, orderBy } = this.firestoreModules;
        const categoriesCollection = this.getUserCategoriesCollection();
        const categoriesQuery = query(categoriesCollection, orderBy('name'));

        return onSnapshot(categoriesQuery, (snapshot) => {
            const categories = [];
            snapshot.forEach((doc) => {
                categories.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(categories);
        }, (error) => {
            console.error('Error in categories real-time listener:', error);
        });
    }
}

// Export for global access
window.NoteManager = NoteManager;