"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Share2 } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ClaimCard } from "@/components/analysis/ClaimCard";
import { CredibilityGauge } from "@/components/analysis/CredibilityGauge";
import { ManipulationWarning } from "@/components/analysis/ManipulationWarning";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { analyzeAPI } from "@/lib/api";
import type { AnalysisDTO } from "@/lib/types";
import { useState } from "react";

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const query = useQuery<AnalysisDTO>({
    queryKey: ["analysis", params.id],
    queryFn: async () => (await analyzeAPI.getOne(params.id)).data,
  });
  const analysis = query.data;

  return (
    <AuthGuard>
      <div className="mesh-bg min-h-[calc(100vh-52px)] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="size-4" /> Back</Button>
          <Button variant="outline" className={copied ? "border-glow-emerald text-glow-emerald" : ""} onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check className="size-4" /> : <Share2 className="size-4" />} {copied ? "Copied!" : "Share"}</Button>
        </div>
        {query.isLoading || !analysis ? (
          <div className="space-y-3"><Skeleton className="h-56 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : (
          <div className="space-y-4">
            {analysis.credibilityScore !== undefined ? (
              <CredibilityGauge score={analysis.credibilityScore} band={analysis.confidenceBand ?? 0} label={analysis.credibilityLabel ?? "Unknown"} scoreBreakdown={analysis.scoreBreakdown} />
            ) : null}
            {analysis.summary ? <p className="rounded-[10px] border border-border-dim bg-surface p-4 text-sm leading-6 text-text-secondary">{analysis.summary}</p> : null}
            <ManipulationWarning tactics={analysis.manipulationTactics ?? []} overallScore={analysis.manipulationTactics?.length ? 50 : 0} label="Detected" />
            <div className="space-y-3">
              {(analysis.claims ?? []).map((claim, index) => (
                <ClaimCard key={claim.claimId || index} claim={claim} index={index} onTraceSource={() => undefined} />
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </AuthGuard>
  );
}
