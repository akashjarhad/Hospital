import os
import json
import logging
from typing import Dict, Any, Optional, List
from .schemas import (
    HandoverSummary,
    CriticalInformationResponse,
    RelevanceAnalysisResponse,
    RAGAnswer
)
from .prompts import (
    SYSTEM_HANDOVER_PROMPT,
    SYSTEM_CRITICAL_EXTRACTION_PROMPT,
    SYSTEM_RAG_PROMPT,
    SYSTEM_RELEVANCE_PROMPT
)

logger = logging.getLogger("medtransfer.ai_service")

MOCK_MODEL = "medtransfer-grounded-mock-py"
MOCK_VERSION = "2.0.0"
MOCK_LABEL = "DEMO / SYNTHETIC DATA — deterministic mock output generated only from authorized records."
SAFETY_NOTICE = "Decision-support draft only. A qualified clinician must verify accuracy. This output does not diagnose, prescribe, or make a final clinical or transfer decision."
UNAVAILABLE_TEXT = "Not available in authorized records."


class AIProviderError(Exception):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


class AIService:
    """
    Unified AI Service Layer with pluggable provider architecture (Mock vs External LLM).
    Ensures complete source traceability and safety boundaries.
    """

    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "mock").lower()
        self.model_name = os.getenv("AI_MODEL", MOCK_MODEL if self.provider == "mock" else "gpt-4o-mini")
        self.model_version = os.getenv("AI_MODEL_VERSION", MOCK_VERSION)
        self.api_key = os.getenv("AI_API_KEY", "")
        self.base_url = os.getenv("AI_BASE_URL", "https://api.openai.com/v1")
        self.external_enabled = os.getenv("AI_EXTERNAL_ENABLED", "false").lower() == "true"

    def generate_handover(self, projected_data: Dict[str, Any], transfer_meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate structured clinical handover draft from authorized patient data.
        """
        from .handover_service import generate_clinical_handover
        return generate_clinical_handover(projected_data, transfer_meta, self)

    def extract_critical_information(self, projected_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract allergies, current medications, abnormal labs, and critical diagnoses.
        """
        from .extraction_service import extract_critical_entities
        return extract_critical_entities(projected_data, self)

    def answer_patient_question(self, projected_data: Dict[str, Any], question: str) -> Dict[str, Any]:
        """
        Execute grounded RAG search over authorized record chunks.
        """
        from .rag_service import answer_record_question
        return answer_record_question(projected_data, question, self)

    def analyze_record_relevance(self, projected_data: Dict[str, Any], transfer_reason: str) -> Dict[str, Any]:
        """
        Compute semantic relevance scores and explanations for transfer package selection.
        """
        from .relevance_service import compute_record_relevance
        return compute_record_relevance(projected_data, transfer_reason, self)

    def call_external_llm(self, system_prompt: str, user_content: Dict[str, Any]) -> Dict[str, Any]:
        """
        Secure call to external LLM provider if enabled and configured.
        """
        if not self.external_enabled:
            raise AIProviderError("External AI processing is disabled in environment configuration.", 403)
        if not self.api_key:
            raise AIProviderError("AI_API_KEY is not configured for external provider.", 500)

        import urllib.request
        import urllib.error

        url = f"{self.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "model": self.model_name,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_content)}
            ],
            "temperature": 0.1
        }

        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=12) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                content = result["choices"][0]["message"]["content"]
                return json.loads(content)
        except urllib.error.HTTPError as e:
            logger.error(f"External AI HTTP error: {e.code} - {e.reason}")
            raise AIProviderError(f"External AI provider returned status {e.code}", 502)
        except Exception as e:
            logger.error(f"External AI processing exception: {str(e)}")
            raise AIProviderError(f"External AI provider error: {str(e)}", 500)


ai_service_instance = AIService()
