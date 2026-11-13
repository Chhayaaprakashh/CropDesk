import { mockApi } from "./mock";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
// Send the free-text notes/question field only after the backend adds `farmer_notes` to FarmDetails (it rejects unknown fields).
export const SEND_NOTES = import.meta.env.VITE_SEND_NOTES === "true";
const BASE = "/api/v1";
const TOKEN_KEY = "cd_token";

export const session = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  set(t) { sessionStorage.setItem(TOKEN_KEY, t); },
  clear() { sessionStorage.removeItem(TOKEN_KEY); },
};

export class ApiError extends Error {
  constructor(status, code, message, ref) { super(message); this.status = status; this.code = code; this.ref = ref; }
}

const FRIENDLY = {
  FILE_TOO_LARGE: "That file is too large.",
  UNSUPPORTED_IMAGE_TYPE: "The photo must be a JPG, PNG or WebP image.",
  UNSUPPORTED_AUDIO_TYPE: "That audio format is not supported.",
  EMPTY_UPLOAD: "The file is empty.",
  ANALYSIS_NOT_IMPLEMENTED: "The analysis service is not ready yet. Please try again later.",
  AUTH_NOT_CONFIGURED: "Sign-in is not set up on the server yet.",
  UNAUTHENTICATED: "Please sign in again.",
  STALE_ADVISORY_VERSION: "The advisory changed. Reload the case and try again.",
  ESCALATION_UNRESOLVED: "This case is escalated and cannot be approved yet.",
  ADVISORY_UNGROUNDED: "The advisory has no valid reference citation.",
  INVALID_TRANSITION: "This case cannot be changed from its current status.",
};

const authHeaders = () => (session.token ? { Authorization: `Bearer ${session.token}` } : {});

async function req(path, { method = "GET", json, form, auth = true } = {}) {
  const headers = { "X-Correlation-ID": crypto.randomUUID(), ...(auth ? authHeaders() : {}) };
  if (json) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: json ? JSON.stringify(json) : form });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const code = body?.code || "ERROR";
    throw new ApiError(res.status, code, FRIENDLY[code] || body?.message || `Request failed (${res.status})`, body?.correlation_id);
  }
  return body;
}

async function blobUrl(path) {
  const res = await fetch(BASE + path, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(res.status, "MEDIA", "Could not load the file.");
  return URL.createObjectURL(await res.blob());
}

// Endpoints marked PROPOSED do not exist in the backend yet. See docs/BACKEND_REQUESTS.md.
const real = {
  login: (username, password) => req("/auth/login", { method: "POST", json: { username, password }, auth: false }), // PROPOSED
  submitCase(payload, image, audio) { // PROPOSED public route (farmers never use staff routes)
    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    fd.append("image", image);
    if (audio) fd.append("audio", audio, audio.name);
    return req("/public/cases", { method: "POST", form: fd, auth: false });
  },
  farmerStatus: (id) => req(`/public/cases/${id}/status`, { auth: false }), // PROPOSED
  farmerAudio: (id) => req(`/public/cases/${id}/advisory-audio`, { method: "POST", auth: false }), // PROPOSED
  listCases: () => req("/cases"), // PROPOSED
  getCase: (id) => req(`/cases/${id}`),
  media: (id, kind) => blobUrl(`/cases/${id}/${kind}`), // PROPOSED: kind = image | audio
  approve: (id, version, notes) => req(`/cases/${id}/approve`, { method: "POST", json: { advisory_version: version, notes: notes || null } }),
  edit: (id, version, text, notes) => req(`/cases/${id}/advisory/edit`, { method: "POST", json: { base_version: version, new_text: text, notes: notes || null } }),
  reject: (id, reason) => req(`/cases/${id}/reject`, { method: "POST", json: { reason } }),
  escalate: (id, reason) => req(`/cases/${id}/escalate`, { method: "POST", json: { reason } }),
};

export const api = USE_MOCK ? mockApi : real;
