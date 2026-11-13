import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, SEND_NOTES } from "../api";
import AudioRecorder from "../components/AudioRecorder";
import { LANGS, dateDaysAgo } from "../util";

const STAGES = ["", "seedling", "vegetative", "flowering", "fruiting"];
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMG = 8, MAX_AUD = 10;

function farmerId() {
  let id = localStorage.getItem("cd_farmer_id");
  if (!id) { id = "farmer_" + crypto.randomUUID().slice(0, 8); localStorage.setItem("cd_farmer_id", id); }
  return id;
}

export default function Intake() {
  const nav = useNavigate();
  const requestId = useRef(crypto.randomUUID()); // idempotency key: a retry of the same submit reuses it
  const [f, setF] = useState({ location: "", language: "kn", days: "", stage: "", weather: "", notes: "" });
  const [image, setImage] = useState(null);
  const [audio, setAudio] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);

  function onImage(e) {
    const file = e.target.files[0];
    if (!file) return setImage(null);
    if (!IMG_TYPES.includes(file.type)) return setErr("The photo must be a JPG, PNG or WebP image.");
    if (file.size > MAX_IMG * 1024 * 1024) return setErr(`The photo must be under ${MAX_IMG} MB.`);
    setErr(""); setImage(file);
  }

  function onAudio(file) {
    if (file && file.size > MAX_AUD * 1024 * 1024) { setErr(`The voice note must be under ${MAX_AUD} MB.`); return setAudio(null); }
    setErr(""); setAudio(file);
  }

  async function submit(e) {
    e.preventDefault();
    if (!image) return setErr("Add a clear photo of the affected leaf.");
    setBusy(true); setErr("");
    const farm = {
      farmer_id: farmerId(), crop: "tomato", location: f.location.trim(), farmer_language: f.language,
      ...(f.days !== "" && { planting_date: dateDaysAgo(Number(f.days)) }),
      ...(f.stage && { growth_stage: f.stage }),
      ...(f.weather.trim() && { recent_weather: f.weather.trim() }),
      ...(SEND_NOTES && f.notes.trim() && { farmer_notes: f.notes.trim() }),
    };
    try {
      const { case_id } = await api.submitCase({ farm, client_request_id: requestId.current }, image, audio);
      nav(`/advisory/${case_id}`);
    } catch (x) {
      setErr(x.message + (x.ref ? ` (ref ${x.ref})` : ""));
    } finally { setBusy(false); }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>Report a crop problem</h1>
      <p className="muted">Crop: Tomato. Send one clear photo of the affected leaf and, if you can, a short voice note.</p>

      <label>Leaf photo (JPG, PNG or WebP)
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} />
      </label>
      {preview && <div className="thumbs"><img src={preview} alt="leaf preview" /></div>}

      <label>Voice note: what you see, when you planted, recent weather</label>
      <AudioRecorder onChange={onAudio} />

      <div className="grid">
        <label>Village / district<input required value={f.location} onChange={set("location")} /></label>
        <label>Language
          <select value={f.language} onChange={set("language")}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label>Days since planting
          <input type="number" min="0" max="400" value={f.days} onChange={set("days")} />
        </label>
        <label>Crop stage
          <select value={f.stage} onChange={set("stage")}>{STAGES.map((s) => <option key={s} value={s}>{s || "Not sure"}</option>)}</select>
        </label>
      </div>
      <label>Recent weather (optional)<input maxLength="500" value={f.weather} onChange={set("weather")} placeholder="e.g. heavy rain last week" /></label>
      <label>Notes or question (optional)<textarea rows="3" maxLength="500" value={f.notes} onChange={set("notes")} /></label>

      {err && <p className="error">{err}</p>}
      <button disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
    </form>
  );
}
