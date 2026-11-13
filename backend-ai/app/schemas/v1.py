"""Versioned (v1) request/response models. All models forbid unknown fields."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .enums import (AudioStatus, CaseStatus, EscalationCode, ImageSuitability,
                    ProcessingStatus, ReviewStatus)

CASE_ID_RE = re.compile(r"^case_[0-9a-f]{12}$")
FARMER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
LANG_RE = re.compile(r"^[a-z]{2,3}(-[A-Z]{2})?$")  # e.g. kn, kn-IN, hi

ShortStr = Annotated[str, Field(min_length=1, max_length=200)]
LongStr = Annotated[str, Field(min_length=1, max_length=4000)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class FarmDetails(Strict):
    farmer_id: str
    crop: ShortStr
    variety: str | None = Field(default=None, max_length=200)
    planting_date: date | None = None
    growth_stage: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    recent_weather: str | None = Field(default=None, max_length=500)
    farmer_language: str | None = None  # BCP-47-ish, e.g. "kn"

    @field_validator("farmer_id")
    @classmethod
    def _fid(cls, v: str) -> str:
        if not FARMER_ID_RE.match(v):
            raise ValueError("farmer_id must match ^[A-Za-z0-9_-]{1,64}$")
        return v

    @field_validator("farmer_language")
    @classmethod
    def _lang(cls, v: str | None) -> str | None:
        if v is not None and not LANG_RE.match(v):
            raise ValueError("language must look like 'kn' or 'kn-IN'")
        return v


class ObservedSymptom(Strict):
    description: LongStr
    plant_part: str | None = Field(default=None, max_length=100)
    location_on_plant: str | None = Field(default=None, max_length=200)
    source: str = Field(pattern="^(image|audio|form)$")


class ImageAnalysis(Strict):
    suitability: ImageSuitability
    quality_notes: str | None = Field(default=None, max_length=1000)
    symptoms: list[ObservedSymptom] = Field(default_factory=list, max_length=20)
    model_reported_confidence: float | None = Field(default=None, ge=0, le=1)
    confidence_is_calibrated: bool = False  # never True without independent validation
    limitations: list[str] = Field(default_factory=list, max_length=10)
    detected_embedded_text: str | None = Field(default=None, max_length=2000)  # untrusted


class AudioAnalysis(Strict):
    transcript: str = Field(max_length=8000)
    detected_language: str | None = None
    audio_quality_ok: bool
    crop: str | None = None
    planting_date: date | None = None
    crop_age_days: int | None = Field(default=None, ge=0, le=1500)
    reported_symptoms: list[str] = Field(default_factory=list, max_length=20)
    recent_weather: str | None = Field(default=None, max_length=500)
    practices: list[str] = Field(default_factory=list, max_length=20)
    missing_information: list[str] = Field(default_factory=list, max_length=20)
    ambiguities: list[str] = Field(default_factory=list, max_length=20)


class ReferenceCitation(Strict):
    reference_id: str = Field(min_length=1, max_length=100)
    document_title: ShortStr
    publisher: str | None = Field(default=None, max_length=200)
    version_or_date: str | None = Field(default=None, max_length=100)
    page_or_section: str | None = Field(default=None, max_length=100)
    passage: LongStr


class PossibleCause(Strict):
    cause: ShortStr
    supporting_observations: list[str] = Field(min_length=1, max_length=10)
    citations: list[ReferenceCitation] = Field(min_length=1, max_length=5)  # mandatory


class EscalationReason(Strict):
    code: EscalationCode
    message: Annotated[str, Field(max_length=500)]
    needs_from_farmer: str | None = Field(default=None, max_length=300)


class CaseAnalysisRequest(Strict):
    """Sent as multipart/form-data: `payload` (this JSON) + `image` + optional `audio`."""
    farm: FarmDetails
    client_request_id: str = Field(min_length=8, max_length=64)  # idempotency key


class ProposedAdvisory(Strict):
    version: int = Field(ge=1)
    text: str = Field(min_length=1, max_length=6000)
    language: str
    citations: list[ReferenceCitation] = Field(default_factory=list, max_length=10)
    safety_instructions: list[str] = Field(default_factory=list, max_length=20)
    unverifiable_notes: list[str] = Field(default_factory=list, max_length=10)


class CaseAnalysisResponse(Strict):
    case_id: str
    status: CaseStatus
    review_status: ReviewStatus
    processing_status: ProcessingStatus
    farm: FarmDetails
    image_analysis: ImageAnalysis | None = None
    audio_analysis: AudioAnalysis | None = None
    missing_information: list[str] = Field(default_factory=list, max_length=20)
    conflicting_evidence: list[str] = Field(default_factory=list, max_length=20)
    possible_causes: list[PossibleCause] = Field(default_factory=list, max_length=3)
    escalation_required: bool = False
    escalation_reasons: list[EscalationReason] = Field(default_factory=list)
    proposed_advisory: ProposedAdvisory | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("case_id")
    @classmethod
    def _cid(cls, v: str) -> str:
        if not CASE_ID_RE.match(v):
            raise ValueError("case_id must match ^case_[0-9a-f]{12}$")
        return v


class ApprovalRequest(Strict):
    """Deliberately has NO approved flag and NO reviewer field: identity comes from auth."""
    advisory_version: int = Field(ge=1)
    notes: str | None = Field(default=None, max_length=1000)


class EditAdvisoryRequest(Strict):
    base_version: int = Field(ge=1)
    new_text: str = Field(min_length=1, max_length=6000)
    notes: str | None = Field(default=None, max_length=1000)


class RejectRequest(Strict):
    reason: str = Field(min_length=3, max_length=1000)


class EscalateRequest(Strict):
    reason: str = Field(min_length=3, max_length=1000)


class ApprovedAdvisory(Strict):
    case_id: str
    advisory: ProposedAdvisory
    reviewer_id: str
    approved_at: datetime
    review_notes: str | None = None


class AuditEntry(Strict):
    at: datetime
    actor_id: str
    action: str
    from_status: CaseStatus | None = None
    to_status: CaseStatus | None = None
    advisory_version: int | None = None
    correlation_id: str | None = None
    detail: str | None = Field(default=None, max_length=1000)


class AudioGenerationResponse(Strict):
    case_id: str
    status: AudioStatus
    language: str | None = None
    media_type: str | None = None
    audio_ref: str | None = None  # storage key / URL; never inline bytes
    advisory_version: int | None = None
    error: str | None = None


class ErrorResponse(Strict):
    code: str
    message: str
    correlation_id: str | None = None
    details: list[dict] | None = None
