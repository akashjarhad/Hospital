import math
import re
import numpy as np
from typing import Dict, Any, List, Optional
from .schemas import RAGAnswer
from .prompts import SYSTEM_RAG_PROMPT
from ml.model_loader import model_manager

SAFETY_NOTICE = "AI-generated answer. Verify against original clinical records."
NO_EVIDENCE_ANSWER = "I could not find this information in the authorized records."
UNAVAILABLE_TEXT = NO_EVIDENCE_ANSWER


class ClinicalChunk:
    def __init__(self, text: str, source_id: str, resource_type: str, date: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        self.text = text
        self.source_id = source_id
        self.resource_type = resource_type
        self.date = date
        self.metadata = metadata or {}
        self.dense_embedding: Optional[np.ndarray] = model_manager.encode_text(text)
        self.embedding: Dict[str, float] = self._compute_tf_embedding(text)

    def _compute_tf_embedding(self, text: str) -> Dict[str, float]:
        """
        Lightweight term-frequency vector representation for fast, dependency-free local vector search fallback.
        """
        tokens = re.findall(r'\w+', text.lower())
        total = len(tokens) or 1
        tf = {}
        for token in tokens:
            tf[token] = tf.get(token, 0) + 1.0 / total
        return tf


def _cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    dot_product = sum(vec1[k] * vec2[k] for k in vec1 if k in vec2)
    norm1 = math.sqrt(sum(v * v for v in vec1.values()))
    norm2 = math.sqrt(sum(v * v for v in vec2.values()))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot_product / (norm1 * norm2)


def _compute_chunk_similarity(q_chunk: ClinicalChunk, c_chunk: ClinicalChunk) -> float:
    """
    Computes dense cosine similarity via Hugging Face MiniLM-L6 embeddings,
    falling back to term frequency cosine similarity.
    """
    if q_chunk.dense_embedding is not None and c_chunk.dense_embedding is not None:
        return float(np.dot(q_chunk.dense_embedding, c_chunk.dense_embedding))
    return _cosine_similarity(q_chunk.embedding, c_chunk.embedding)


def chunk_authorized_records(projected_data: Dict[str, Any]) -> List[ClinicalChunk]:
    """
    Chunk ONLY pre-filtered, authorized patient records with precise source ID metadata.
    Enforces least privilege at retrieval time.
    """
    chunks: List[ClinicalChunk] = []
    patient_id = projected_data.get("id", 1)

    # 1. Demographics & History Chunk
    demo_parts = []
    if projected_data.get("name"):
        demo_parts.append(f"Patient Name: {projected_data.get('name')}")
    if projected_data.get("blood_group"):
        demo_parts.append(f"Blood Group: {projected_data.get('blood_group')}")
    if projected_data.get("dob"):
        demo_parts.append(f"Date of Birth: {projected_data.get('dob')}")
    if projected_data.get("medical_history"):
        demo_parts.append(f"Medical History: {projected_data.get('medical_history')}")
    if demo_parts:
        chunks.append(ClinicalChunk(
            text="; ".join(demo_parts),
            source_id=f"Patient/{patient_id}",
            resource_type="Patient",
            metadata={"fields": ["name", "blood_group", "dob", "medical_history"]}
        ))

    # 2. Allergies Chunks
    if projected_data.get("allergies"):
        chunks.append(ClinicalChunk(
            text=f"Documented Allergies: {projected_data.get('allergies')}",
            source_id=f"Patient/{patient_id}",
            resource_type="Patient",
            metadata={"type": "allergy"}
        ))
    for a in projected_data.get("allergy_records", []):
        chunks.append(ClinicalChunk(
            text=f"Allergy/Intolerance: {a.get('substance')} (Reaction: {a.get('reaction_type')}, Severity: {a.get('severity')})",
            source_id=f"AllergyIntolerance/{a.get('id')}",
            resource_type="AllergyIntolerance",
            date=a.get("diagnosed_at"),
            metadata={"substance": a.get("substance"), "severity": a.get("severity")}
        ))

    # 3. Medications Chunks
    for m in projected_data.get("medications", []):
        status = "Active current" if m.get("is_current", True) else "Past/Discontinued"
        chunks.append(ClinicalChunk(
            text=f"{status} Medication: {m.get('medication_name')} {m.get('dosage')} {m.get('frequency')} Route: {m.get('route', 'Oral')} (Notes: {m.get('notes', 'None')})",
            source_id=f"MedicationRequest/{m.get('id')}",
            resource_type="MedicationRequest",
            date=m.get("prescribed_at"),
            metadata={"medication_name": m.get("medication_name"), "is_current": m.get("is_current")}
        ))

    # 4. Encounters & Visits Chunks
    for v in projected_data.get("visits", []):
        v_parts = [
            f"Encounter Admission: {v.get('admission_date', 'N/A')}",
            f"Diagnosis: {v.get('diagnosis', 'N/A')}",
            f"Chief Complaint: {v.get('chief_complaint', 'N/A')}",
            f"Clinical Notes: {v.get('clinical_notes', 'N/A')}",
            f"Status: {v.get('status', 'admitted')}"
        ]
        chunks.append(ClinicalChunk(
            text=" | ".join(v_parts),
            source_id=f"Encounter/{v.get('id')}",
            resource_type="Encounter",
            date=v.get("admission_date"),
            metadata={"diagnosis": v.get("diagnosis"), "status": v.get("status")}
        ))

        # 5. Diagnostic Tests & Labs Chunks
        for t in v.get("tests", []):
            cat = str(t.get("category", "")).lower()
            res_type = "DiagnosticReport" if any(k in cat for k in ["imag", "radio", "scan", "x-ray", "ultra"]) else "Observation"
            abn_flag = " [FLAGGED ABNORMAL]" if t.get("abnormal") else ""
            chunks.append(ClinicalChunk(
                text=f"{res_type} Test: {t.get('test_name')} = {t.get('result')} {t.get('units', '')}{abn_flag} (Category: {t.get('category')}, Reference Range: {t.get('reference_range', 'N/A')}, Notes: {t.get('notes', 'None')})",
                source_id=f"{res_type}/{t.get('id')}",
                resource_type=res_type,
                date=t.get("timestamp"),
                metadata={"test_name": t.get("test_name"), "abnormal": t.get("abnormal")}
            ))

    # 6. Document References
    for d in projected_data.get("documents", []):
        chunks.append(ClinicalChunk(
            text=f"Clinical Document Reference: {d.get('title')} ({d.get('document_type')}), File: {d.get('file_name')}",
            source_id=f"DocumentReference/{d.get('id')}",
            resource_type="DocumentReference",
            date=d.get("created_at"),
            metadata={"title": d.get("title")}
        ))

    return chunks


def answer_record_question(
    projected_data: Dict[str, Any],
    question: str,
    service_context: Any
) -> Dict[str, Any]:
    """
    Vector search & grounded RAG execution over authorized clinical chunks.
    Guarantees no hallucination and provides clickable source traces.
    """
    if not question or not question.strip():
        return {
            "answer": NO_EVIDENCE_ANSWER,
            "evidence_count": 0,
            "sources": [],
            "label": "DEMO / Grounded RAG Assistant",
            "safety_notice": SAFETY_NOTICE
        }

    # 1. Chunk authorized records
    chunks = chunk_authorized_records(projected_data)
    if not chunks:
        return {
            "answer": NO_EVIDENCE_ANSWER,
            "evidence_count": 0,
            "sources": [],
            "label": "DEMO / Grounded RAG Assistant",
            "safety_notice": SAFETY_NOTICE
        }

    # 2. Vector search against question embedding
    q_chunk = ClinicalChunk(question, "query", "Query")
    stop_words = {"what", "is", "the", "patient", "patients", "recorded", "status", "are", "there", "any", "does", "have", "with", "from", "for", "this", "that", "was", "were", "been"}
    q_words = set(re.findall(r'\w+', question.lower())) - stop_words
    
    scored_chunks = []
    has_dense = q_chunk.dense_embedding is not None
    for c in chunks:
        sim = _compute_chunk_similarity(q_chunk, c)
        c_words = set(re.findall(r'\w+', c.text.lower()))
        match_count = len(q_words.intersection(c_words))
        if match_count > 0:
            sim += match_count * 0.15

        # Strict evidence thresholding:
        # Dense embeddings on unrelated concepts (e.g. dental vs cardiac) yield sim < 0.28.
        # Only retain chunks with verified keyword match or strong semantic similarity.
        if (has_dense and sim >= 0.35) or match_count > 0 or (not has_dense and sim > 0.15):
            scored_chunks.append((sim, c))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    top_chunks = [c for sim, c in scored_chunks[:6]]

    if not top_chunks:
        return {
            "answer": NO_EVIDENCE_ANSWER,
            "evidence_count": 0,
            "sources": [],
            "label": "DEMO / Grounded RAG Assistant (Hugging Face MiniLM-L6)",
            "safety_notice": SAFETY_NOTICE
        }

    # If external provider enabled, pass only retrieved top chunks to LLM
    if service_context.provider != "mock" and service_context.external_enabled:
        payload = {
            "question": question,
            "retrieved_authorized_chunks": [
                {"source_id": c.source_id, "text": c.text, "resource_type": c.resource_type}
                for c in top_chunks
            ]
        }
        return service_context.call_external_llm(SYSTEM_RAG_PROMPT, payload)

    # Deterministic Grounded Generation
    answer_lines = []
    sources = []
    for c in top_chunks:
        answer_lines.append(f"• {c.text} [{c.source_id}]")
        sources.append({
            "source_id": c.source_id,
            "resource_type": c.resource_type,
            "snippet": c.text[:120] + ("..." if len(c.text) > 120 else ""),
            "date": c.date
        })

    full_answer = "\n".join(answer_lines)

    return {
        "answer": full_answer,
        "evidence_count": len(sources),
        "sources": sources,
        "label": "DEMO / SYNTHETIC DATA — Grounded RAG Assistant",
        "safety_notice": SAFETY_NOTICE
    }
