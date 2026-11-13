# CropDesk Frontend (React + Vite)

## Run
```bash
npm install
cp .env.example .env      # VITE_USE_MOCK=true works with no backend
npm run dev               # http://localhost:5173
```
Set `VITE_USE_MOCK=false` to call the FastAPI backend (proxied from `/api` to `localhost:8000`, see `vite.config.js`).
The browser never sees the Nexus key. Only the backend calls Nexus.

## Pages
| Route | Who | Purpose |
|---|---|---|
| `/` | Farmer | Intake: photos, voice note (record/upload), farm form |
| `/advisory/:id` | Farmer | Status, then approved advisory as text + audio |
| `/officer` | Officer | Case queue (escalated first) |
| `/officer/:id` | Officer | Case card, approve / edit / request photo / reject |

## API contract (agree this with the backend owner)
| Method + path | Body | Returns |
|---|---|---|
| `POST /api/cases` | multipart: `images` (1-3 jpg/png), `audio` (optional), `form` (JSON string: farmer_name, district, language, days_since_planting, growth_stage, notes, crop) | `{ "case_id": "C-0001" }` |
| `GET /api/cases` | | `[{case_id, status, created_at, crop, district, escalation_required}]` |
| `GET /api/cases/{id}` | | case card per DESIGN.md section 5, plus `created_at`, `image_urls[]`, `audio_url`, and `advisory: {draft_text:{en,kn}, safety_text:{en,kn}, citations[]}` |
| `POST /api/cases/{id}/review` | `{ action: "approve"\|"edit"\|"reject"\|"request_photo", edited_text_en?, note? }` | `{ ok, status }` |
| `GET /api/cases/{id}/advisory` | | `{ status, language, text:{en,kn}\|null, safety_text:{en,kn}, audio_url, officer_note }` |

Statuses: `needs_expert, pending_review, approved, edited, sent, rejected, photo_requested`.
Errors: non-2xx with `{ "detail": "message" }` (FastAPI default); the UI shows `detail`.

## Rules the UI enforces
- Safety text is shown read-only and cannot be edited or removed.
- Nothing is sent to the farmer until the officer approves (the farmer page only shows text when status is `sent`).
- Reject and request-photo require a note.
- Upload validation: JPG/PNG up to 8 MB, audio up to 10 MB.
