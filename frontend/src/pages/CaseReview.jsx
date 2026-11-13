import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, session } from "../api";
import StatusBadge from "../components/StatusBadge";
import AuthMedia from "../components/AuthMedia";
import { ESC_LABEL, langName, pretty } from "../util";

const Citation = ({ c }) => (
  <li className="cite">
    <strong>{c.document_title}</strong> {c.publisher && `· ${c.publisher}`} {c.page_or_section && `· ${c.page_or_section}`}
    <div className="muted">ID {c.reference_id}</div>
    <blockquote>{c.passage}</blockquote>
  </li>
);

export default function CaseReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = useCallback((e) => {
    if (e.status === 401) { session.clear(); return nav("/login"); }
    setErr(e.message + (e.ref ? ` (ref ${e.ref})` : ""));
  }, [nav]);

  const load = useCallback(() =>
    api.getCase(id).then((x) => { setC(x); setDraft(x.proposed_advisory?.text || ""); }).catch(fail), [id, fail]);

  useEffect(() => { load(); }, [load]);

  if (!c) return err ? <p className="error">{err}</p> : <p>Loading…</p>;

  const adv = c.proposed_advisory;
  const img = c.image_analysis, aud = c.audio_analysis;
  const canDecide = c.status === "PENDING_REVIEW" && !!adv;
  const edited = adv && draft !== adv.text;

  async function run(fn, done = () => nav("/officer")) {
    setBusy(true); setErr("");
    try { await fn(); done(); } catch (e) { fail(e); load(); } finally { setBusy(false); }
  }
  const needReason = () => (reason.trim().length >= 3 ? true : (setErr("Enter a reason (at least 3 characters)."), false));

  return (
    <div className="stack">
      <p><Link to="/officer">← Back to queue</Link></p>

      <div className="card">
        <h1>{c.case_id} <StatusBadge status={c.status} /></h1>
        <p className="muted">
          {c.farm.crop} · {c.farm.location || "—"} · stage: {c.farm.growth_stage || "unknown"} · planted: {c.farm.planting_date || "unknown"} · farmer language: {langName(c.farm.farmer_language)}
        </p>
        {c.escalation_required && (
          <div className="alert"><strong>Escalated to expert</strong>
            <ul>{c.escalation_reasons.map((r, i) => (
              <li key={i}><strong>{ESC_LABEL[r.code] || r.code}:</strong> {r.message}
                {r.needs_from_farmer && <div className="muted">Needs from farmer: {r.needs_from_farmer}</div>}</li>))}
            </ul>
          </div>
        )}
        {c.missing_information.length > 0 && <div className="warn"><strong>Missing information</strong><ul>{c.missing_information.map((m) => <li key={m}>{m}</li>)}</ul></div>}
        {c.conflicting_evidence.length > 0 && <div className="warn"><strong>Conflicting evidence</strong><ul>{c.conflicting_evidence.map((m) => <li key={m}>{m}</li>)}</ul></div>}
      </div>

      <div className="card">
        <h2>Photo</h2>
        <AuthMedia caseId={id} kind="image" />
        {img ? (
          <>
            <p>Suitability: <strong>{pretty(img.suitability)}</strong>
              {img.model_reported_confidence != null && <> · model-reported confidence: <strong>{Math.round(img.model_reported_confidence * 100)}%</strong> <span className="tag">not calibrated</span></>}</p>
            {img.quality_notes && <p className="muted">{img.quality_notes}</p>}
            <h3>Symptoms seen</h3>
            {!img.symptoms.length && <p className="muted">None reported.</p>}
            <ul>{img.symptoms.map((s, i) => <li key={i}>{s.description}{s.plant_part && <span className="muted"> · {s.plant_part}</span>}</li>)}</ul>
            {img.limitations.length > 0 && <p className="muted">Limitations: {img.limitations.join("; ")}</p>}
            {img.detected_embedded_text && <div className="warn"><strong>Text found inside the image (untrusted, never followed):</strong><blockquote>{img.detected_embedded_text}</blockquote></div>}
          </>
        ) : <p className="muted">No image analysis.</p>}
      </div>

      <div className="card">
        <h2>Voice note</h2>
        {aud ? (
          <>
            <AuthMedia caseId={id} kind="audio" />
            <p><em>Transcript ({langName(aud.detected_language)}{!aud.audio_quality_ok && ", poor audio quality"}):</em> {aud.transcript || <span className="muted">empty</span>}</p>
            <ul>
              {aud.crop_age_days != null && <li>Crop age: {aud.crop_age_days} days</li>}
              {aud.recent_weather && <li>Weather: {aud.recent_weather}</li>}
              {aud.reported_symptoms.length > 0 && <li>Reported symptoms: {aud.reported_symptoms.join(", ")}</li>}
              {aud.ambiguities.length > 0 && <li>Ambiguities: {aud.ambiguities.join("; ")}</li>}
            </ul>
          </>
        ) : <p className="muted">No voice note.</p>}
      </div>

      <div className="card">
        <h2>Possible causes (from the approved reference only)</h2>
        {!c.possible_causes.length && <p className="muted">No cause matched the reference.</p>}
        {c.possible_causes.map((p, i) => (
          <div key={i} className="cause">
            <strong>{p.cause}</strong>
            <ul>{p.supporting_observations.map((o) => <li key={o}>{o}</li>)}</ul>
            <ul className="cites">{p.citations.map((x, j) => <Citation key={j} c={x} />)}</ul>
          </div>
        ))}
        <p className="muted">These are possibilities, not a diagnosis.</p>
      </div>

      <div className="card">
        <h2>Advisory {adv && <span className="muted">v{adv.version} · {langName(adv.language)}</span>}</h2>
        {!adv ? <p className="muted">No advisory was drafted for this case.</p> : (
          <>
            <label>Advisory text
              <textarea rows="6" value={draft} disabled={!canDecide} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <div className="safety"><strong>Safety instructions (from reference, always included, not editable)</strong>
              <ul>{adv.safety_instructions.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            {adv.unverifiable_notes.length > 0 && <div className="warn"><strong>Could not be verified</strong><ul>{adv.unverifiable_notes.map((n) => <li key={n}>{n}</li>)}</ul></div>}
            <details><summary>Citations ({adv.citations.length})</summary><ul className="cites">{adv.citations.map((x, j) => <Citation key={j} c={x} />)}</ul></details>
          </>
        )}

        {err && <p className="error">{err}</p>}
        {canDecide && (
          <>
            <label>Note for the record (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength="1000" /></label>
            <label>Reason (required to reject or escalate)<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength="1000" /></label>
            <div className="actions">
              <button disabled={busy || edited} onClick={() => run(() => api.approve(id, adv.version, note))}>Approve</button>
              <button disabled={busy || !edited} onClick={() => run(async () => {
                const v = await api.edit(id, adv.version, draft, note);
                await api.approve(id, v.version, note);
              })}>Save edits and approve</button>
              <button className="ghost" disabled={busy} onClick={() => needReason() && run(() => api.escalate(id, reason.trim()))}>Escalate to expert</button>
              <button className="danger" disabled={busy} onClick={() => needReason() && run(() => api.reject(id, reason.trim()))}>Reject</button>
            </div>
          </>
        )}
        {c.status === "ESCALATED" && <p className="muted">This case is waiting for expert input and cannot be approved from here.</p>}
      </div>
    </div>
  );
}
