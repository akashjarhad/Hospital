from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class SourceReference(BaseModel):
    source_id: str = Field(..., description="Unique source identifier e.g. Encounter/1, Observation/5")
    resource_type: str = Field(..., description="FHIR-oriented resource type")
    date: Optional[str] = Field(None, description="ISO timestamp or date of record")
    fields: List[str] = Field(default_factory=list, description="Specific fields referenced")

class HandoverSections(BaseModel):
    patient_overview: str = Field(..., description="Patient identity and basic demographics")
    transfer_reason: str = Field(..., description="Stated clinical reason for inter-hospital transfer")
    current_diagnosis: str = Field(..., description="Current primary active diagnosis")
    presenting_complaint: Optional[str] = Field(None, description="Chief complaint at time of encounter")
    relevant_history: Optional[str] = Field(None, description="Past medical and surgical history")
    allergies: str = Field(..., description="Known adverse drug and environmental allergies")
    current_medications: List[str] = Field(default_factory=list, description="Currently administered active medications")
    recent_procedures: List[str] = Field(default_factory=list, description="Recent surgical or interventional procedures")
    relevant_labs: List[str] = Field(default_factory=list, description="Recent laboratory diagnostic test results")
    relevant_diagnostic_reports: List[str] = Field(default_factory=list, description="Diagnostic reports and imaging findings")
    pending_investigations: List[str] = Field(default_factory=list, description="Pending lab or imaging investigations")
    critical_information: List[str] = Field(default_factory=list, description="Critical warnings, precautions, or red flags")

class HandoverSummary(BaseModel):
    label: str = Field(..., description="Provider attribution label (e.g. DEMO / Mock)")
    safety_notice: str = Field(..., description="Mandatory clinical safety verification notice")
    sections: HandoverSections
    source_references: List[str] = Field(default_factory=list, description="List of authorized source record IDs")
    model_name: str
    model_version: str

class CriticalInformationItem(BaseModel):
    type: str = Field(..., description="allergy, medication, abnormal_lab, diagnosis, procedure, observation")
    value: str = Field(..., description="Clinical entity value")
    source_record_id: str = Field(..., description="Traceable source record ID")
    date: Optional[str] = Field(None, description="Date of occurrence/diagnosis")
    confidence_descriptor: str = Field("DIRECT_STRUCTURED_RECORD", description="Evidence confidence level")

class CriticalInformationResponse(BaseModel):
    label: str
    safety_notice: str
    items: List[CriticalInformationItem]
    unavailable_message: Optional[str] = None

class RelevanceSuggestion(BaseModel):
    source_id: str
    resource_type: str
    fields: List[str]
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    relevance_tier: str = Field(..., description="HIGH, MEDIUM, LOW")
    suggested_relevant: bool
    reason: str

class RelevanceAnalysisResponse(BaseModel):
    label: str
    safety_notice: str
    suggestions: List[RelevanceSuggestion]

class RAGAnswer(BaseModel):
    answer: str
    evidence_count: int
    sources: List[Dict[str, Any]]
    label: str
    safety_notice: str

class DataQualityIssue(BaseModel):
    issue_type: str = Field(..., description="COMPLETENESS, CONSISTENCY, RECENCY, DUPLICATION, CONFLICT")
    severity: str = Field(..., description="INFO, LOW, MODERATE, HIGH")
    description: str
    source_ids: List[str] = Field(default_factory=list)
    conflict_values: List[str] = Field(default_factory=list)

class DataQualityScoreBreakdown(BaseModel):
    completeness: float
    consistency: float
    recency: float
    duplication: float
    calculation: str

class DataQualityResponse(BaseModel):
    label: str
    safety_notice: str
    score: float
    score_breakdown: DataQualityScoreBreakdown
    issues: List[DataQualityIssue]

class TransferComplexityFactor(BaseModel):
    factor: str
    value: Any
    weight: int
    source_id: str

class TransferComplexityResponse(BaseModel):
    category: str = Field(..., description="LOW, MODERATE, HIGH")
    score: float
    contributing_factors: List[TransferComplexityFactor]
    scoring_note: str
    safety_notice: str
