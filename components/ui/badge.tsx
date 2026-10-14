import { cn } from "@/lib/utils";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "bg-paper text-muted",
        tone === "good" && "bg-sage/15 text-moss",
        tone === "warn" && "bg-gold/20 text-[#765a19]",
        tone === "bad" && "bg-coral/15 text-coral"
      )}
    >
      {children}
    </span>
  );
}
