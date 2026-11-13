import { useEffect, useState } from "react";
import { api } from "../api";

// Loads protected media (needs the Authorization header, so a plain <img src> will not work).
export default function AuthMedia({ caseId, kind }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = null, off = false;
    api.media(caseId, kind)
      .then((u) => { url = u; if (!off) u ? setSrc(u) : setFailed(true); })
      .catch(() => !off && setFailed(true));
    return () => { off = true; if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [caseId, kind]);

  if (failed) return <p className="muted">No {kind} available.</p>;
  if (!src) return <p className="muted">Loading {kind}…</p>;
  return kind === "image" ? <img className="case-img" src={src} alt="farmer upload" /> : <audio controls src={src} />;
}
