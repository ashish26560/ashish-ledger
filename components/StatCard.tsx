interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="border border-line rounded bg-paper px-4 py-3 md:px-5 md:py-4 h-full">
      <p className="text-[11px] md:text-xs text-muted mb-1.5 md:mb-2">{label}</p>
      {/* `break-all` so a long rupee figure wraps inside the card instead of
          widening it and pushing the page sideways on a narrow screen. */}
      <p
        className="font-mono tabular text-xl md:text-2xl leading-tight md:leading-none break-all"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] md:text-xs text-muted mt-1.5 md:mt-2">{sub}</p>}
    </div>
  );
}
