import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import AudioRecorder from "../components/AudioRecorder";

const LANGS = [["kn", "Kannada"], ["hi", "Hindi"], ["en", "English"]];
const STAGES = ["", "seedling", "vegetative", "flowering", "fruiting"];
const MAX_MB = 8;

export default function Intake() {
  const nav = useNavigate();
  const [f, setF] = useState({ farmer_name: "", district: "", language: "kn", days_since_planting: "", growth_stage: "", notes: "" });
  const [images, setImages] = useState([]);
  const [audio, setAudio] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const previews = useMemo(() => images.map((i) => URL.createObjectURL(i)), [images]);

  function onImages(e) {
    const files = [...e.target.files];
    const bad = files.find((x) => !["image/jpeg", "image/png"].includes(x.type) || x.size > MAX_MB * 1024 * 1024);
    if (bad) return setErr(`"${bad.name}" must be a JPG or PNG under ${MAX_MB} MB.`);
    setErr("");
    setImages(files.slice(0, 3));
  }

  async function submit(e) {
    e.preventDefault();
    if (!images.length) return setErr("Add at least one clear photo of the affected leaf.");
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      images.forEach((i) => fd.append("images", i));
      if (audio) fd.append("audio", audio, audio.name || "voice-note.webm");
      fd.append("form", JSON.stringify({
        ...f, crop: "tomato",
        days_since_planting: f.days_since_planting === "" ? null : Number(f.days_since_planting),
      }));
      const { case_id } = await api.createCase(fd);
      nav(`/advisory/${case_id}`);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>Report a crop problem</h1>
      <p className="muted">Crop: Tomato. Send clear photos of the affected leaves and, if you can, a short voice note.</p>

      <label>Leaf photos (1–3, JPG/PNG)
        <input type="file" accept="image/jpeg,image/png" multiple onChange={onImages} />
      </label>
      <div className="thumbs">{previews.map((p) => <img key={p} src={p} alt="leaf preview" />)}</div>

      <label>Voice note (what you see, when you planted, recent weather)</label>
      <AudioRecorder onChange={setAudio} />

      <div className="grid">
        <label>Your name (optional)<input value={f.farmer_name} onChange={set("farmer_name")} /></label>
        <label>District<input required value={f.district} onChange={set("district")} /></label>
        <label>Language
          <select value={f.language} onChange={set("language")}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Days since planting
          <input type="number" min="0" max="400" value={f.days_since_planting} onChange={set("days_since_planting")} />
        </label>
        <label>Crop stage
          <select value={f.growth_stage} onChange={set("growth_stage")}>
            {STAGES.map((s) => <option key={s} value={s}>{s || "Not sure"}</option>)}
          </select>
        </label>
      </div>
      <label>Notes (optional)<textarea rows="3" maxLength="500" value={f.notes} onChange={set("notes")} /></label>

      {err && <p className="error">{err}</p>}
      <button disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
    </form>
  );
}
