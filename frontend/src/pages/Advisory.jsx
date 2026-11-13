import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { langName } from "../util";

const WAITING = ["RECEIVED", "ANALYZING", "PENDING_REVIEW"];

export default function Advisory() {
  const { id } = useParams();
  const [s, setS] = useState(null);
  const [audio, setAudio] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false, t;
    async function load() {
      try {
        const r = await api.farmerStatus(id);
        if (stop) return;
        setS(r);
        if (WAITING.includes(r.status)) t = setTimeout(load, 5000);
      } catch (e) { if (!stop) setErr(e.message); }
    }
    load();
    return () => { stop = true; clearTimeout(t); };
  }, [id]);

  useEffect(() => {
    if (s?.status === "APPROVED" && !audio) api.farmerAudio(id).then(setAudio).catch(() => setAudio({ status: "FAILED" }));
  }, [s, id, audio]);

  if (err) return <p className="error">{err}</p>;
  if (!s) return <p>Loading…</p>;

  const a = s.advisory?.advisory;
  return (
    <div className="card">
      <h1>Your report</h1>
      <p className="muted">Reference: {id}</p>
      {s.status === "APPROVED" && a ? (
        <>
          <p className="muted">Language: {langName(a.language)}</p>
          <p className="advice">{a.text}</p>
          <div className="safety"><strong>Safety</strong><ul>{a.safety_instructions.map((x) => <li key={x}>{x}</li>)}</ul></div>
          {audio?.status === "GENERATED" && audio.audio_ref
            ? <audio controls src={audio.audio_ref} />
            : <p className="muted">{audio ? "Audio is not available for this advisory." : "Preparing audio…"}</p>}
        </>
      ) : s.status === "ESCALATED" ? (
        <div className="warn">
          <p>An expert is looking at your report.</p>
          {s.needs_from_farmer && <p><strong>Please send:</strong> {s.needs_from_farmer}</p>}
          <Link to="/">Send a new report</Link>
        </div>
      ) : s.status === "REJECTED" || s.status === "FAILED" ? (
        <div className="alert"><p>We could not give advice for this report. Please contact your local agriculture office.</p></div>
      ) : (
        <p>⏳ An officer is reviewing your report. This page updates automatically.</p>
      )}
    </div>
  );
}
