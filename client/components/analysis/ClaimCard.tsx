"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { TierBadge } from "@/components/analysis/TierBadge";
import { VerdictBadge, verdictMeta } from "@/components/analysis/VerdictBadge";
import { TiltCard } from "@/components/motion/TiltCard";
import type { ClaimDTO, EvidenceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

function EvidenceChunkCard({ item, tone }: { item: EvidenceChunk; tone: "support" | "contradict" }) {
  const [copied, setCopied] = useState(false);
  const excerpt = item.excerpt || item.chunkText || "";
  const stanceColor = tone === "contradict" ? "#FF3B5C" : item.stance === "neutral" ? "#4D6680" : "#00C896";

  async function copyUrl() {
    await navigator.clipboard.writeText(item.sourceUrl || excerpt).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn("rounded-md border bg-void/50 p-3", tone === "contradict" ? "border-verdict-false/25 bg-verdict-false-dim/30" : "border-border-dim")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] text-text-primary">{item.sourceName || item.source || "Evidence source"}</span>
        <span className="flex shrink-0 items-center gap-2">
          <TierBadge tier={item.reliabilityTier ?? 4} />
          <button className={cn("font-mono text-[10px] text-text-tertiary transition-colors", copied && "text-glow-emerald")} onClick={copyUrl}>
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </span>
      </div>
      <p className="border-l-2 pl-3 text-xs italic leading-6 text-text-secondary" style={{ borderColor: stanceColor }}>
        {excerpt.slice(0, 220)}
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="h-1 rounded-full bg-surface-2">
          <div className="h-full rounded-full" style={{ width: `${Math.round((item.nliScore ?? item.nliConfidence ?? 0.45) * 100)}%`, background: stanceColor }} />
        </div>
        <span className="font-mono text-[10px] text-text-tertiary">rank: {(item.rerankerScore ?? 0).toFixed(2)}</span>
      </div>
    </div>
  );
}

export function ClaimCard({ claim, index, onTraceSource }: { claim: ClaimDTO; index: number; onTraceSource: (claimId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const text = claim.text || claim.claimText || claim.sentence || "";
  const shown = expanded || text.length <= 120 ? text : `${text.slice(0, 120)}...`;
  const spo = claim.spo || { subject: claim.subject, predicate: claim.predicate, object: claim.object };
  const verdict = claim.verdict || "UNSUPPORTED";
  const meta = verdictMeta[verdict] ?? verdictMeta.UNSUPPORTED;
  const confidence = Math.round(claim.confidence ?? 0);
  const supporting = claim.supportingEvidence ?? [];
  const contradicting = claim.contradictingEvidence ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ delay: Math.min(index * 0.06, 0.6), duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <TiltCard className={cn("rounded-[10px] border border-border-dim bg-surface p-4 hover:border-border-bright hover:bg-surface-2 border-l-2", meta.border)}>
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <VerdictBadge verdict={verdict} temporalVerdict={claim.temporalVerdict} />
            <span className="font-mono text-xs text-text-secondary">{confidence}%</span>
          </div>

          <p className="mt-4 text-sm leading-6 text-text-primary">{shown}</p>
          {text.length > 120 ? (
            <button className="mt-1 text-xs text-text-accent hover:underline" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
            {spo.subject ? <span className="rounded border border-glow-blue/20 bg-glow-blue/10 px-2 py-1 text-text-accent">{spo.subject}</span> : null}
            {spo.predicate ? <span className="text-text-tertiary">&rarr; {spo.predicate} &rarr;</span> : null}
            {spo.object ? <span className="rounded border border-glow-emerald/20 bg-glow-emerald/10 px-2 py-1 text-glow-emerald">{spo.object}</span> : null}
          </div>

          <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-void">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${confidence}%` }}
              transition={{ duration: 0.75, delay: index * 0.04 }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}aa)` }}
            />
          </div>

          {claim.reasoning ? <p className="mt-4 text-[13px] leading-6 text-text-secondary">{claim.reasoning}</p> : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-dim pt-3">
            <button className="text-xs text-text-accent hover:underline" onClick={() => onTraceSource(claim.claimId)}>
              Trace to source ^
            </button>
            <button className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary" onClick={() => setEvidenceOpen((value) => !value)}>
              Evidence ({supporting.length + contradicting.length} sources) <ExternalLink className="size-3" />
            </button>
            {claim.numericalValues?.length ? (
              <span className="rounded border border-glow-cyan/20 bg-glow-cyan/10 px-2 py-1 font-mono text-[10px] text-glow-cyan">
                Num: {Math.round((claim.numericalConsistencyScore ?? 0.5) * 100)}%
              </span>
            ) : null}
          </div>

          <AnimatePresence initial={false}>
            {evidenceOpen ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 space-y-2">
                  {supporting.map((item, itemIndex) => <EvidenceChunkCard key={`s-${item.chunkId || itemIndex}`} item={item} tone="support" />)}
                  {contradicting.map((item, itemIndex) => <EvidenceChunkCard key={`c-${item.chunkId || itemIndex}`} item={item} tone="contradict" />)}
                  {!supporting.length && !contradicting.length ? <p className="text-xs text-text-tertiary">Evidence has not streamed in yet.</p> : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </TiltCard>
    </motion.div>
  );
}
