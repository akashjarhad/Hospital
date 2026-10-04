import os
import json
import logging
import joblib
import numpy as np
from typing import Optional, Dict, Any, List

logger = logging.getLogger("medtransfer.ml")

CURR_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(CURR_DIR, "models")
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


class MLModelManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MLModelManager, cls).__new__(cls)
            cls._instance._anomaly_model = None
            cls._instance._complexity_model = None
            cls._instance._embedding_model = None
            cls._instance._metadata = None
        return cls._instance

    def get_metadata(self) -> Dict[str, Any]:
        meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def get_anomaly_model(self):
        if self._anomaly_model is None:
            model_path = os.path.join(MODELS_DIR, "anomaly_isolation_forest.joblib")
            if not os.path.exists(model_path):
                from .training.train_anomaly_model import train_anomaly_detection_model
                train_anomaly_detection_model()
            if os.path.exists(model_path):
                self._anomaly_model = joblib.load(model_path)
        return self._anomaly_model

    def get_complexity_model(self):
        if self._complexity_model is None:
            model_path = os.path.join(MODELS_DIR, "transfer_complexity_rf.joblib")
            if not os.path.exists(model_path):
                from .training.train_complexity_model import train_transfer_complexity_models
                train_transfer_complexity_models()
            if os.path.exists(model_path):
                self._complexity_model = joblib.load(model_path)
        return self._complexity_model

    def get_embedding_model(self):
        """
        Loads the Hugging Face SentenceTransformer model for dense clinical embeddings,
        vector search, and semantic transfer relevance scoring.
        """
        if self._embedding_model is None:
            try:
                from sentence_transformers import SentenceTransformer
                model_name = os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_EMBEDDING_MODEL)
                self._embedding_model = SentenceTransformer(model_name)
                logger.info(f"Loaded Hugging Face embedding model: {model_name}")
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer ({e}); falling back to lexical heuristics.")
                self._embedding_model = None
        return self._embedding_model

    def encode_text(self, text: str) -> Optional[np.ndarray]:
        """
        Generate a normalized 384-dimensional dense embedding vector for a single text string.
        """
        model = self.get_embedding_model()
        if model is None or not text or not text.strip():
            return None
        try:
            vec = model.encode(text, normalize_embeddings=True)
            return np.asarray(vec, dtype=np.float32)
        except Exception as e:
            logger.warning(f"Embedding encoding failed: {e}")
            return None

    def encode_batch(self, texts: List[str]) -> Optional[np.ndarray]:
        """
        Generate normalized 384-dimensional dense embedding vectors for a batch of text strings.
        """
        model = self.get_embedding_model()
        if model is None or not texts:
            return None
        try:
            vecs = model.encode(texts, normalize_embeddings=True)
            return np.asarray(vecs, dtype=np.float32)
        except Exception as e:
            logger.warning(f"Batch embedding encoding failed: {e}")
            return None

    def compute_similarity(self, text1: str, text2: str) -> float:
        """
        Compute cosine similarity between two clinical text strings using Hugging Face dense embeddings.
        """
        vec1 = self.encode_text(text1)
        vec2 = self.encode_text(text2)
        if vec1 is None or vec2 is None:
            return 0.0
        return float(np.dot(vec1, vec2))


model_manager = MLModelManager()

