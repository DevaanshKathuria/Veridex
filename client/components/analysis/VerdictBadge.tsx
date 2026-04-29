"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const verdictMeta: Record<string, { color: string; dim: string; className: string; border: string }> = {
  VERIFIED: {
    color: "#00C896",
    dim: "#001F16",
    className: "border-verdict-verified/25 bg-verdict-verified-dim text-verdict-verified",
    border: "border-l-verdict-verified",
  },
  DISPUTED: {
    color: "#F5A623",
    dim: "#1F1400",
    className: "border-verdict-disputed/25 bg-verdict-disputed-dim text-verdict-disputed",
    border: "border-l-verdict-disputed",
  },
  FALSE: {
    color: "#FF3B5C",
    dim: "#200010",
    className: "border-verdict-false/25 bg-verdict-false-dim text-verdict-false",
    border: "border-l-verdict-false",
  },
  UNSUPPORTED: {
    color: "#4D6680",
    dim: "#0A1018",
    className: "border-verdict-unsupported/25 bg-verdict-unsupported-dim text-verdict-unsupported",
    border: "border-l-verdict-unsupported",
  },
  INSUFFICIENT_EVIDENCE: {
    color: "#4D9FFF",
    dim: "#00101F",
    className: "border-verdict-insufficient/25 bg-verdict-insufficient-dim text-verdict-insufficient",
    border: "border-l-verdict-insufficient",
  },
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
  const meta = verdictMeta[normalized] ?? verdictMeta.UNSUPPORTED;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.1, 1], opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
        className={cn(
          "rounded-md border font-mono uppercase tracking-[0.08em]",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
          meta.className
        )}
      >
        {normalized.replaceAll("_", " ")}
      </motion.span>
      {temporalVerdict ? (
        <span className="rounded-md border border-manipulation/25 bg-manipulation-dim px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-manipulation">
          {temporalVerdict}
        </span>
      ) : null}
    </span>
  );
}
