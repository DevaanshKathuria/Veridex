"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ManipulationTactic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ManipulationWarning({ tactics, overallScore, label }: { tactics: ManipulationTactic[]; overallScore: number; label: string }) {
  const [open, setOpen] = useState(false);
  if (!tactics?.length) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-manipulation/20 bg-manipulation/5">
      <button className="flex h-10 w-full items-center justify-between border-t border-manipulation/30 px-3 text-left" onClick={() => setOpen((value) => !value)}>
        <span className="flex items-center gap-2 text-[13px] text-text-primary">
          <AlertTriangle className="size-3.5 text-manipulation" />
          {tactics.length} manipulation tactics detected - {label}
          <span className="font-mono text-[11px] text-text-tertiary">{overallScore}/100</span>
        </span>
        <span className="flex items-center gap-1 text-xs text-text-secondary">
          View <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-3 p-3 md:grid-cols-2">
              {tactics.map((tactic, index) => (
                <div key={`${tactic.tactic}-${index}`} className="rounded-md border border-manipulation/15 bg-manipulation-dim p-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-manipulation">{tactic.tactic.replaceAll("_", " ")}</p>
                  <code className="mt-2 block rounded bg-black/30 p-2 font-mono text-xs italic text-text-secondary">{tactic.excerpt}</code>
                  <p className="mt-2 text-xs leading-5 text-text-tertiary">{tactic.explanation}</p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-void">
                    <div className="h-full rounded-full bg-gradient-to-r from-verdict-disputed to-verdict-false" style={{ width: `${Math.round(tactic.intensityScore * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
