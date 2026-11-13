import { mockApi } from "./mock";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

async function json(res) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const real = {
  createCase: (formData) => fetch("/api/cases", { method: "POST", body: formData }).then(json),
  listCases: () => fetch("/api/cases").then(json),
  getCase: (id) => fetch(`/api/cases/${id}`).then(json),
  review: (id, body) =>
    fetch(`/api/cases/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(json),
  getAdvisory: (id) => fetch(`/api/cases/${id}/advisory`).then(json),
};

export const api = USE_MOCK ? mockApi : real;
