import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, session } from "../api";

export default function Login() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api.login(u, p);
      session.set(r.access_token);
      nav("/officer");
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Officer sign-in</h1>
      <label>Username<input autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
      {err && <p className="error">{err}</p>}
      <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
