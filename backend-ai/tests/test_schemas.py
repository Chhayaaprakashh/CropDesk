import pytest
from pydantic import ValidationError

from app.schemas.v1 import (ApprovalRequest, FarmDetails, ImageAnalysis, PossibleCause, ReferenceCitation)
from app.workflows.state_machine import TRANSITIONS
from app.schemas.enums import CaseStatus as S

CIT = ReferenceCitation(reference_id="TEST-REF-1", document_title="TEST", passage="p")


def test_extra_fields_forbidden():
    with pytest.raises(ValidationError):
        ApprovalRequest(advisory_version=1, approved=True)


def test_cause_requires_citation_and_observation():
    with pytest.raises(ValidationError):
        PossibleCause(cause="x", supporting_observations=["a"], citations=[])
    with pytest.raises(ValidationError):
        PossibleCause(cause="x", supporting_observations=[], citations=[CIT])


@pytest.mark.parametrize("fid", ["", "a b", "../x", "x" * 65])
def test_bad_farmer_ids(fid):
    with pytest.raises(ValidationError):
        FarmDetails(farmer_id=fid, crop="tomato")


def test_bad_language_code():
    with pytest.raises(ValidationError):
        FarmDetails(farmer_id="f1", crop="t", farmer_language="Kannada")


def test_confidence_range_and_never_calibrated_by_default():
    with pytest.raises(ValidationError):
        ImageAnalysis(suitability="SUITABLE", model_reported_confidence=1.5)
    assert ImageAnalysis(suitability="SUITABLE").confidence_is_calibrated is False


def test_state_machine_has_no_path_to_approved_except_from_pending_review():
    assert [s for s, t in TRANSITIONS.items() if S.APPROVED in t] == [S.PENDING_REVIEW]
    assert all(not TRANSITIONS[s] for s in (S.REJECTED, S.ESCALATED, S.FAILED))
