"use client";

import { Check, CircleDot, Database, FileSearch, Gauge, ListChecks, Radar, ScanText, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
  { key: "CLEANING", label: "Cleaning", icon: ScanText },
  { key: "SEGMENTING", label: "Segmenting", icon: ListChecks },
  { key: "EXTRACTING", label: "Extracting claims", icon: Sparkles },
  { key: "EMBEDDING", label: "Embedding", icon: Database },
  { key: "RETRIEVING", label: "Retrieving evidence", icon: FileSearch },
  { key: "RERANKING", label: "Reranking", icon: Radar },
  { key: "JUDGING", label: "Judging claims", icon: CircleDot },
  { key: "NUMERICAL", label: "Numerical check", icon: Gauge },
  { key: "MANIPULATION", label: "Manipulation detection", icon: ShieldAlert },
  { key: "SCORING", label: "Scoring", icon: Gauge },
];

const aliases: Record<string, string> = {
  INGESTING: "CLEANING",
  READY: "EXTRACTING",
  COMPLETE: "SCORING",
};

export function PipelineProgress({
  status,
  subtext,
  claimsTotal,
  progress = 0,
}: {
  status?: string | null;
  subtext?: string | null;
  claimsTotal?: number;
  progress?: number;
}) {
  const activeKey = aliases[status || ""] || status || "CLEANING";
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.key === activeKey));

  return (
    <div className="glass-card rounded-[10px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Pipeline</p>
          <p className="mt-1 text-sm text-text-secondary">{claimsTotal ? `${claimsTotal} claims queued` : "Awaiting evidence graph"}</p>
        </div>
        <span className="font-mono text-xs text-text-tertiary">{Math.round(progress)}%</span>
      </div>
      <div className="mb-5 h-px overflow-hidden rounded-full bg-border-dim">
        <div className="h-full bg-gradient-to-r from-glow-blue via-glow-cyan to-glow-emerald transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="relative space-y-4">
        <div className="absolute left-[7px] top-2 h-[calc(100%-16px)] border-l border-dashed border-border-dim" />
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const complete = index < activeIndex || status === "COMPLETE";
          const active = index === activeIndex && status !== "COMPLETE";
          return (
            <div key={stage.key} className="relative flex items-start gap-4">
              <span
                className={cn(
                  "relative z-10 mt-1 flex size-4 items-center justify-center rounded-full border bg-void",
                  complete && "border-glow-emerald bg-glow-emerald text-void animate-ping-once",
                  active && "border-glow-blue bg-glow-blue/20 text-glow-cyan",
                  !complete && !active && "border-border-dim text-text-tertiary"
                )}
              >
                {complete ? <Check className="size-2.5" /> : active ? <span className="size-2 rounded-full bg-glow-cyan animate-ping" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("flex items-center gap-2 text-[13px]", complete || active ? "text-text-primary" : "text-text-tertiary")}>
                    <Icon className="size-3.5" />
                    {stage.label}
                  </span>
                  <span className="font-mono text-[11px] text-text-tertiary">{complete ? "done" : active ? "live" : "--"}</span>
                </div>
                {active ? <p className="mt-1 font-mono text-[11px] text-text-secondary">{subtext || "Processing..."}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
