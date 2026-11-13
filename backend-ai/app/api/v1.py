from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from pydantic import ValidationError

from app.core.auth import Principal, get_principal, require_roles
from app.core.errors import AppError
from app.schemas.enums import AudioStatus, Role
from app.schemas.v1 import (ApprovalRequest, ApprovedAdvisory, AudioGenerationResponse, CaseAnalysisRequest,
                            CaseAnalysisResponse, EditAdvisoryRequest, EscalateRequest, ErrorResponse,
                            ProposedAdvisory, RejectRequest)
from app.services import uploads
from app.services.review_service import ReviewService

router = APIRouter(prefix="/api/v1")
OFFICER = require_roles(Role.EXTENSION_OFFICER)
ANY_STAFF = require_roles(Role.EXTENSION_OFFICER, Role.EXPERT, Role.SERVICE)
ERR = {c: {"model": ErrorResponse} for c in (400, 401, 403, 404, 409, 413, 415, 422, 501)}


def _svc(request: Request) -> ReviewService:
    return ReviewService(request.app.state.repo)


def _cid(request: Request) -> str:
    return request.state.correlation_id


@router.get("/health")
def health():
    return {"status": "ok", "api_version": "v1"}


@router.get("/capabilities")
def capabilities(request: Request):
    s = request.app.state.settings
    return {
        "api_version": "v1",
        "nexus_configured": s.configured(),
        "nexus_verified": {k: False for k in s.configured()},  # flips only after a live check exists
        "auth_mode": s.auth_mode,
        "supported_languages": None,  # unknown until Nexus docs confirm; null = unverified
        "limits": {"max_image_bytes": s.max_image_bytes, "max_audio_bytes": s.max_audio_bytes,
                   "image_types": ["image/jpeg", "image/png", "image/webp"]},
    }


@router.post("/cases/analyze", response_model=CaseAnalysisResponse, responses=ERR)
async def analyze(request: Request, payload: str = Form(...), image: UploadFile = File(...),
                  audio: UploadFile | None = File(None), _: Principal = Depends(ANY_STAFF)):
    s = request.app.state.settings
    try:
        req = CaseAnalysisRequest.model_validate_json(payload)
    except ValidationError as e:
        raise AppError(422, "VALIDATION_ERROR", "payload is not a valid CaseAnalysisRequest.",
                       [{"loc": [str(x) for x in d["loc"]], "msg": d["msg"]} for d in e.errors()])
    uploads.validate_image(await image.read(), s.max_image_bytes)
    if audio is not None:
        uploads.validate_audio(await audio.read(), audio.content_type, s.max_audio_bytes)
    del req
    # Phase 3/4 wiring point: the analysis workflow plugs in here.
    raise AppError(501, "ANALYSIS_NOT_IMPLEMENTED",
                   "Analysis workflow requires Nexus adapters (Phase 3/4); inputs were validated only.")


@router.get("/cases/{case_id}", response_model=CaseAnalysisResponse, responses=ERR)
def get_case(case_id: str, request: Request, _: Principal = Depends(ANY_STAFF)):
    rec = request.app.state.repo.get(case_id)
    if rec is None:
        raise AppError(404, "CASE_NOT_FOUND", "Case not found.")
    return rec.analysis


@router.post("/cases/{case_id}/approve", response_model=ApprovedAdvisory, responses=ERR)
def approve(case_id: str, body: ApprovalRequest, request: Request, who: Principal = Depends(OFFICER)):
    return _svc(request).approve(case_id, body, who, _cid(request))


@router.post("/cases/{case_id}/advisory/edit", response_model=ProposedAdvisory, responses=ERR)
def edit(case_id: str, body: EditAdvisoryRequest, request: Request, who: Principal = Depends(OFFICER)):
    return _svc(request).edit(case_id, body, who, _cid(request))


@router.post("/cases/{case_id}/reject", status_code=204, responses=ERR)
def reject(case_id: str, body: RejectRequest, request: Request, who: Principal = Depends(OFFICER)):
    _svc(request).reject(case_id, body, who, _cid(request))


@router.post("/cases/{case_id}/escalate", status_code=204, responses=ERR)
def escalate(case_id: str, body: EscalateRequest, request: Request, who: Principal = Depends(OFFICER)):
    _svc(request).escalate(case_id, body, who, _cid(request))


@router.get("/cases/{case_id}/farmer-advisory", response_model=ApprovedAdvisory, responses=ERR)
def farmer_advisory(case_id: str, request: Request, _: Principal = Depends(ANY_STAFF)):
    return _svc(request).farmer_advisory(case_id)


@router.post("/cases/{case_id}/advisory-audio", response_model=AudioGenerationResponse, responses=ERR)
def advisory_audio(case_id: str, request: Request, _: Principal = Depends(ANY_STAFF)):
    approved = _svc(request).farmer_advisory(case_id)  # 409 unless APPROVED
    if not request.app.state.settings.configured()["text_to_speech"]:
        return AudioGenerationResponse(case_id=case_id, status=AudioStatus.NOT_CONFIGURED,
                                       advisory_version=approved.advisory.version,
                                       error="Nexus text-to-speech is not configured; no audio was generated.")
    # Phase 3 wiring point: real Nexus TTS call.
    raise AppError(501, "TTS_NOT_IMPLEMENTED", "Nexus TTS adapter is not implemented yet.")
