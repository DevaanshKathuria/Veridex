"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ManipulationTactic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ManipulationWarning({
  tactics,
  overallScore,
  label,
}: {
  tactics: ManipulationTactic[];
  overallScore: number;
  label: string;
}) {
  const [open, setOpen] = useState(true);
  if (!tactics?.length) return null;

  return (
    <div className="rounded-lg border border-[#E85D04]/50 bg-[#E85D04]/10">
      <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen((value) => !value)}>
        <span className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-[#ffab70]" />
          <span>
            <span className="block text-sm font-semibold text-text-primary">Manipulation signals detected</span>
            <span className="text-xs text-text-secondary">{label} framing risk, score {overallScore}/100</span>
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-text-secondary transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-[#E85D04]/30 p-4 md:grid-cols-2">
          {tactics.map((tactic, index) => (
            <div key={`${tactic.tactic}-${index}`} className="rounded-md border border-border bg-background/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded bg-[#E85D04]/20 px-2 py-0.5 text-xs font-medium text-[#ffab70]">
                  {tactic.tactic.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-text-secondary">{Math.round(tactic.intensityScore * 100)}%</span>
              </div>
              <code className="block rounded border border-border bg-surface-2 p-2 text-xs text-text-primary">{tactic.excerpt}</code>
              <p className="mt-2 text-xs leading-5 text-text-secondary">{tactic.explanation}</p>
              <Progress value={Math.round(tactic.intensityScore * 100)} className="mt-3" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
