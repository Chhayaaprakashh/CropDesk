import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

const OPEN = ["needs_expert", "pending_review"];

export default function Queue() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);

  useEffect(() => {
    let stop = false, t;
    async function load() {
      try { const r = await api.listCases(); if (!stop) { setRows(r); setErr(""); } }
      catch (e) { if (!stop) setErr(e.message); }
      if (!stop) t = setTimeout(load, 10000);
    }
    load();
    return () => { stop = true; clearTimeout(t); };
  }, []);

  const shown = (rows || [])
    .filter((r) => !onlyOpen || OPEN.includes(r.status))
    .sort((a, b) => (b.status === "needs_expert") - (a.status === "needs_expert") || b.created_at.localeCompare(a.created_at));

  return (
    <div className="card">
      <h1>Case queue</h1>
      <label className="inline"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Show only cases awaiting review</label>
      {err && <p className="error">{err}</p>}
      {!rows && !err && <p>Loading…</p>}
      {rows && !shown.length && <p className="muted">No cases to show.</p>}
      <ul className="list">
        {shown.map((r) => (
          <li key={r.case_id}>
            <Link to={`/officer/${r.case_id}`}>
              <strong>{r.case_id}</strong> · {r.crop} · {r.district || "—"}
              <span className="muted"> · {new Date(r.created_at).toLocaleString()}</span>
            </Link>
            <StatusBadge status={r.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
