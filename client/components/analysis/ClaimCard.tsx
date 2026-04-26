"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VerdictBadge } from "@/components/analysis/VerdictBadge";
import type { ClaimDTO, EvidenceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

function EvidenceList({ evidence, tone }: { evidence: EvidenceChunk[]; tone: "support" | "contradict" }) {
  if (!evidence?.length) return <p className="text-xs text-text-secondary">No evidence chunks returned.</p>;
  return (
    <div className="space-y-2">
      {evidence.map((item, index) => (
        <div
          key={`${item.chunkId || item.source || "evidence"}-${index}`}
          className={cn(
            "rounded-md border bg-surface-2 p-3",
            tone === "contradict" ? "border-verdict-false/40" : "border-verdict-verified/30"
          )}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-primary">{item.sourceName || item.source || "Evidence source"}</span>
            <span className="flex items-center gap-2 text-[11px] text-text-secondary">
              <Badge variant="outline" className="h-5 rounded-md border-border bg-background">
                T{item.reliabilityTier ?? 4}
              </Badge>
              {item.publicationDate ? new Date(item.publicationDate).toLocaleDateString() : null}
            </span>
          </div>
          <p className="text-xs leading-5 text-text-secondary">{(item.excerpt || item.chunkText || "").slice(0, 180)}</p>
          <div className="mt-3 grid gap-2 text-[11px] text-text-secondary sm:grid-cols-2">
            <span>Rerank {Math.round((item.rerankerScore ?? 0) * 100)}%</span>
            <span>NLI {Math.round((item.nliScore ?? 0) * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClaimCard({
  claim,
  index,
  onTraceSource,
}: {
  claim: ClaimDTO;
  index: number;
  onTraceSource: (claimId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const text = claim.text || claim.sentence || "";
  const shownText = expanded || text.length <= 120 ? text : `${text.slice(0, 120)}...`;
  const spo = claim.spo || { subject: claim.subject, predicate: claim.predicate, object: claim.object };
  const supporting = claim.supportingEvidence ?? [];
  const contradicting = claim.contradictingEvidence ?? [];
  const confidence = Math.round(claim.confidence ?? 0);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.6) }}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VerdictBadge verdict={claim.verdict || "UNSUPPORTED"} temporalVerdict={claim.temporalVerdict} />
        <div className="flex min-w-36 items-center gap-2 text-xs text-text-secondary">
          <Progress value={confidence} className="w-24" />
          {confidence}%
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-text-primary">{shownText}</p>
      {text.length > 120 ? (
        <button className="mt-1 text-xs text-[#79c0ff]" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {spo.subject ? <Badge className="rounded-md bg-[#6f42c1]/25 text-[#d2a8ff]">S: {spo.subject}</Badge> : null}
        {spo.predicate ? <Badge variant="secondary" className="rounded-md">P: {spo.predicate}</Badge> : null}
        {spo.object ? <Badge className="rounded-md bg-[#2ea043]/20 text-[#7ee787]">O: {spo.object}</Badge> : null}
        {claim.numericalValues?.length ? (
          <Badge variant="outline" className="rounded-md border-[#1f6feb]/40 text-[#79c0ff]">
            Numerical: {Math.round((claim.numericalConsistencyScore ?? 0.5) * 100)}%
          </Badge>
        ) : null}
      </div>
      {claim.reasoning ? <p className="mt-3 text-sm leading-6 text-text-secondary">{claim.reasoning}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onTraceSource(claim.claimId)}>
          <Search className="size-3.5" />
          Trace to source
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEvidenceOpen((value) => !value)}>
          <ExternalLink className="size-3.5" />
          Evidence ({supporting.length} supporting, {contradicting.length} contradicting)
        </Button>
      </div>
      {evidenceOpen ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <EvidenceList evidence={supporting} tone="support" />
          <EvidenceList evidence={contradicting} tone="contradict" />
        </div>
      ) : null}
    </motion.article>
  );
}
