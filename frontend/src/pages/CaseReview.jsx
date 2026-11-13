import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";
import ConfidenceBar from "../components/ConfidenceBar";
import { REASONS, pretty } from "../util";

export default function CaseReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getCase(id)
      .then((x) => { setC(x); setDraft(x.advisory?.draft_text?.en || ""); })
      .catch((e) => setErr(e.message));
  }, [id]);

  if (!c) return err ? <p className="error">{err}</p> : <p>Loading…</p>;

  const original = c.advisory?.draft_text?.en || "";
  const edited = draft !== original;
  const locked = ["sent", "rejected", "photo_requested"].includes(c.status);

  async function act(action) {
    if (["reject", "request_photo"].includes(action) && !note.trim()) return setErr("Add a note first.");
    if (["approve", "edit"].includes(action) && !draft.trim()) return setErr("The advisory text is empty.");
    setBusy(true); setErr("");
    try {
      await api.review(id, {
        action,
        edited_text_en: action === "edit" ? draft : undefined,
        note: note.trim() || undefined,
      });
      nav("/officer");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p><Link to="/officer">← Back to queue</Link></p>
      <div className="card">
        <h1>{c.case_id} <StatusBadge status={c.status} /></h1>
        <p className="muted">
          {c.farm.crop} · {c.farm.district || "—"} · stage: {c.farm.growth_stage || "unknown"} · days since planting: {c.farm.days_since_planting ?? "unknown"} · language: {c.farm.language}
        </p>
        {c.escalation?.required && (
          <div className="alert">
            <strong>Escalated to expert.</strong>
            <ul>{c.escalation.reasons.map((r) => <li key={r}>{REASONS[r] || r}</li>)}</ul>
          </div>
        )}
        {c.conflicts_or_missing?.length > 0 && (
          <div className="warn"><strong>Missing or conflicting information</strong>
            <ul>{c.conflicts_or_missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Photos and symptoms</h2>
        <div className="thumbs">{c.image_urls.map((u) => <img key={u} src={u} alt="farmer upload" />)}</div>
        {c.image_findings.map((im) => (
          <div key={im.image_id}>
            <p>Image quality: <strong>{im.quality}</strong> · crop seen: {im.crop_seen}</p>
            <ul className="list">
              {im.symptoms.map((s) => (
                <li key={s.id}>{pretty(s.id)} <ConfidenceBar value={s.confidence} /></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Voice note</h2>
        {c.audio_url && <audio controls src={c.audio_url} />}
        <p><em>Transcript ({c.voice_context.language}):</em> {c.voice_context.transcript || <span className="muted">none</span>}</p>
        <ul>{Object.entries(c.voice_context.extracted || {}).map(([k, v]) => <li key={k}>{pretty(k)}: {String(v)}</li>)}</ul>
      </div>

      <div className="card">
        <h2>Possible causes (from reference only)</h2>
        {!c.possible_causes.length && <p className="muted">No cause matched the reference.</p>}
        <ul className="list">
          {c.possible_causes.map((p) => (
            <li key={p.cause_id}>
              <span><strong>{pretty(p.cause_id)}</strong> <span className="muted">· {p.reference_ref}</span></span>
              <ConfidenceBar value={p.score} />
            </li>
          ))}
        </ul>
        <p className="muted">These are possibilities, not a diagnosis.</p>
      </div>

      <div className="card">
        <h2>Advisory</h2>
        <label>Draft (English). Edits are re-translated for the farmer.
          <textarea rows="6" value={draft} disabled={locked} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <div className="safety">
          <strong>Safety instructions (from reference, always included, not editable)</strong>
          <p>{c.advisory.safety_text?.en}</p>
        </div>
        {c.advisory.citations?.length > 0 && <p className="muted">Sources: {c.advisory.citations.join("; ")}</p>}

        {!locked && (
          <>
            <label>Note (required for reject or new-photo request)
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {err && <p className="error">{err}</p>}
            <div className="actions">
              <button disabled={busy || edited || !original} onClick={() => act("approve")}>Approve</button>
              <button disabled={busy || !edited} onClick={() => act("edit")}>Save edits and approve</button>
              <button className="ghost" disabled={busy} onClick={() => act("request_photo")}>Request new photo</button>
              <button className="danger" disabled={busy} onClick={() => act("reject")}>Reject</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
