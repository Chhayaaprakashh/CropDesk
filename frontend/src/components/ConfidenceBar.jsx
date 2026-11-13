export default function ConfidenceBar({ value = 0 }) {
  const pct = Math.round(value * 100);
  const level = pct >= 70 ? "high" : pct >= 50 ? "mid" : "low";
  return (
    <span className="conf" title={`${pct}%`}>
      <span className="conf-track"><span className={`conf-fill ${level}`} style={{ width: `${pct}%` }} /></span>
      <span className="conf-num">{pct}%</span>
    </span>
  );
}
