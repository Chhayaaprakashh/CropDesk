# Requests from Frontend (Person B) to Backend (Person A)

The frontend is built to `INTEGRATION_CONTRACT.md` v1. These gaps block a working end-to-end demo.
Endpoints marked PROPOSED are called in `src/api.js`; the shapes reuse your existing models where possible.

## Must have
1. **Officer queue:** `GET /api/v1/cases` (officer/expert). Return `list[CaseAnalysisResponse]`. No list endpoint exists, so the queue cannot load.
2. **Officer media:** `GET /api/v1/cases/{id}/image` and `/audio` (staff). Return the stored upload bytes with the right content type. The review screen needs the photo and voice note.
3. **Officer auth:** `POST /api/v1/auth/login {username,password} -> {access_token}`, with `Authorization: Bearer` accepted by your `AuthProvider`. Passwords from env, never in the repo.
4. **Farmer access (no staff login):** public routes, because farmers cannot hold a staff credential:
   - `POST /api/v1/public/cases` (multipart, same as `analyze`) -> `{case_id}`
   - `GET /api/v1/public/cases/{id}/status` -> `{case_id, status, language, advisory: ApprovedAdvisory | null, needs_from_farmer: str | null}`. Return `advisory` only when APPROVED. Never expose analysis, citations of rejected cases or reviewer notes.
   - `POST /api/v1/public/cases/{id}/advisory-audio` -> `AudioGenerationResponse`, where `audio_ref` is directly playable by `<audio src>`.
5. **Free-text notes field:** add `farmer_notes: str | None (max 500)` to `FarmDetails`. Person C's injection tests (INJ-01 to 04, 08 to 10) need a free-text input that reaches the model. `recent_weather` is the only one today. The UI sends it only when `VITE_SEND_NOTES=true`.
6. **Single photo:** the UI sends one `image`, as `analyze` accepts.

## Decisions needed
- **ESCALATED is terminal.** The problem statement says an expert resolves escalated cases and the officer then approves or edits. Add `ESCALATED -> PENDING_REVIEW` (contract question 5). Right now the blurry-photo demo case is a dead end.
- **Advisory language.** `ProposedAdvisory` has one `text` and one `language`. Is it English for the officer, then translated for the farmer on approval? Or written in Kannada, so the officer edits text they can't read? The UI shows the language but doesn't translate.
- **Transcript correction** (promised in DESIGN.md) has no endpoint. Skipped for now.

## Small fixes
- Add `audio/x-m4a` to `AUDIO_TYPES` (browsers and phones send it).
- Add `audio/webm;codecs=opus` handling tests (the recorder sends this; your code strips the `;` part, so it should pass).
- Add the dev server origin `http://localhost:5173` to `CORS_ORIGINS` if not using the Vite proxy.
