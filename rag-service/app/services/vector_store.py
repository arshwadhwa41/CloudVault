import hashlib
import math
import os
import re
import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
from huggingface_hub import InferenceClient
from app.config import settings


class ResilientEmbeddingFunction(EmbeddingFunction[Documents]):
    def __init__(self, api_key: str, model_name: str = "BAAI/bge-base-en-v1.5", dim: int = 384):
        self.api_key = api_key
        self.model_name = model_name
        self.dim = dim
        self.client = InferenceClient(model=self.model_name, token=self.api_key or None)
        self._hf_disabled = False

    def _to_flat_vector(self, emb) -> list[float]:
        if hasattr(emb, "tolist"):
            emb = emb.tolist()
        if isinstance(emb, list) and emb and isinstance(emb[0], list):
            return [sum(col) / len(col) for col in zip(*emb)]
        return [float(x) for x in emb]

    def _local_hash_embedding(self, text: str) -> list[float]:
        """Free fallback embedding (no API credits required)."""
        vec = [0.0] * self.dim
        tokens = re.findall(r"[a-z0-9_]+", (text or "").lower())
        if not tokens:
            return vec

        for tok in tokens:
            h = hashlib.md5(tok.encode("utf-8")).digest()
            idx = int.from_bytes(h[:4], "big") % self.dim
            sign = 1.0 if (h[4] % 2 == 0) else -1.0
            vec[idx] += sign

        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def __call__(self, input: Documents) -> Embeddings:
        vectors: list[list[float]] = []

        # Agar pehle hi 402/billing error aa chuka hai toh seedha free local embedding use karo
        if self._hf_disabled or not self.api_key:
            return [self._local_hash_embedding(text) for text in input]

        try:
            for text in input:
                raw_emb = self.client.feature_extraction(text)
                vectors.append(self._to_flat_vector(raw_emb))
            return vectors
        except Exception as e:
            err_msg = str(e)
            if "402" in err_msg or "Payment Required" in err_msg:
                self._hf_disabled = True
            print(f"Embedding fallback triggered: {err_msg}")
            return [self._local_hash_embedding(text) for text in input]


class VectorStoreService:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self.collection_name = "cloudvault_docs"
        self.embedding_fn = ResilientEmbeddingFunction(
            api_key=getattr(settings, "HF_API_KEY", None) or os.getenv("HF_API_KEY", ""),
            model_name="BAAI/bge-base-en-v1.5",
            dim=384,
        )
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_fn,
        )

    def add_document(self, doc_id: str, text: str, metadata: dict = None):
        self.collection.add(
            documents=[text],
            ids=[doc_id],
            metadatas=[metadata or {}],
        )

    def search(self, query_text: str, n_results: int = 3) -> dict:
        return self.collection.query(
            query_texts=[query_text],
            n_results=n_results,
        )

    def reset_store(self):
        try:
            try:
                self.client.delete_collection(name=self.collection_name)
            except Exception:
                pass

            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_fn,
            )

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


vector_store = VectorStoreService()