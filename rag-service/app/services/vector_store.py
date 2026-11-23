import os
import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
from huggingface_hub import InferenceClient
from app.config import settings


class HFInferenceEmbeddingFunction(EmbeddingFunction[Documents]):
    def __init__(self, api_key: str, model_name: str = "BAAI/bge-base-en-v1.5"):
        self.api_key = api_key
        self.model_name = model_name
        self.client = InferenceClient(model=self.model_name, token=self.api_key or None)

    def _to_flat_vector(self, emb) -> list[float]:
        # Agar token-level embeddings (2D list) aayein toh mean pooling karke 1D vector banao
        if hasattr(emb, "tolist"):
            emb = emb.tolist()
        if isinstance(emb, list) and emb and isinstance(emb[0], list):
            return [sum(col) / len(col) for col in zip(*emb)]
        return [float(x) for x in emb]

    def __call__(self, input: Documents) -> Embeddings:
        vectors: list[list[float]] = []
        for text in input:
            raw_emb = self.client.feature_extraction(text)
            vectors.append(self._to_flat_vector(raw_emb))
        return vectors


class VectorStoreService:
    def __init__(self):
        # ChromaDB ka local persistent client initialize kar rahe hain
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)

        # Collection name constant define kar diya hai
        self.collection_name = "cloudvault_docs"

        # HuggingFace Inference embedding model (BAAI/bge-base-en-v1.5)
        self.embedding_fn = HFInferenceEmbeddingFunction(
            api_key=getattr(settings, "HF_API_KEY", None) or os.getenv("HF_API_KEY", ""),
            model_name="BAAI/bge-base-en-v1.5"
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