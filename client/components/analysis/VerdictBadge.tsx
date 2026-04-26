import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const verdictStyles: Record<string, string> = {
  VERIFIED: "border-verdict-verified/40 bg-verdict-verified/15 text-[#79c080]",
  DISPUTED: "border-verdict-disputed/40 bg-verdict-disputed/15 text-[#e3b341]",
  FALSE: "border-verdict-false/40 bg-verdict-false/15 text-[#ff7b72]",
  UNSUPPORTED: "border-verdict-unsupported/40 bg-verdict-unsupported/15 text-[#b1bac4]",
  INSUFFICIENT_EVIDENCE: "border-verdict-insufficient/40 bg-verdict-insufficient/15 text-[#79c0ff]",
};

export function VerdictBadge({
  verdict,
  size = "md",
  temporalVerdict,
}: {
  verdict: string;
  size?: "sm" | "md";
  temporalVerdict?: string;
}) {
  const normalized = verdict || "UNSUPPORTED";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn(
          "rounded-md border font-semibold tracking-normal",
          size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs",
          verdictStyles[normalized] ?? verdictStyles.UNSUPPORTED
        )}
      >
        {normalized.replaceAll("_", " ")}
      </Badge>
      {temporalVerdict ? (
        <Badge variant="outline" className="h-5 rounded-md border-[#1f6feb]/40 bg-[#1f6feb]/10 text-[10px] text-[#79c0ff]">
          {temporalVerdict}
        </Badge>
      ) : null}
    </span>
  );
}
