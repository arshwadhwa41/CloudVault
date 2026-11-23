import os
import chromadb
from chromadb.utils import embedding_functions
from app.config import settings

class VectorStoreService:
    def __init__(self):
        # ChromaDB ka local persistent client initialize kar rahe hain
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        
        # Collection name constant define kar diya hai
        self.collection_name = "cloudvault_docs"
        
        # 100% free local embedding model (Sentence Transformers) load kar rahe hain
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        # CloudVault ke liye collection get ya create kar rahe hain
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_fn
        )

    def add_document(self, doc_id: str, text: str, metadata: dict = None):
        """Document ya chunk ko vector database mein embed karke store karne ke liye"""
        self.collection.add(
            documents=[text],
            ids=[doc_id],
            metadatas=[metadata or {}]
        )

    def search(self, query_text: str, n_results: int = 3) -> dict:
        """User query ke basis par relevant documents search karne ke liye"""
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        return results
    
    def reset_store(self):
        """Purana data/collection poori tarah wipe karke fresh collection ready karta hai."""
        try:
            # 1. Existing collection delete karne ki koshish
            try:
                self.client.delete_collection(name=self.collection_name)
            except Exception:
                pass

            # 2. Fresh collection create/get karo
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_fn
            )

            # 3. Extra safety: agar kisi reason se purane records abhi bhi dikh rahe hon toh delete kar do
            try:
                existing = self.collection.get()
                if existing and existing.get("ids"):
                    self.collection.delete(ids=existing["ids"])
            except Exception:
                pass

            return True
        except Exception as e:
            print(f"Reset error: {str(e)}")
            return False

# Global instance export kar rahe hain taaki routes mein seedha use ho sake
vector_store = VectorStoreService()