"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { FinancialProjection } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

interface Props {
  baseline: FinancialProjection;
  scenario?: FinancialProjection;
}

function formatAxisDollars(value: number) {
  return Math.abs(value) >= 1000 ? `$${Math.round(value / 100) / 10}k` : `$${Math.round(value)}`;
}

export function CashFlowChart({ baseline, scenario }: Props) {
  const data = baseline.timeline.map((point, index) => ({
    date: point.label,
    baseline: point.balance,
    scenario: scenario?.timeline[index]?.balance
  }));

  return (
    <div className="h-[310px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="baselineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5f7f63" stopOpacity={0.32} />
              <stop offset="95%" stopColor="#5f7f63" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="scenarioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d66f5d" stopOpacity={0.26} />
              <stop offset="95%" stopColor="#d66f5d" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#dfe4dc" strokeDasharray="3 3" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={formatAxisDollars} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ borderRadius: 8, border: "1px solid #dfe4dc" }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="baseline"
            name="Baseline"
            stroke="#335946"
            strokeWidth={3}
            fill="url(#baselineFill)"
          />
          {scenario ? (
            <Area
              type="monotone"
              dataKey="scenario"
              name="Scenario"
              stroke="#d66f5d"
              strokeWidth={3}
              fill="url(#scenarioFill)"
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
