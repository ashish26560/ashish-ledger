"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatINR, monthLabel } from "@/lib/data";
import { useIsCompact } from "@/lib/useIsCompact";

interface MonthlyTrendPoint {
  month: string;
  net: number;
}

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const isCompact = useIsCompact();

  return (
    <div className="h-48 md:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#D9D6CC" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: isCompact ? 10 : 12, fill: "#6E6A61", fontFamily: "var(--font-plex-sans)" }}
            axisLine={{ stroke: "#D9D6CC" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={isCompact ? 4 : 8}
          />
          <YAxis
            tick={{ fontSize: isCompact ? 10 : 11, fill: "#6E6A61", fontFamily: "var(--font-plex-mono)" }}
            axisLine={false}
            tickLine={false}
            // A 70px gutter is a big share of a 360px screen — the labels are
            // short ("₹12k") so they fit comfortably in 44px there.
            width={isCompact ? 44 : 70}
            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            cursor={{ fill: "#EBE9E2" }}
            contentStyle={{
              background: "#F4F3EE",
              border: "1px solid #1B1D1F",
              borderRadius: 4,
              fontFamily: "var(--font-plex-sans)",
              fontSize: 13,
            }}
            formatter={(v: number) => [formatINR(v), "Net expense"]}
          />
          <Bar dataKey="net" fill="#1F6F54" radius={[2, 2, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
