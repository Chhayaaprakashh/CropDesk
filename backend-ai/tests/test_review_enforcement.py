import pytest

from app.schemas.enums import CaseStatus
from tests.conftest import CID, EXPERT, OFFICER, make_record

A = f"/api/v1/cases/{CID}"


def test_client_cannot_self_approve_with_flags(client):
    for body in ({"advisory_version": 1, "approved": True}, {"advisory_version": 1, "reviewer_id": "me"},
                 {"advisory_version": 1, "status": "APPROVED"}):
        assert client.post(f"{A}/approve", json=body, headers=OFFICER).status_code == 422
    assert client.get(A, headers=OFFICER).json()["status"] == "PENDING_REVIEW"


def test_unauthenticated_and_wrong_role_cannot_approve(client, anon_client):
    assert anon_client.post(f"{A}/approve", json={"advisory_version": 1}).status_code == 401
    assert client.post(f"{A}/approve", json={"advisory_version": 1}).status_code == 401
    assert client.post(f"{A}/approve", json={"advisory_version": 1}, headers=EXPERT).status_code == 403


def test_approval_records_reviewer_from_auth_not_client(client, repo):
    r = client.post(f"{A}/approve", json={"advisory_version": 1, "notes": "ok"}, headers=OFFICER)
    assert r.status_code == 200 and r.json()["reviewer_id"] == "officer-1"
    rec = repo.get(CID)
    assert rec.analysis.status == CaseStatus.APPROVED
    e = rec.audit[-1]
    assert (e.actor_id, e.action, e.advisory_version, e.to_status) == ("officer-1", "approve", 1, CaseStatus.APPROVED)
    assert e.correlation_id


def test_farmer_advisory_blocked_until_approved(client):
    assert client.get(f"{A}/farmer-advisory", headers=OFFICER).status_code == 409
    client.post(f"{A}/approve", json={"advisory_version": 1}, headers=OFFICER)
    assert client.get(f"{A}/farmer-advisory", headers=OFFICER).status_code == 200


def test_stale_version_rejected(client):
    r = client.post(f"{A}/approve", json={"advisory_version": 7}, headers=OFFICER)
    assert r.status_code == 409 and r.json()["code"] == "STALE_ADVISORY_VERSION"


def test_ungrounded_advisory_cannot_be_approved(repo, client):
    repo.save(make_record(citations=False, case_id="case_aaaaaaaaaaaa"))
    r = client.post("/api/v1/cases/case_aaaaaaaaaaaa/approve", json={"advisory_version": 1}, headers=OFFICER)
    assert r.status_code == 409 and r.json()["code"] == "ADVISORY_UNGROUNDED"


def test_case_with_unresolved_escalation_cannot_be_approved(repo, client):
    repo.save(make_record(escalation=True, case_id="case_bbbbbbbbbbbb"))
    r = client.post("/api/v1/cases/case_bbbbbbbbbbbb/approve", json={"advisory_version": 1}, headers=OFFICER)
    assert r.status_code == 409 and r.json()["code"] == "ESCALATION_UNRESOLVED"


@pytest.mark.parametrize("status", [CaseStatus.RECEIVED, CaseStatus.ANALYZING, CaseStatus.REJECTED,
                                    CaseStatus.ESCALATED, CaseStatus.FAILED])
def test_cannot_approve_outside_review_queue(repo, client, status):
    repo.save(make_record(status=status, case_id="case_cccccccccccc"))
    r = client.post("/api/v1/cases/case_cccccccccccc/approve", json={"advisory_version": 1}, headers=OFFICER)
    assert r.status_code == 409 and r.json()["code"] == "INVALID_TRANSITION"


def test_double_approval_rejected(client):
    client.post(f"{A}/approve", json={"advisory_version": 1}, headers=OFFICER)
    assert client.post(f"{A}/approve", json={"advisory_version": 1}, headers=OFFICER).status_code == 409


def test_editing_approved_advisory_creates_new_version_and_voids_approval(client, repo):
    client.post(f"{A}/approve", json={"advisory_version": 1}, headers=OFFICER)
    r = client.post(f"{A}/advisory/edit", json={"base_version": 1, "new_text": "Edited text."}, headers=OFFICER)
    assert r.status_code == 200 and r.json()["version"] == 2
    rec = repo.get(CID)
    assert rec.analysis.status == CaseStatus.PENDING_REVIEW and rec.approved is None
    assert client.get(f"{A}/farmer-advisory", headers=OFFICER).status_code == 409
    assert client.post(f"{A}/approve", json={"advisory_version": 1}, headers=OFFICER).status_code == 409  # stale
    assert client.post(f"{A}/approve", json={"advisory_version": 2}, headers=OFFICER).status_code == 200


def test_reject_and_escalate(client, repo):
    assert client.post(f"{A}/reject", json={"reason": "unsafe dose"}, headers=OFFICER).status_code == 204
    assert repo.get(CID).analysis.status == CaseStatus.REJECTED
    assert client.post(f"{A}/escalate", json={"reason": "needs expert"}, headers=OFFICER).status_code == 409


def test_escalate_records_machine_readable_reason(client, repo):
    assert client.post(f"{A}/escalate", json={"reason": "needs expert"}, headers=OFFICER).status_code == 204
    a = repo.get(CID).analysis
    assert a.status == CaseStatus.ESCALATED and a.escalation_reasons[0].code.value == "OFFICER_REQUESTED"


def test_audio_blocked_before_approval_and_truthful_after(client):
    assert client.post(f"{A}/advisory-audio", headers=OFFICER).status_code == 409
    client.post(f"{A}/approve", json={"advisory_version": 1}, headers=OFFICER)
    r = client.post(f"{A}/advisory-audio", headers=OFFICER)
    assert r.status_code == 200 and r.json()["status"] == "NOT_CONFIGURED" and r.json()["audio_ref"] is None
