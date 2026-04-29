"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Highlighter from "react-highlight-words";
import { FileUp, Link2, MessageSquare, Package, ScrollText, Sparkles, Type } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ClaimCard } from "@/components/analysis/ClaimCard";
import { CredibilityGauge } from "@/components/analysis/CredibilityGauge";
import { ManipulationWarning } from "@/components/analysis/ManipulationWarning";
import { PipelineProgress } from "@/components/analysis/PipelineProgress";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysisSocket } from "@/hooks/useAnalysisSocket";
import { analyzeAPI, documentAPI, ingestAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/stores/analysisStore";

const inputTypes = [
  { key: "text", label: "Text", icon: Type },
  { key: "url", label: "URL", icon: Link2 },
  { key: "pdf", label: "PDF", icon: FileUp },
  { key: "transcript", label: "Transcript", icon: ScrollText },
  { key: "tweet", label: "Tweet", icon: MessageSquare },
  { key: "product", label: "Product", icon: Package },
];

export default function AnalyzePage() {
  useAnalysisSocket();
  const [inputType, setInputType] = useState("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cleanedText, setCleanedText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);
  const store = useAnalysisStore();
  const hydrateAnalysis = useAnalysisStore((state) => state.hydrateAnalysis);

  useEffect(() => {
    const demo = sessionStorage.getItem("veridex-demo-text");
    if (demo) {
      setText(demo);
      sessionStorage.removeItem("veridex-demo-text");
    }
  }, []);

  useEffect(() => {
    if (store.status !== "COMPLETE" || !store.currentAnalysisId) return;
    analyzeAPI.getOne(store.currentAnalysisId).then(({ data }) => hydrateAnalysis(data)).catch(() => undefined);
  }, [hydrateAnalysis, store.status, store.currentAnalysisId]);

  const highlights = useMemo(
    () => [...store.claims.map((claim) => claim.text).filter(Boolean), ...store.manipulationTactics.map((tactic) => tactic.excerpt).filter(Boolean)],
    [store.claims, store.manipulationTactics]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    store.reset();
    try {
      const payload =
        file && ["pdf", "transcript"].includes(inputType)
          ? (() => {
              const form = new FormData();
              form.append("file", file);
              form.append("inputType", inputType);
              return form;
            })()
          : inputType === "url"
            ? { inputType, url }
            : { inputType, text };
      store.setStatus("INGESTING", "Cleaning and segmenting the source...");
      const ingest = await ingestAPI.create(payload);
      const documentId = ingest.data.documentId || ingest.data.document?._id;
      if (!documentId) throw new Error("Ingestion did not return a document id");
      const doc = await documentAPI.getOne(documentId).catch(() => null);
      setCleanedText(doc?.data?.cleanedText || text || url);
      const analysis = await analyzeAPI.start(documentId);
      const analysisId = analysis.data.analysisId || analysis.data.analysis?._id;
      store.startAnalysis(analysisId);
      const full = await analyzeAPI.getOne(analysisId).catch(() => null);
      if (full?.data) store.hydrateAnalysis(full.data);
    } catch (error: unknown) {
      const maybeError = error as { response?: { data?: { error?: string } }; message?: string };
      store.setError(maybeError.response?.data?.error || maybeError.message || "Analysis failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function traceClaim(claimId: string) {
    store.highlightClaim(claimId);
    sourceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => store.highlightClaim(null), 1400);
  }

  return (
    <AuthGuard>
      <div className="min-h-[calc(100vh-52px)] bg-obsidian">
        <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[55fr_45fr]">
          <section className="border-border-dim p-4 lg:min-h-[calc(100vh-52px)] lg:border-r lg:p-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="rounded-lg border border-border-dim bg-void p-1">
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
                  {inputTypes.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className={cn("flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-xs text-text-secondary transition-all duration-150", inputType === key ? "border-border-default bg-surface-2 text-text-primary" : "border-transparent hover:bg-surface hover:text-text-primary")}
                      onClick={() => setInputType(key)}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {["text", "tweet", "product"].includes(inputType) ? (
                <div className="overflow-hidden rounded-lg border border-border-dim bg-void focus-within:border-glow-blue/60 focus-within:ring-4 focus-within:ring-glow-blue/10">
                  <Textarea className="max-h-[420px] min-h-72 resize-y border-0 bg-transparent font-mono text-sm leading-7 focus-visible:ring-0" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste text to verify..." />
                  <p className="border-t border-border-dim px-4 py-2 text-right font-mono text-[11px] text-text-tertiary">{text.length.toLocaleString()} chars</p>
                </div>
              ) : inputType === "url" ? (
                <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" />
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-dim bg-void p-10 text-center text-sm text-text-secondary transition-colors hover:border-border-bright">
                  <FileUp className="mb-3 size-6 text-text-accent" />
                  {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Drop a file here or click to upload"}
                  <input className="hidden" type="file" accept={inputType === "pdf" ? "application/pdf" : ".txt,.vtt,.srt"} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
              )}
              <MagneticButton disabled={isSubmitting} className="w-full">
                {isSubmitting ? <span className="shimmer h-4 w-28 rounded" /> : <>Analyze <Sparkles className="size-4" /></>}
              </MagneticButton>
            </form>

            <div className="mt-5">{store.status ? <PipelineProgress status={store.pipelineStage} subtext={store.pipelineSubtext} claimsTotal={store.claims.length} progress={store.progress} /> : null}</div>

            {cleanedText ? (
              <div className={cn("mt-5 rounded-lg border border-border-dim bg-surface p-5", store.highlightedClaimId && "border-glow-blue bg-glow-blue/5")}>
                <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Original text</h2>
                <div ref={sourceRef} className="max-h-[520px] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                  <Highlighter searchWords={highlights} autoEscape textToHighlight={cleanedText} highlightClassName="rounded bg-manipulation/20 text-text-primary" />
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4 p-4 lg:max-h-[calc(100vh-52px)] lg:overflow-y-auto lg:p-6">
            {!store.status ? (
              <div className="mesh-bg grid-pattern flex min-h-[520px] items-center justify-center rounded-[10px] border border-border-dim text-center">
                <div className="max-w-xs">
                  <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-xl border border-dashed border-border-bright bg-void/70">
                    <Sparkles className="size-6 text-text-accent" />
                  </div>
                  <p className="font-mono text-[13px] text-text-tertiary">Submit text to begin analysis</p>
                </div>
              </div>
            ) : (
              <>
                {store.credibilityScore !== null ? <CredibilityGauge score={store.credibilityScore} band={store.confidenceBand ?? 0} label={store.credibilityLabel ?? "Unknown"} scoreBreakdown={store.scoreBreakdown} /> : <div className="space-y-3 rounded-lg border border-border-dim bg-surface p-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-24 w-full" /></div>}
                <ManipulationWarning tactics={store.manipulationTactics} overallScore={store.manipulationScore} label={store.manipulationLabel ?? "None"} />
                <Separator className="bg-border-dim" />
                <div className="space-y-2">
                  {store.claims.length ? store.claims.map((claim, index) => <ClaimCard key={claim.claimId || index} claim={claim} index={index} onTraceSource={traceClaim} />) : [0, 1, 2].map((item) => <Skeleton key={item} className="h-36 w-full" />)}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AuthGuard>
  );
}
