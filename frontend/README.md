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
| `/login` | Officer | Sign-in |
| `/officer` | Officer | Case queue (escalated first) |
| `/officer/:id` | Officer | Case card, approve / edit / escalate / reject |

## API contract
Built to the backend's `INTEGRATION_CONTRACT.md` (v1, base `/api/v1`). Gaps and proposed endpoints are listed in `docs/BACKEND_REQUESTS.md`.
Mock mode returns data in the same v1 shapes. In mock mode, upload a file with "blur" in its name to see an escalated case; any username/password works.

## Rules the UI enforces
- Safety text is shown read-only and cannot be edited or removed.
- Nothing is sent to the farmer until the officer approves (the farmer page only shows text when status is `sent`).
- Reject and escalate require a reason.
- Model confidence is labelled "not calibrated"; text found inside images is shown as untrusted.
- Upload validation: JPG/PNG/WebP up to 8 MB, audio up to 10 MB (the backend re-checks).
