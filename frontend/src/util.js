export const pretty = (s = "") => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export const STATUS_LABEL = {
  RECEIVED: "Received", ANALYZING: "Analyzing", PENDING_REVIEW: "Pending review",
  APPROVED: "Approved", ESCALATED: "Escalated to expert", REJECTED: "Rejected", FAILED: "Failed",
};

export const ESC_LABEL = {
  IMAGE_UNUSABLE: "Image unusable", INSUFFICIENT_VISUAL_EVIDENCE: "Not enough visual evidence",
  CONFLICTING_EVIDENCE: "Photo, voice note and form disagree", MISSING_CRITICAL_DETAILS: "Critical details missing",
  UNSUPPORTED_CROP: "Crop not supported", UNSUPPORTED_LANGUAGE: "Language not supported",
  NO_APPROVED_REFERENCE: "No approved reference entry", UNSUPPORTED_RECOMMENDATION: "Recommendation not in reference",
  INVALID_CITATION: "Invalid citation", MODEL_FAILURE: "AI service failed", INVALID_MODEL_OUTPUT: "Invalid AI output",
  PROMPT_INJECTION_SUSPECTED: "Possible malicious instruction in input", POLICY_VIOLATION: "Policy violation",
  OFFICER_REQUESTED: "Escalated by officer",
};

export const LANGS = [["kn", "Kannada"], ["hi", "Hindi"], ["en", "English"]];
export const langName = (c) => (LANGS.find(([k]) => c?.startsWith(k)) || [, c || "unknown"])[1];

export const dateDaysAgo = (n) => {
  const d = new Date(Date.now() - n * 864e5);
  return d.toISOString().slice(0, 10);
};
export const daysSince = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso)) / 864e5)) : null);
