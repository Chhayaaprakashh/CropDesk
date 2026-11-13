"""Persistence abstraction. The team's real DB implements CaseRepository; nothing else changes."""
from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field

from app.schemas.v1 import ApprovedAdvisory, AuditEntry, CaseAnalysisResponse, ProposedAdvisory


class CaseRecord(BaseModel):
    analysis: CaseAnalysisResponse
    advisory_versions: list[ProposedAdvisory] = Field(default_factory=list)
    approved: ApprovedAdvisory | None = None  # cleared whenever a new version is created
    audit: list[AuditEntry] = Field(default_factory=list)
    client_request_id: str | None = None


class CaseRepository(ABC):
    @abstractmethod
    def get(self, case_id: str) -> CaseRecord | None: ...

    @abstractmethod
    def save(self, record: CaseRecord) -> None: ...

    @abstractmethod
    def find_by_client_request_id(self, client_request_id: str) -> CaseRecord | None: ...


class InMemoryCaseRepository(CaseRepository):
    """DEVELOPMENT/TEST ONLY. Not durable; not a production store."""

    def __init__(self) -> None:
        self._d: dict[str, CaseRecord] = {}

    def get(self, case_id):
        r = self._d.get(case_id)
        return r.model_copy(deep=True) if r else None

    def save(self, record):
        self._d[record.analysis.case_id] = record.model_copy(deep=True)

    def find_by_client_request_id(self, client_request_id):
        for r in self._d.values():
            if r.client_request_id == client_request_id:
                return r.model_copy(deep=True)
        return None
