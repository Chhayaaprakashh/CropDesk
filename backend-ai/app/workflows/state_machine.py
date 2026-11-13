from __future__ import annotations

from app.core.errors import AppError
from app.schemas.enums import CaseStatus as S

# Single source of truth for legal transitions.
TRANSITIONS: dict[S, frozenset[S]] = {
    S.RECEIVED: frozenset({S.ANALYZING, S.FAILED}),
    S.ANALYZING: frozenset({S.PENDING_REVIEW, S.ESCALATED, S.FAILED}),
    S.PENDING_REVIEW: frozenset({S.APPROVED, S.REJECTED, S.ESCALATED}),
    S.APPROVED: frozenset({S.PENDING_REVIEW}),  # only via a new advisory version (edit)
    S.ESCALATED: frozenset(),   # terminal for now; expert hand-back is an open decision
    S.REJECTED: frozenset(),
    S.FAILED: frozenset(),
}


def assert_transition(current: S, target: S) -> None:
    if target not in TRANSITIONS[current]:
        raise AppError(409, "INVALID_TRANSITION", f"Cannot move case from {current.value} to {target.value}.")
