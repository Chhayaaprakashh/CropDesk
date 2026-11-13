// Mock backend so the frontend can be built and demoed without the real API.
// Shapes follow DESIGN.md section 5. Replace nothing here: just set VITE_USE_MOCK=false.
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const svg = (label) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='220'><rect width='100%' height='100%' fill='#dcefd5'/><text x='50%' y='50%' text-anchor='middle' font-size='18' fill='#365'>${label}</text></svg>`
  );

const SAFETY = {
  en: "Wear gloves, mask and full-sleeve clothing while spraying. Do not harvest before the waiting period on the label. [mock text]",
  kn: "[Kannada safety text comes from the reference JSON]",
};

let cases = [
  {
    case_id: "C-0001",
    status: "pending_review",
    created_at: new Date(Date.now() - 3600e3).toISOString(),
    farm: { crop: "tomato", days_since_planting: 45, growth_stage: "vegetative", district: "Mysuru", language: "kn" },
    image_urls: [svg("tomato leaf photo (mock)")],
    audio_url: null,
    image_findings: [
      { image_id: "img1", quality: "good", crop_seen: "tomato",
        symptoms: [{ id: "SYM_LEAF_SPOT_YELLOW_BROWN", confidence: 0.82 }, { id: "SYM_CONCENTRIC_RINGS", confidence: 0.55 }] },
    ],
    voice_context: {
      transcript: "[mock transcript] Planted 45 days ago, heavy rain last week.",
      language: "kn",
      extracted: { days_since_planting: 45, weather: "heavy_rain_last_week" },
      source_quote: "heavy rain last week",
    },
    possible_causes: [
      { cause_id: "CAUSE_EARLY_BLIGHT", score: 0.64, reference_ref: "TNAU tomato p.12 [mock]", evidence: ["SYM_LEAF_SPOT_YELLOW_BROWN", "rain"] },
      { cause_id: "CAUSE_SEPTORIA_LEAF_SPOT", score: 0.41, reference_ref: "TNAU tomato p.13 [mock]", evidence: ["SYM_LEAF_SPOT_YELLOW_BROWN"] },
    ],
    conflicts_or_missing: [],
    escalation: { required: false, reasons: [] },
    advisory: {
      draft_text: { en: "Possible early blight. Remove affected lower leaves and avoid overhead watering. Spray [reference product, from reference only]. [mock draft]", kn: "" },
      safety_text: SAFETY,
      citations: ["TNAU tomato p.12 [mock]"],
    },
  },
  {
    case_id: "C-0002",
    status: "needs_expert",
    created_at: new Date(Date.now() - 600e3).toISOString(),
    farm: { crop: "tomato", days_since_planting: null, growth_stage: "", district: "Tumakuru", language: "kn" },
    image_urls: [svg("blurry photo (mock)")],
    audio_url: null,
    image_findings: [{ image_id: "img1", quality: "blurry", crop_seen: "tomato", symptoms: [{ id: "SYM_LEAF_SPOT_YELLOW_BROWN", confidence: 0.35 }] }],
    voice_context: { transcript: "", language: "kn", extracted: {}, source_quote: "" },
    possible_causes: [],
    conflicts_or_missing: ["days since planting missing", "no voice note"],
    escalation: { required: true, reasons: ["BLURRY_IMAGE", "LOW_CONFIDENCE", "EMPTY_TRANSCRIPT"] },
    advisory: { draft_text: { en: "", kn: "" }, safety_text: SAFETY, citations: [] },
  },
];

const find = (id) => {
  const c = cases.find((x) => x.case_id === id);
  if (!c) throw new Error("Case not found");
  return c;
};

export const mockApi = {
  async listCases() {
    await wait();
    return cases.map((c) => ({
      case_id: c.case_id, status: c.status, created_at: c.created_at,
      crop: c.farm.crop, district: c.farm.district, escalation_required: c.escalation.required,
    }));
  },
  async getCase(id) { await wait(); return structuredClone(find(id)); },
  async createCase(fd) {
    await wait(700);
    const form = JSON.parse(fd.get("form") || "{}");
    const id = `C-${String(cases.length + 1).padStart(4, "0")}`;
    cases.push({
      ...structuredClone(cases[0]), case_id: id, status: "pending_review",
      created_at: new Date().toISOString(),
      farm: { crop: "tomato", days_since_planting: form.days_since_planting, growth_stage: form.growth_stage, district: form.district, language: form.language },
    });
    return { case_id: id };
  },
  async review(id, body) {
    await wait(500);
    const c = find(id);
    if (body.action === "approve" || body.action === "edit") {
      if (body.edited_text_en) c.advisory.draft_text.en = body.edited_text_en;
      c.status = "sent";
    } else if (body.action === "reject") c.status = "rejected";
    else if (body.action === "request_photo") c.status = "photo_requested";
    c.officer_note = body.note || "";
    return { ok: true, status: c.status };
  },
  async getAdvisory(id) {
    await wait();
    const c = find(id);
    return {
      status: c.status, language: c.farm.language,
      text: c.status === "sent" ? c.advisory.draft_text : null,
      safety_text: c.advisory.safety_text, audio_url: null, officer_note: c.officer_note || "",
    };
  },
};
