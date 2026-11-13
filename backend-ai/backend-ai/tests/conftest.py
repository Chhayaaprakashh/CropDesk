from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.auth import Principal
from app.core.config import Settings
from app.main import create_app
from app.repositories.base import CaseRecord, InMemoryCaseRepository
from app.schemas.enums import CaseStatus, ProcessingStatus, ReviewStatus, Role
from app.schemas.v1 import CaseAnalysisResponse, FarmDetails, ProposedAdvisory, ReferenceCitation

NOW = datetime(2026, 11, 12, tzinfo=timezone.utc)
CID = "case_0123456789ab"


class TestOnlyHeaderAuth:
    """TEST-ONLY auth: reads X-Test-User / X-Test-Role. Never import outside tests."""
    __test__ = False

    def authenticate(self, request):
        u, r = request.headers.get("X-Test-User"), request.headers.get("X-Test-Role")
        return Principal(u, frozenset({Role(r)})) if u and r else None


OFFICER = {"X-Test-User": "officer-1", "X-Test-Role": "extension_officer"}
EXPERT = {"X-Test-User": "expert-1", "X-Test-Role": "expert"}


def make_record(status=CaseStatus.PENDING_REVIEW, citations=True, escalation=False, case_id=CID) -> CaseRecord:
    cit = [ReferenceCitation(reference_id="TEST-REF-1", document_title="TEST FIXTURE ONLY", passage="fixture passage")]
    adv = ProposedAdvisory(version=1, text="Fixture advisory text.", language="en", citations=cit if citations else [])
    a = CaseAnalysisResponse(case_id=case_id, status=status, review_status=ReviewStatus.PENDING,
                             processing_status=ProcessingStatus.COMPLETED,
                             farm=FarmDetails(farmer_id="f_001", crop="tomato"),
                             escalation_required=escalation, proposed_advisory=adv,
                             created_at=NOW, updated_at=NOW)
    return CaseRecord(analysis=a, advisory_versions=[adv])


@pytest.fixture
def repo():
    r = InMemoryCaseRepository()
    r.save(make_record())
    return r


@pytest.fixture
def client(repo):
    app = create_app(Settings(), repo, TestOnlyHeaderAuth())
    return TestClient(app)


@pytest.fixture
def anon_client(repo):  # default (unconfigured) auth provider
    return TestClient(create_app(Settings(), repo))
