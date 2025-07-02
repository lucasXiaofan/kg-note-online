import firebase_admin
from firebase_admin import credentials, firestore
import json
from datetime import datetime

cred = credentials.Certificate(r"C:\kg-note\.secrets\kg-note-e7fdd-firebase-adminsdk-fbsvc-c0d3fce41b.json")
firebase_admin.initialize_app(cred)

def upload_knowledge_weaver_data(json_file_path):
    """Upload Knowledge Weaver export data to Firestore"""
    # Initialize Firestore client
    db = firestore.client(database_id="kg-note")
    
    # Read the JSON export file
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Loading {data['metadata']['totalNotes']} notes from export...")
    
    # Upload notes to Firestore
    notes_collection = db.collection('notes')
    
    for note in data['notes']:
        # Convert timestamp to Firestore timestamp if needed
        if 'timestamp' in note:
            note['timestamp'] = datetime.fromtimestamp(note['timestamp'] / 1000)
        
        # Add to Firestore
        doc_ref = notes_collection.document(note['id'])
        doc_ref.set(note)
        print(f"Uploaded note: {note['id']}")
    
    # Upload categories if they exist
    if data['categories']:
        categories_collection = db.collection('categories')
        for i, category in enumerate(data['categories']):
            doc_ref = categories_collection.document(f"category-{i}")
            doc_ref.set(category)
            print(f"Uploaded category: {category}")
    
    # Upload metadata
    metadata_doc = db.collection('metadata').document('export-info')
    metadata_doc.set(data['metadata'])
    print("Uploaded export metadata")
    
    print(f"Successfully uploaded {len(data['notes'])} notes to Firestore")

if __name__ == "__main__":
    json_file_path = r"C:\kg-note\knowledge-weaver-complete-2025-06-30.json"
    upload_knowledge_weaver_data(json_file_path)
