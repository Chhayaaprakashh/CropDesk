# CROPDESK Backend/AI — Integration Contract (v1, DRAFT for team sign-off)

Source of truth for shapes: `docs/openapi.json` (generated from the real routes) and `app/schemas/v1.py`.
Fields are not renamed without updating this file, the tests and the OpenAPI spec.

## Base path and conventions
- Base: `/api/v1`. JSON UTF-8. All models reject unknown fields (HTTP 422).
- Every response carries `X-Correlation-ID` (client may send one: 8-64 alphanumeric/hyphen chars).
- IDs: `case_id` = `^case_[0-9a-f]{12}$`; `farmer_id` = `^[A-Za-z0-9_-]{1,64}$`; language = `kn`, `hi`, `kn-IN` style.
- Uploads: image JPEG/PNG/WebP (content-sniffed), default max 8 MB; audio wav/mp3/ogg/mp4/webm/m4a, default max 10 MB (`MAX_IMAGE_MB`, `MAX_AUDIO_MB`).
- Audio output is never inline: `audio_ref` is a storage key/URL.

## Endpoints
| Method & path | Auth | Status today |
|---|---|---|
| GET `/health` | none | implemented |
| GET `/capabilities` | none | implemented (reports *configured*, not *verified*) |
| POST `/cases/analyze` (multipart: `payload` JSON string, `image`, optional `audio`) | any staff | **validates inputs, then 501** until Phase 3/4 |
| GET `/cases/{id}` | any staff | implemented |
| POST `/cases/{id}/approve` body `{advisory_version, notes?}` | extension_officer | implemented |
| POST `/cases/{id}/advisory/edit` body `{base_version, new_text, notes?}` | extension_officer | implemented |
| POST `/cases/{id}/reject` body `{reason}` -> 204 | extension_officer | implemented |
| POST `/cases/{id}/escalate` body `{reason}` -> 204 | extension_officer | implemented |
| GET `/cases/{id}/farmer-advisory` | any staff | implemented; 409 unless APPROVED |
| POST `/cases/{id}/advisory-audio` | any staff | 409 unless APPROVED; `NOT_CONFIGURED` status without Nexus TTS; real TTS Phase 3 |

"Any staff" = roles `extension_officer`, `expert`, `service`. The frontend farmer view must call through a backend using a `service` principal; farmers never call this API directly.

## Error body (all errors)
`{"code": "...", "message": "...", "correlation_id": "...", "details": [{"loc": [...], "msg": "...", "type": "..."}] | null}`
Codes: `VALIDATION_ERROR` 422, `UNAUTHENTICATED`/`AUTH_NOT_CONFIGURED` 401, `FORBIDDEN` 403, `NOT_FOUND`/`CASE_NOT_FOUND` 404,
`INVALID_TRANSITION`/`STALE_ADVISORY_VERSION`/`ESCALATION_UNRESOLVED`/`ADVISORY_UNGROUNDED`/`ADVISORY_NOT_APPROVED`/`NO_ADVISORY` 409,
`FILE_TOO_LARGE` 413, `UNSUPPORTED_IMAGE_TYPE`/`UNSUPPORTED_AUDIO_TYPE` 415, `EMPTY_UPLOAD` 400, `*_NOT_IMPLEMENTED` 501, `INTERNAL_ERROR` 500.
Validation errors never echo submitted values.

## Enumerations
- `CaseStatus`: RECEIVED, ANALYZING, PENDING_REVIEW, APPROVED, ESCALATED, REJECTED, FAILED
- `ReviewStatus`: NOT_REQUIRED, PENDING, APPROVED, REJECTED, ESCALATED
- `ProcessingStatus`: NOT_STARTED, IN_PROGRESS, COMPLETED, FAILED, NOT_CONFIGURED
- `EscalationCode`: see `app/schemas/enums.py` (14 codes, machine-readable for UI messages)
- `AudioStatus`: GENERATED, NOT_APPROVED, UNSUPPORTED_LANGUAGE, NOT_CONFIGURED, FAILED

## Human-review state transitions (enforced in `app/workflows/state_machine.py`)
```
RECEIVED -> ANALYZING | FAILED
ANALYZING -> PENDING_REVIEW | ESCALATED | FAILED
PENDING_REVIEW -> APPROVED | REJECTED | ESCALATED
APPROVED -> PENDING_REVIEW        (only by editing: creates version N+1, voids approval)
ESCALATED, REJECTED, FAILED       terminal for now
```
Rules: approval needs an authenticated `extension_officer`; reviewer identity comes from auth, never the body;
`ApprovalRequest` has no `approved`/`reviewer` field (extra fields -> 422); approval requires the current advisory
version, at least one citation, and no unresolved escalation; every action appends an audit entry
(actor, action, from/to status, advisory version, correlation ID, time).

## Authentication (decision needed from team)
Implement `AuthProvider.authenticate(request) -> Principal | None` (`app/core/auth.py`) for your real mechanism and pass it to
`create_app(settings, repo, auth_provider)`. Default is `UnconfiguredAuthProvider`, which rejects everything with `AUTH_NOT_CONFIGURED`.

## Persistence (decision needed from team)
Implement `CaseRepository` (`get`, `save`, `find_by_client_request_id`) in `app/repositories/base.py`. This module owns case
**logic**; the teammate's DB owns **storage**. One source of truth: the repository. `InMemoryCaseRepository` is dev/test only.
`client_request_id` is the idempotency key for `analyze`.

## Reference ingestion (Phase 4, not yet implemented)
Planned interface: `ReferenceStore.add_passage(reference_id, document_title, publisher, version_or_date, page_or_section, passage, crop, topic)` and
`search(crop, query, k)`. Only operator-run ingestion may write; no request path can modify it.

## Environment variables
See `.env.example`. Nexus variables are placeholders; none are verified.

## Example call
```python
import httpx
h = {"Authorization": "<whatever your AuthProvider expects>"}
r = httpx.post("http://localhost:8000/api/v1/cases/case_0123456789ab/approve",
               json={"advisory_version": 1, "notes": "ok"}, headers=h)
r.raise_for_status(); print(r.json()["reviewer_id"])
```
```bash
curl -X POST localhost:8000/api/v1/cases/case_0123456789ab/approve -H 'Content-Type: application/json' \
  -H "Authorization: ..." -d '{"advisory_version":1}'
```

## Unresolved decisions
1. Auth mechanism and role mapping. 2. Database/owner of audit store and files. 3. Reference corpus (crops, publisher, licence).
4. Languages needed (Kannada confirmed in brief; others?). 5. Whether ESCALATED cases can return to review after expert input.
6. Real Nexus endpoints, models and languages (see `NEXUS_SETUP.md`).
