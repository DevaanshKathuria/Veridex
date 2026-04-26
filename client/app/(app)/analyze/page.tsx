"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Highlighter from "react-highlight-words";
import { FileUp, Loader2, Send } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ClaimCard } from "@/components/analysis/ClaimCard";
import { CredibilityGauge } from "@/components/analysis/CredibilityGauge";
import { ManipulationWarning } from "@/components/analysis/ManipulationWarning";
import { PipelineProgress } from "@/components/analysis/PipelineProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysisSocket } from "@/hooks/useAnalysisSocket";
import { analyzeAPI, documentAPI, ingestAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/stores/analysisStore";

const inputTypes = ["text", "url", "pdf", "transcript", "tweet", "product"];

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
    () => [
      ...store.claims.map((claim) => claim.text).filter(Boolean),
      ...store.manipulationTactics.map((tactic) => tactic.excerpt).filter(Boolean),
    ],
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
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[55fr_45fr]">
        <section className="space-y-5">
          <Card className="rounded-lg border border-border bg-surface">
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {inputTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm capitalize",
                        inputType === type ? "border-[#1f6feb] bg-[#1f6feb]/15 text-[#79c0ff]" : "border-border text-text-secondary"
                      )}
                      onClick={() => setInputType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {["text", "tweet", "product"].includes(inputType) ? (
                  <div>
                    <Textarea className="max-h-[400px] min-h-60 resize-y bg-background" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste text to verify..." />
                    <p className="mt-2 text-xs text-text-secondary">{text.length.toLocaleString()} characters</p>
                  </div>
                ) : inputType === "url" ? (
                  <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" />
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm text-text-secondary">
                    <FileUp className="mb-2 size-6" />
                    {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Drop a file here or click to upload"}
                    <input className="hidden" type="file" accept={inputType === "pdf" ? "application/pdf" : ".txt,.vtt,.srt"} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                  </label>
                )}
                <Button disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Analyze text
                </Button>
              </form>
            </CardContent>
          </Card>

          {store.status ? <PipelineProgress status={store.pipelineStage} subtext={store.pipelineSubtext} claimsTotal={store.claims.length} progress={store.progress} /> : null}

          {cleanedText ? (
            <Card className={cn("rounded-lg border border-border bg-surface", store.highlightedClaimId && "ring-2 ring-[#1f6feb]")}>
              <CardContent>
                <h2 className="mb-3 text-sm font-semibold text-text-primary">Original text</h2>
                <div ref={sourceRef} className="max-h-[520px] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                  <Highlighter searchWords={highlights} autoEscape textToHighlight={cleanedText} highlightClassName="rounded bg-[#E85D04]/25 text-text-primary" />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>

        <section className="space-y-4">
          {!store.status ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-border bg-surface text-center">
              <div>
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-surface-2">
                  <Send className="size-6 text-[#79c0ff]" />
                </div>
                <p className="font-medium text-text-primary">Your analysis will appear here</p>
                <p className="mt-1 text-sm text-text-secondary">Submit text, a URL, or a document to begin.</p>
              </div>
            </div>
          ) : (
            <>
              {store.credibilityScore !== null ? (
                <CredibilityGauge score={store.credibilityScore} band={store.confidenceBand ?? 0} label={store.credibilityLabel ?? "Unknown"} scoreBreakdown={store.scoreBreakdown} />
              ) : (
                <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}
              <ManipulationWarning tactics={store.manipulationTactics} overallScore={store.manipulationScore} label={store.manipulationLabel ?? "None"} />
              <Separator />
              <div className="max-h-[calc(100vh-8rem)] space-y-3 overflow-y-auto pr-1">
                {store.claims.length ? store.claims.map((claim, index) => <ClaimCard key={claim.claimId || index} claim={claim} index={index} onTraceSource={traceClaim} />) : [0, 1, 2].map((item) => <Skeleton key={item} className="h-36 w-full" />)}
              </div>
            </>
          )}
        </section>
      </div>
    </AuthGuard>
  );
}
