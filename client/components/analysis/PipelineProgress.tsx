"use client";

import {
  Brain,
  Check,
  Database,
  FileSearch,
  Gauge,
  ListChecks,
  Radar,
  ScanText,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const stages = [
  { key: "CLEANING", label: "Cleaning", icon: ScanText },
  { key: "SEGMENTING", label: "Segmenting", icon: ListChecks },
  { key: "EXTRACTING", label: "Extracting Claims", icon: Brain },
  { key: "EMBEDDING", label: "Embedding", icon: Database },
  { key: "RETRIEVING", label: "Retrieving Evidence", icon: FileSearch },
  { key: "RERANKING", label: "Reranking", icon: SlidersHorizontal },
  { key: "JUDGING", label: "Judging Claims", icon: Radar },
  { key: "NUMERICAL", label: "Numerical Check", icon: Gauge },
  { key: "MANIPULATION", label: "Manipulation Detection", icon: ShieldAlert },
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
  progress,
}: {
  status?: string | null;
  subtext?: string | null;
  claimsTotal?: number;
  progress?: number;
}) {
  const activeKey = aliases[status || ""] || status || "CLEANING";
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.key === activeKey));
  const computedProgress = progress ?? Math.round(((activeIndex + 1) / stages.length) * 100);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
        <span>{claimsTotal ? `${claimsTotal} claims in queue` : "Pipeline initializing"}</span>
        <span>{computedProgress}%</span>
      </div>
      <Progress value={computedProgress} className="mb-5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isComplete = index < activeIndex || status === "COMPLETE";
          const isActive = index === activeIndex && status !== "COMPLETE";
          return (
            <div key={stage.key} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border",
                  isComplete && "border-verdict-verified bg-verdict-verified/20 text-[#79c080]",
                  isActive && "animate-pulse border-[#1f6feb] bg-[#1f6feb]/20 text-[#79c0ff]",
                  !isComplete && !isActive && "border-border bg-surface-2 text-text-secondary"
                )}
              >
                {isComplete ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
              </span>
              <span className={cn("text-xs", isActive ? "text-text-primary" : "text-text-secondary")}>{stage.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-text-secondary">{subtext || "Preparing document analysis..."}</p>
    </div>
  );
}
