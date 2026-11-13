"""Officer review actions. All approval rules live here, in code."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from app.core.auth import Principal
from app.core.errors import AppError
from app.repositories.base import CaseRecord, CaseRepository
from app.schemas.enums import CaseStatus as S, EscalationCode, ReviewStatus
from app.schemas.v1 import (ApprovalRequest, ApprovedAdvisory, AuditEntry, EditAdvisoryRequest,
                            EscalateRequest, EscalationReason, ProposedAdvisory, RejectRequest)
from app.workflows.state_machine import assert_transition


class ReviewService:
    def __init__(self, repo: CaseRepository, clock: Callable[[], datetime] | None = None):
        self.repo = repo
        self.now = clock or (lambda: datetime.now(timezone.utc))

    # -- helpers --
    def _load(self, case_id: str) -> CaseRecord:
        rec = self.repo.get(case_id)
        if rec is None:
            raise AppError(404, "CASE_NOT_FOUND", "Case not found.")
        return rec

    def _current(self, rec: CaseRecord) -> ProposedAdvisory:
        if not rec.advisory_versions:
            raise AppError(409, "NO_ADVISORY", "This case has no proposed advisory.")
        return rec.advisory_versions[-1]

    def _move(self, rec: CaseRecord, target: S, who: Principal, action: str, cid: str | None,
              version: int | None = None, detail: str | None = None) -> None:
        assert_transition(rec.analysis.status, target)
        self._audit(rec, who, action, rec.analysis.status, target, cid, version, detail)
        rec.analysis.status = target
        rec.analysis.updated_at = self.now()

    def _audit(self, rec, who, action, frm, to, cid, version=None, detail=None) -> None:
        rec.audit.append(AuditEntry(at=self.now(), actor_id=who.user_id, action=action, from_status=frm,
                                    to_status=to, advisory_version=version, correlation_id=cid, detail=detail))

    # -- actions --
    def approve(self, case_id: str, req: ApprovalRequest, who: Principal, cid: str | None) -> ApprovedAdvisory:
        rec = self._load(case_id)
        a = rec.analysis
        if a.status != S.PENDING_REVIEW:
            raise AppError(409, "INVALID_TRANSITION", f"Only PENDING_REVIEW cases can be approved (now {a.status.value}).")
        if a.escalation_required:
            raise AppError(409, "ESCALATION_UNRESOLVED", "Case carries unresolved escalation reasons.")
        adv = self._current(rec)
        if req.advisory_version != adv.version:
            raise AppError(409, "STALE_ADVISORY_VERSION", f"Current advisory version is {adv.version}.")
        if not adv.citations:
            raise AppError(409, "ADVISORY_UNGROUNDED", "Advisory has no approved-reference citations.")
        self._move(rec, S.APPROVED, who, "approve", cid, adv.version, req.notes)
        a.review_status = ReviewStatus.APPROVED
        rec.approved = ApprovedAdvisory(case_id=case_id, advisory=adv, reviewer_id=who.user_id,
                                        approved_at=self.now(), review_notes=req.notes)
        self.repo.save(rec)
        return rec.approved

    def edit(self, case_id: str, req: EditAdvisoryRequest, who: Principal, cid: str | None) -> ProposedAdvisory:
        rec = self._load(case_id)
        a = rec.analysis
        if a.status not in (S.PENDING_REVIEW, S.APPROVED):
            raise AppError(409, "INVALID_TRANSITION", f"Cannot edit advisory in {a.status.value}.")
        cur = self._current(rec)
        if req.base_version != cur.version:
            raise AppError(409, "STALE_ADVISORY_VERSION", f"Current advisory version is {cur.version}.")
        new = cur.model_copy(update={"version": cur.version + 1, "text": req.new_text})
        rec.advisory_versions.append(new)
        a.proposed_advisory = new
        if a.status == S.APPROVED:
            self._move(rec, S.PENDING_REVIEW, who, "edit_invalidates_approval", cid, new.version, req.notes)
        else:
            self._audit(rec, who, "edit", S.PENDING_REVIEW, S.PENDING_REVIEW, cid, new.version, req.notes)
        a.review_status = ReviewStatus.PENDING
        rec.approved = None  # prior approval is void until re-reviewed
        self.repo.save(rec)
        return new

    def reject(self, case_id: str, req: RejectRequest, who: Principal, cid: str | None) -> None:
        rec = self._load(case_id)
        self._move(rec, S.REJECTED, who, "reject", cid, detail=req.reason)
        rec.analysis.review_status = ReviewStatus.REJECTED
        rec.approved = None
        self.repo.save(rec)

    def escalate(self, case_id: str, req: EscalateRequest, who: Principal, cid: str | None) -> None:
        rec = self._load(case_id)
        self._move(rec, S.ESCALATED, who, "escalate", cid, detail=req.reason)
        a = rec.analysis
        a.review_status = ReviewStatus.ESCALATED
        a.escalation_required = True
        a.escalation_reasons.append(EscalationReason(code=EscalationCode.OFFICER_REQUESTED, message=req.reason[:500]))
        rec.approved = None
        self.repo.save(rec)

    def farmer_advisory(self, case_id: str) -> ApprovedAdvisory:
        """The ONLY path to farmer-facing text: requires APPROVED state and a live approval record."""
        rec = self._load(case_id)
        if rec.analysis.status != S.APPROVED or rec.approved is None:
            raise AppError(409, "ADVISORY_NOT_APPROVED", "No approved advisory is available for this case.")
        return rec.approved
