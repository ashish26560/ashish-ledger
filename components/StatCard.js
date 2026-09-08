export default function StatCard({ label, value, sub, accent }) {
  return (
    <div className="border border-line rounded bg-paper px-5 py-4">
      <p className="text-xs text-muted mb-2">{label}</p>
      <p
        className="font-mono tabular text-2xl leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-2">{sub}</p>}
    </div>
  );
}
