import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { STATUS_LABEL } from "../util";

const DONE = ["sent", "rejected", "photo_requested"];

export default function Advisory() {
  const { id } = useParams();
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [showEn, setShowEn] = useState(false);

  useEffect(() => {
    let stop = false, t;
    async function load() {
      try {
        const r = await api.getAdvisory(id);
        if (stop) return;
        setA(r);
        if (!DONE.includes(r.status)) t = setTimeout(load, 5000);
      } catch (e) { if (!stop) setErr(e.message); }
    }
    load();
    return () => { stop = true; clearTimeout(t); };
  }, [id]);

  if (err) return <p className="error">{err}</p>;
  if (!a) return <p>Loading…</p>;

  const lang = showEn ? "en" : a.language;

  return (
    <div className="card">
      <h1>Your report {id}</h1>
      {a.status === "sent" && a.text ? (
        <>
          <label className="inline"><input type="checkbox" checked={showEn} onChange={(e) => setShowEn(e.target.checked)} /> Show in English</label>
          <p className="advice">{a.text[lang] || a.text.en}</p>
          <div className="safety"><strong>Safety</strong><p>{a.safety_text?.[lang] || a.safety_text?.en}</p></div>
          {a.audio_url ? <audio controls src={a.audio_url} /> : <p className="muted">Audio is not available yet.</p>}
        </>
      ) : a.status === "photo_requested" ? (
        <div className="warn"><p>The officer needs a clearer photo.</p><p>{a.officer_note}</p><Link to="/">Send a new report</Link></div>
      ) : a.status === "rejected" ? (
        <div className="alert"><p>The officer could not give advice for this report.</p><p>{a.officer_note}</p></div>
      ) : (
        <p>⏳ Status: <strong>{STATUS_LABEL[a.status] || a.status}</strong>. An officer is reviewing your report. This page updates automatically.</p>
      )}
    </div>
  );
}
