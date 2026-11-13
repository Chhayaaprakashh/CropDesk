# DESIGN.md: CropDesk

**Crop Advisory Case Management for Extension Workers**
Team: [Chhaya Prakash], [Ayushi Saini], [Gagandeep Kaur] | Program: Navigate Labs Generative AI Level 1, Chandigarh University (AIT-CSE)
Mentor: [Mr. Saanthosh C] | Status: Draft v1, awaiting mentor approval

---

## 1. Problem, Users, Solution

**Problem.** Farmers send photos and voice notes about sick crops to extension workers. Look-alike symptoms have different causes, and image recognition alone ignores crop stage, weather and local advisories. Wrong pesticide advice costs money and harms health.

**Target users.**
- **Extension officer** (Krishi Vigyan Kendra / agriculture department): reviews cases and approves advisories.
- **Farmer**: sends the report and receives the approved advisory.

**Scenario.** A farmer uploads a tomato leaf photo with yellow-brown spots and a Kannada voice note: "Planted 45 days ago, heavy rain last week."

**Solution.** CropDesk turns a raw farmer report into a structured **case card** (crop, stage, symptoms with confidence, voice-note context, 1-3 possible causes from the supplied reference only). Low-confidence or conflicting cases are escalated. The officer approves or edits, and the approved advisory reaches the farmer as text and audio in their language.

**Scope (kept small on purpose).** One crop (tomato), one advisory reference ([TNAU / UAS / ICAR-IIHR] tomato package of practices; exact title, year, URL: [fill]). Languages: English + Kannada (+ Hindi if Nexus speech models support it). Stretch features are excluded until all mandatory ones are tested.

## 2. Core Workflow and Architecture

**Workflow:** Intake (photo + voice note + farm form) → quality checks → vision symptom extraction → speech-to-text → context extraction → code-based scoring against reference → escalation decision → case card → **officer review (approve / edit / reject / request new photo)** → advisory in farmer's language → text + audio to farmer.

**Mandatory features:** (1) multimodal intake, (2) case card with confidence and reference-only causes, (3) escalation to expert, (4) officer approve/edit, (5) advisory as text + audio in farmer's language.

**Architecture:** React frontend → FastAPI backend (the only component that calls Nexus) → Nexus AI Platform. Database: SQLite/PostgreSQL for cases and review log. Advisory reference stored as structured JSON in the repo. API key in backend `.env` only (`.env.example` committed). Deployment: [Render/Railway/Vercel, fill].

**What code does vs what AI does:**
- *AI:* read symptoms from image, transcribe speech, extract context from transcript, translate officer-edited free text, generate speech.
- *Code:* blur check, scoring, cause ranking, escalation rules, pesticide whitelist check, attaching safety text, schema validation, permissions.

## 3. Nexus AI Models and Purposes

| Operation | Model | Purpose |
|---|---|---|
| Vision | `gpt-4.1-nano` vs [2nd vision model, fill after checking the full list] | Image → symptoms (from a fixed vocabulary) + confidence + image quality |
| Speech-to-text | `whisper-1` | Farmer voice note → transcript (Kannada/Hindi/English) |
| Context extraction | `nova-micro` vs `gpt-oss-20b` (compare) | Transcript + form → JSON (days since planting, weather, complaints) |
| Text-to-speech | `gemini-2.5-flash-tts` | Approved advisory → audio in farmer's language |

**Model comparison (required):** vision and context extraction, on the same test images/transcripts, measuring response quality, input/output tokens and latency. Final choice documented in `evidence/`.
**Not used:** `text-embedding-3-small` (the reference is small enough for structured lookup; fewer calls, fewer tokens).
*Open check:* confirm Kannada support of `whisper-1` and `gemini-2.5-flash-tts` by testing real recordings. If unsupported, fall back to the best supported regional language and update this section.

## 4. Modalities

| Direction | Modality | Nexus model |
|---|---|---|
| Input | Image (leaf/plant photos) | vision model |
| Input | Audio (voice note) | `whisper-1` |
| Input | Text (farm form) | LLM |
| Output | Text (case card, advisory) | LLM |
| Output | Audio (advisory for farmer) | `gemini-2.5-flash-tts` |

Poor-quality or unsupported inputs (blurry, non-plant, wrong crop, silent/corrupt audio, wrong file type) are detected and escalated or rejected with a clear message.

