import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, session } from "../api";
import StatusBadge from "../components/StatusBadge";

const FINAL = ["APPROVED", "REJECTED", "FAILED"];
const rank = (c) => (c.status === "ESCALATED" ? 0 : c.status === "PENDING_REVIEW" ? 1 : 2);

export default function Queue() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);

  useEffect(() => {
    let stop = false, t;
    async function load() {
      try { const r = await api.listCases(); if (!stop) { setRows(r); setErr(""); } }
      catch (e) {
        if (e.status === 401) { session.clear(); return nav("/login"); }
        if (!stop) setErr(e.message);
      }
      if (!stop) t = setTimeout(load, 10000);
    }
    load();
    return () => { stop = true; clearTimeout(t); };
  }, [nav]);

  const shown = (rows || [])
    .filter((c) => !onlyOpen || !FINAL.includes(c.status))
    .sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));

  return (
    <div className="card">
      <h1>Case queue</h1>
      <label className="inline"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Hide finished cases</label>
      {err && <p className="error">{err}</p>}
      {!rows && !err && <p>Loading…</p>}
      {rows && !shown.length && <p className="muted">No cases to show.</p>}
      <ul className="list">
        {shown.map((c) => (
          <li key={c.case_id}>
            <Link to={`/officer/${c.case_id}`}>
              <strong>{c.case_id}</strong> · {c.farm.crop} · {c.farm.location || "—"}
              <span className="muted"> · {new Date(c.created_at).toLocaleString()}</span>
            </Link>
            <StatusBadge status={c.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
