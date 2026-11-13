export const pretty = (id = "") =>
  id.replace(/^(CAUSE|SYM|REC)_/, "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const REASONS = {
  LOW_CONFIDENCE: "Low model confidence",
  BLURRY_IMAGE: "Blurry or unusable image",
  AMBIGUOUS_CAUSES: "Top causes too close to separate",
  CONFLICT: "Photo, voice note and form disagree",
  NO_REFERENCE_MATCH: "No match in the advisory reference",
  EMPTY_TRANSCRIPT: "Voice note missing or not understood",
  INJECTION_FLAG: "Possible malicious instruction in input",
  AI_UNAVAILABLE: "AI service unavailable",
};

export const STATUS_LABEL = {
  needs_expert: "Needs expert",
  pending_review: "Pending review",
  approved: "Approved",
  edited: "Edited",
  sent: "Sent to farmer",
  rejected: "Rejected",
  photo_requested: "New photo requested",
};