## 5. Structured JSON Output Schema (case card)

```json
{
  "case_id": "C-0001",
  "status": "needs_expert | pending_review | approved | edited | rejected | sent",
  "farm": { "crop": "tomato", "days_since_planting": 45, "growth_stage": "vegetative|flowering|fruiting", "district": "", "language": "kn" },
  "image_findings": [{
    "image_id": "img1", "quality": "good|blurry|unusable", "crop_seen": "tomato",
    "symptoms": [{ "id": "SYM_LEAF_SPOT_YELLOW_BROWN", "confidence": 0.82 }]
  }],
  "voice_context": {
    "transcript": "", "language": "kn",
    "extracted": { "days_since_planting": 45, "weather": "heavy_rain_last_week" },
    "source_quote": ""
  },
  "possible_causes": [{ "cause_id": "CAUSE_EARLY_BLIGHT", "score": 0.64, "reference_ref": "[doc, page]", "evidence": ["SYM_LEAF_SPOT_YELLOW_BROWN", "rain"] }],
  "conflicts_or_missing": ["stage in form (flowering) differs from voice note (45 days)"],
  "escalation": { "required": true, "reasons": ["LOW_CONFIDENCE", "BLURRY_IMAGE", "AMBIGUOUS_CAUSES", "CONFLICT", "NO_REFERENCE_MATCH"] },
  "advisory": { "recommendation_ids": ["REC_..."], "safety_ids": ["PPE_...", "WAIT_..."], "text": { "en": "", "kn": "" }, "citations": ["[doc, page]"] },
  "review": { "officer_id": "", "action": "approve|edit|reject", "edited_text": "", "timestamp": "" }
}
```

Every model output is validated against this schema (enums, ranges, required fields). Invalid output → one retry → case marked `needs_expert`. Missing or conflicting info is listed in `conflicts_or_missing`, never guessed.

## 6. Human Review, Safety Boundaries, Failure Scenarios

**Human review.** Every advisory needs officer approval before reaching the farmer, including high-confidence cases. Escalated cases are flagged with reasons. The officer sees photo, transcript, case card and sources, and can approve, edit, reject or request a new photo. The review action is logged.

**Escalation rules (in code):** vision confidence below threshold; blur/low-quality image; top two causes too close in score; conflict between photo, voice note and form; no matching reference entry; empty or low-confidence transcript; injection flag.

**Safety boundaries (enforced in code).**
- Pesticide, dose and brand come only from reference IDs. Any other name in the output is rejected and escalated. "Strongest brand" requests get a reference-only answer.
- Causes are always labelled "possible", never a definite diagnosis from a photo alone.
- Safety instructions (PPE, waiting period, re-entry) are attached from the reference to every advisory and cannot be removed by editing.
- Doses and safety text use pre-translated, verified strings from the reference, not free LLM translation.
- Prompt injection: untrusted input (form, transcript, text in images) is passed as delimited data; the LLM has no tools; outputs are schema-validated; permissions and the key live in the backend.

**Failure scenarios.**
1. **Look-alike diseases misread** (early blight vs Septoria vs bacterial spot) with a confident but wrong vision result. *Mitigation:* fixed symptom vocabulary, code-based scoring with context, top-2 gap rule, "possible causes" wording, officer approval.
2. **Speech-to-text fails** (dialect, noise, wrong language). *Mitigation:* transcript shown to the officer and editable, empty/low-confidence transcript escalates, the form is the fallback source.
3. **Nexus API failure or invalid JSON.** *Mitigation:* timeout and one retry, then the case is saved as `needs_expert` with no auto-advisory, and the officer is notified.

## 7. Test Data Sources and Licences

| Data | Source | Licence |
|---|---|---|
| Leaf images | PlantVillage tomato subset | [check licence of the exact copy used, fill] |
| Leaf images | Our own photos of real plants (at least half of image tests) | Own work |
| Voice notes | Recorded by team members (Kannada/Hindi/English, at least half of audio tests) | Own work, consent from speakers |
| Advisory reference | [TNAU / UAS / ICAR-IIHR] tomato package of practices | [fill; attribute source] |
| Farm forms | Synthetic | Own work |

No real farmer records or personal data are used.
