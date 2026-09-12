"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/data";
import { useIsCompact } from "@/lib/useIsCompact";

export interface MonthComparisonPoint {
  month: string;
  label: string;
  spent: number;
  moneyIn: number;
  /** A month whose statements don't cover the whole period. */
  partial?: boolean;
}

interface MonthComparisonChartProps {
  data: MonthComparisonPoint[];
  selected: string;
  onSelect: (month: string) => void;
}

// Rust for money out and forest for money in, matching how debits and credits
// are already coloured everywhere else in the app. That pair is close under
// red-green colour blindness, so identity never rests on hue alone: the bars
// keep a fixed order (out always left of in), the legend names them, and the
// tooltip and the equation strip below the chart both state the figures.
const OUT = "#A8452F";
const IN = "#1F6F54";

interface TooltipPayloadEntry {
  payload: MonthComparisonPoint;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="border border-ink rounded bg-paper px-3 py-2 text-[13px] shadow-sm">
      <p className="font-medium mb-1">
        {point.label}
        {point.partial ? " · part month" : ""}
      </p>
      <p className="flex justify-between gap-5">
        <span className="text-muted">Out</span>
        <span className="font-mono tabular text-rust">{formatINR(point.spent)}</span>
      </p>
      <p className="flex justify-between gap-5">
        <span className="text-muted">In</span>
        <span className="font-mono tabular text-forestDeep">{formatINR(point.moneyIn)}</span>
      </p>
    </div>
  );
}

/**
 * Six months of money out against money in — and the month picker, since
 * clicking a month is the obvious thing to try and the page reads for whatever
 * month is chosen. The `<Select>` beside the heading is the keyboard path;
 * this is the one you reach for when a bar catches your eye.
 */
export default function MonthComparisonChart({ data, selected, onSelect }: MonthComparisonChartProps) {
  const isCompact = useIsCompact();

  return (
    <div className="h-52 md:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barGap={2}
          onClick={(state) => {
            const i = state?.activeTooltipIndex;
            if (typeof i === "number" && data[i]) onSelect(data[i].month);
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid vertical={false} stroke="#D9D6CC" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: isCompact ? 10 : 12, fill: "#6E6A61", fontFamily: "var(--font-plex-sans)" }}
            axisLine={{ stroke: "#D9D6CC" }}
            tickLine={false}
            interval={0}
            tickFormatter={(label: string) => (isCompact ? label.split(" ")[0] : label)}
          />
          <YAxis
            tick={{ fontSize: isCompact ? 10 : 11, fill: "#6E6A61", fontFamily: "var(--font-plex-mono)" }}
            axisLine={false}
            tickLine={false}
            width={isCompact ? 44 : 70}
            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip cursor={{ fill: "#EBE9E2" }} content={<ChartTooltip />} />
          {/* Unselected months stay legible but recede, so the month the rest
              of the page is describing is obvious at a glance. */}
          <Bar dataKey="spent" name="Money out" fill={OUT} radius={[2, 2, 0, 0]} maxBarSize={26} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.month} fillOpacity={d.month === selected ? 1 : 0.45} />
            ))}
          </Bar>
          <Bar dataKey="moneyIn" name="Money in" fill={IN} radius={[2, 2, 0, 0]} maxBarSize={26} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.month} fillOpacity={d.month === selected ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
