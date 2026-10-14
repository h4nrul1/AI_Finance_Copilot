"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

export function SpendingChart({ data }: { data: Array<{ category: string; amount: number }> }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#dfe4dc" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="category" tickLine={false} axisLine={false} interval={0} angle={-20} height={56} textAnchor="end" />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
          <Tooltip formatter={(value: number) => formatCurrency(value, 2)} contentStyle={{ borderRadius: 8 }} />
          <Bar dataKey="amount" fill="#40798c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
