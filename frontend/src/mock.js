// Mock backend in the REAL v1 shapes (docs/INTEGRATION_CONTRACT.md). Lets the UI run with no server.
import { dateDaysAgo } from "./util";

const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const svg = (t) => "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='360' height='240'><rect width='100%' height='100%' fill='#dcefd5'/><text x='50%' y='50%' text-anchor='middle' font-size='18' fill='#365'>${t}</text></svg>`);
const err = (status, code, message) => Object.assign(new Error(message), { status, code });

const CIT = { reference_id: "TOM-001", document_title: "[MOCK] Tomato package of practices", publisher: "[mock]", version_or_date: "[mock]", page_or_section: "p.12", passage: "[mock passage] Early blight: concentric brown rings on older leaves, favoured by warm humid weather." };
const SAFETY = ["[mock] Wear gloves, mask and full-sleeve clothing while spraying.", "[mock] Observe the waiting period on the label before harvest."];
const farm = (o = {}) => ({ farmer_id: "farmer_demo", crop: "tomato", planting_date: dateDaysAgo(45), growth_stage: "vegetative", location: "Mysuru", recent_weather: "heavy rain last week", farmer_language: "kn", ...o });

const cases = [
  {
    case_id: "case_0123456789ab", status: "PENDING_REVIEW", review_status: "PENDING", processing_status: "COMPLETED",
    farm: farm(),
    image_analysis: { suitability: "SUITABLE", quality_notes: "Sharp, well lit.", model_reported_confidence: 0.78, confidence_is_calibrated: false,
      symptoms: [{ description: "Yellow-brown spots with concentric rings on lower leaves", plant_part: "leaf", location_on_plant: "lower canopy", source: "image" }],
      limitations: ["Single photo; stem and fruit not visible"], detected_embedded_text: null },
    audio_analysis: { transcript: "[mock transcript] Planted 45 days ago, heavy rain last week.", detected_language: "kn", audio_quality_ok: true, crop: "tomato", planting_date: dateDaysAgo(45), crop_age_days: 45, reported_symptoms: ["leaf spots"], recent_weather: "heavy rain last week", practices: [], missing_information: [], ambiguities: [] },
    missing_information: [], conflicting_evidence: [],
    possible_causes: [{ cause: "Early blight (possible)", supporting_observations: ["Concentric ring spots", "Heavy rain last week"], citations: [CIT] }],
    escalation_required: false, escalation_reasons: [],
    proposed_advisory: { version: 1, language: "en", text: "Possible early blight. Remove affected lower leaves and avoid overhead watering. [mock advisory, product only from reference]", citations: [CIT], safety_instructions: SAFETY, unverifiable_notes: [] },
    created_at: iso(3600e3), updated_at: iso(3600e3),
  },
  {
    case_id: "case_ba5eba11ba11", status: "ESCALATED", review_status: "ESCALATED", processing_status: "COMPLETED",
    farm: farm({ planting_date: null, growth_stage: null, recent_weather: null, location: "Tumakuru" }),
    image_analysis: { suitability: "POOR_QUALITY", quality_notes: "Image is blurry.", model_reported_confidence: 0.3, confidence_is_calibrated: false, symptoms: [], limitations: ["Out of focus"], detected_embedded_text: null },
    audio_analysis: null, missing_information: ["Planting date", "Voice note"], conflicting_evidence: [], possible_causes: [],
    escalation_required: true,
    escalation_reasons: [{ code: "IMAGE_UNUSABLE", message: "The photo is too blurry to assess.", needs_from_farmer: "A clear, close photo of the affected leaf in daylight." }],
    proposed_advisory: null, created_at: iso(600e3), updated_at: iso(600e3),
  },
];

const find = (id) => { const c = cases.find((x) => x.case_id === id); if (!c) throw err(404, "CASE_NOT_FOUND", "Case not found."); return c; };
const mustBePending = (c) => { if (c.status !== "PENDING_REVIEW") throw err(409, "INVALID_TRANSITION", "This case cannot be changed from its current status."); };

export const mockApi = {
  async login(u, p) { await wait(); if (!u || !p) throw err(401, "UNAUTHENTICATED", "Enter a username and password."); return { access_token: "mock-token" }; },
  async submitCase(payload, image) {
    await wait(800);
    const blur = /blur/i.test(image.name);
    const base = structuredClone(cases[blur ? 1 : 0]);
    const id = "case_" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
    cases.push({ ...base, case_id: id, farm: { ...base.farm, ...payload.farm }, created_at: iso(), updated_at: iso() });
    return { case_id: id };
  },
  async farmerStatus(id) {
    await wait();
    const c = find(id);
    const esc = c.escalation_reasons[0];
    return {
      case_id: id, status: c.status, language: c.farm.farmer_language,
      advisory: c.status === "APPROVED" ? { case_id: id, advisory: c.proposed_advisory, reviewer_id: "officer_demo", approved_at: c.updated_at, review_notes: null } : null,
      needs_from_farmer: esc?.needs_from_farmer || null,
    };
  },
  async farmerAudio() { await wait(); return { status: "NOT_CONFIGURED", audio_ref: null, error: "Text-to-speech is not configured." }; },
  async listCases() { await wait(); return structuredClone(cases); },
  async getCase(id) { await wait(); return structuredClone(find(id)); },
  async media(id, kind) { await wait(150); return kind === "image" ? svg("farmer photo (mock)") : null; },
  async approve(id, version) {
    await wait(); const c = find(id); mustBePending(c);
    if (version !== c.proposed_advisory?.version) throw err(409, "STALE_ADVISORY_VERSION", "stale");
    c.status = "APPROVED"; c.review_status = "APPROVED"; c.updated_at = iso();
    return { case_id: id, advisory: c.proposed_advisory, reviewer_id: "officer_demo", approved_at: iso() };
  },
  async edit(id, version, text) {
    await wait(); const c = find(id); mustBePending(c);
    c.proposed_advisory = { ...c.proposed_advisory, version: version + 1, text };
    return structuredClone(c.proposed_advisory);
  },
  async reject(id) { await wait(); const c = find(id); mustBePending(c); c.status = "REJECTED"; c.review_status = "REJECTED"; return null; },
  async escalate(id, reason) {
    await wait(); const c = find(id); mustBePending(c);
    c.status = "ESCALATED"; c.review_status = "ESCALATED"; c.escalation_required = true;
    c.escalation_reasons.push({ code: "OFFICER_REQUESTED", message: reason, needs_from_farmer: reason });
    return null;
  },
};
