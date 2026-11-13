# CROPDESK Backend/AI (Part A) — Phases 1-2 complete

```bash
pip install -r requirements.txt
python -m pytest -q                      # 39 tests, no network
uvicorn app.main:app --reload            # docs at /docs
```
**Works now:** schemas, error format, correlation IDs, upload validation, pluggable auth, repository interface, state machine,
officer approve/edit/reject/escalate, farmer-advisory gate, capabilities. **Not yet:** Nexus adapters, reference grounding,
analysis workflow, escalation engine, TTS (return explicit 501 / NOT_CONFIGURED, never fake output).
See `docs/INTEGRATION_CONTRACT.md` and `docs/NEXUS_SETUP.md`.
