"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatINR, monthLabel } from "@/lib/data";

export default function MonthlyTrendChart({ data }) {
  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.month) }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#D9D6CC" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#6E6A61", fontFamily: "var(--font-plex-sans)" }}
            axisLine={{ stroke: "#D9D6CC" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6E6A61", fontFamily: "var(--font-plex-mono)" }}
            axisLine={false}
            tickLine={false}
            width={70}
            tickFormatter={(v) => `\u20B9${(v / 1000).toFixed(0)}k`}
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
            formatter={(v) => [formatINR(v), "Net expense"]}
          />
          <Bar dataKey="net" fill="#1F6F54" radius={[2, 2, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
