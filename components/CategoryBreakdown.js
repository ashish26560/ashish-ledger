import { formatINR } from "@/lib/data";

export default function CategoryBreakdown({ entries, excludedSet }) {
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return <p className="text-sm text-muted py-6">No transactions for this period.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([cat, amt]) => {
        const excluded = excludedSet?.has(cat);
        const pct = (amt / max) * 100;
        return (
          <div key={cat}>
            <div className="flex justify-between items-baseline mb-1">
              <span className={`text-sm ${excluded ? "text-muted italic" : "text-ink"}`}>
                {cat}
              </span>
              <span className="font-mono tabular text-sm text-muted">{formatINR(amt)}</span>
            </div>
            <div className="h-1.5 bg-line rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${pct}%`,
                  backgroundColor: excluded ? "#B8862E" : "#1F6F54",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
