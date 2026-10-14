import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  detail,
  tone = "default"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <Card className={cn("p-4", tone === "good" && "border-sage/40", tone === "warn" && "border-gold/50")}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-ink">{value}</p>
      <p className="mt-2 text-sm leading-5 text-muted">{detail}</p>
    </Card>
  );
}
