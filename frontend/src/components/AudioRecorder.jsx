import { useRef, useState } from "react";

export default function AudioRecorder({ onChange }) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState(null);
  const rec = useRef(null);
  const chunks = useRef([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec.current = new MediaRecorder(stream);
      chunks.current = [];
      rec.current.ondataavailable = (e) => chunks.current.push(e.data);
      rec.current.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.current.mimeType || "audio/webm";
        const file = new File([new Blob(chunks.current, { type })], "voice-note.webm", { type });
        setUrl(URL.createObjectURL(file));
        onChange(file);
      };
      rec.current.start();
      setRecording(true);
    } catch {
      alert("Microphone not available. Please upload an audio file instead.");
    }
  }

  function stop() { rec.current?.stop(); setRecording(false); }

  function upload(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return alert("Audio must be under 10 MB.");
    setUrl(URL.createObjectURL(f));
    onChange(f);
  }

  function clear() { setUrl(null); onChange(null); }

  return (
    <div className="recorder">
      {!recording
        ? <button type="button" onClick={start}>🎙 Record</button>
        : <button type="button" className="danger" onClick={stop}>⏹ Stop</button>}
      <label className="link">or upload <input type="file" accept="audio/*" hidden onChange={upload} /></label>
      {url && (
        <>
          <audio controls src={url} />
          <button type="button" className="ghost" onClick={clear}>Remove</button>
        </>
      )}
    </div>
  );
}
