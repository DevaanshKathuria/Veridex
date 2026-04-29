import { cn } from "@/lib/utils";

const tierStyles: Record<number, string> = {
  1: "border-tier-1/30 bg-tier-1/10 text-tier-1",
  2: "border-tier-2/30 bg-tier-2/10 text-tier-2",
  3: "border-tier-3/30 bg-tier-3/10 text-tier-3",
  4: "border-tier-4/30 bg-tier-4/10 text-tier-4",
};

export function TierBadge({ tier = 4, className }: { tier?: number; className?: string }) {
  return (
    <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase leading-none", tierStyles[tier] ?? tierStyles[4], className)}>
      T{tier}
    </span>
  );
}
