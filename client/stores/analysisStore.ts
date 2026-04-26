import { create } from "zustand";
import type { AnalysisDTO, ClaimDTO, ManipulationTactic, VerdictData } from "@/lib/types";

const stageProgress: Record<string, number> = {
  INGESTING: 10,
  CLEANING: 14,
  SEGMENTING: 20,
  EXTRACTING: 30,
  RETRIEVING: 46,
  RERANKING: 58,
  JUDGING: 70,
  MANIPULATION: 84,
  SCORING: 94,
  COMPLETE: 100,
  FAILED: 100,
};

interface AnalysisStore {
  currentAnalysisId: string | null;
  status: string | null;
  claims: ClaimDTO[];
  credibilityScore: number | null;
  confidenceBand: number | null;
  credibilityLabel: string | null;
  scoreBreakdown: Record<string, number> | null;
  summary: string | null;
  manipulationTactics: ManipulationTactic[];
  manipulationScore: number;
  manipulationLabel: string | null;
  pipelineStage: string | null;
  pipelineSubtext: string | null;
  progress: number;
  highlightedClaimId: string | null;
  error: string | null;
  startAnalysis: (analysisId: string) => void;
  addClaim: (claim: ClaimDTO) => void;
  updateClaimVerdict: (claimId: string, verdict: VerdictData) => void;
  setManipulation: (tactics: ManipulationTactic[], score: number, label: string) => void;
  setComplete: (
    score: number,
    band: number,
    label: string,
    summary: string,
    breakdown?: Record<string, number>
  ) => void;
  setError: (message: string) => void;
  setStatus: (status: string, subtext?: string) => void;
  hydrateAnalysis: (analysis: AnalysisDTO) => void;
  highlightClaim: (claimId: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentAnalysisId: null,
  status: null,
  claims: [],
  credibilityScore: null,
  confidenceBand: null,
  credibilityLabel: null,
  scoreBreakdown: null,
  summary: null,
  manipulationTactics: [],
  manipulationScore: 0,
  manipulationLabel: null,
  pipelineStage: null,
  pipelineSubtext: null,
  progress: 0,
  highlightedClaimId: null,
  error: null,
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  ...initialState,
  startAnalysis: (analysisId) =>
    set({
      ...initialState,
      currentAnalysisId: analysisId,
      status: "EXTRACTING",
      pipelineStage: "EXTRACTING",
      pipelineSubtext: "Extracting atomic claims...",
      progress: stageProgress.EXTRACTING,
    }),
  addClaim: (claim) =>
    set((state) => {
      const exists = state.claims.some((item) => item.claimId === claim.claimId);
      return { claims: exists ? state.claims : [...state.claims, claim] };
    }),
  updateClaimVerdict: (claimId, verdict) =>
    set((state) => {
      const claims = state.claims.map((claim) =>
        claim.claimId === claimId
          ? {
              ...claim,
              verdict: verdict.verdict,
              confidence: verdict.confidence ?? claim.confidence,
              reasoning: verdict.reasoning ?? claim.reasoning,
              temporalVerdict: verdict.temporalVerdict ?? claim.temporalVerdict,
            }
          : claim
      );
      const judged = claims.filter((claim) => claim.verdict).length;
      return {
        claims,
        status: "JUDGING",
        pipelineStage: "JUDGING",
        pipelineSubtext: `Judging claim ${judged} of ${Math.max(claims.length, judged)}...`,
        progress: Math.max(stageProgress.JUDGING, Math.min(82, 70 + judged * 2)),
      };
    }),
  setManipulation: (tactics, score, label) =>
    set({
      manipulationTactics: tactics,
      manipulationScore: score,
      manipulationLabel: label,
      status: "MANIPULATION",
      pipelineStage: "MANIPULATION",
      pipelineSubtext: "Scanning framing, certainty, and emotional loading...",
      progress: stageProgress.MANIPULATION,
    }),
  setComplete: (score, band, label, summary, breakdown = {}) =>
    set({
      credibilityScore: score,
      confidenceBand: band,
      credibilityLabel: label,
      scoreBreakdown: breakdown,
      summary,
      status: "COMPLETE",
      pipelineStage: "COMPLETE",
      pipelineSubtext: "Credibility report complete.",
      progress: 100,
      error: null,
    }),
  setError: (message) =>
    set({
      error: message,
      status: "FAILED",
      pipelineStage: "FAILED",
      pipelineSubtext: message,
      progress: 100,
    }),
  setStatus: (status, subtext) =>
    set({
      status,
      pipelineStage: status,
      pipelineSubtext: subtext ?? status.replaceAll("_", " "),
      progress: stageProgress[status] ?? 50,
    }),
  hydrateAnalysis: (analysis) =>
    set({
      currentAnalysisId: analysis._id || analysis.id || null,
      status: analysis.status,
      claims: analysis.claims ?? [],
      credibilityScore: analysis.credibilityScore ?? null,
      confidenceBand: analysis.confidenceBand ?? null,
      credibilityLabel: analysis.credibilityLabel ?? null,
      scoreBreakdown: analysis.scoreBreakdown ?? null,
      summary: analysis.summary ?? null,
      manipulationTactics: analysis.manipulationTactics ?? [],
      pipelineStage: analysis.status,
      pipelineSubtext: analysis.status === "COMPLETE" ? "Credibility report complete." : analysis.status,
      progress: stageProgress[analysis.status] ?? 100,
    }),
  highlightClaim: (claimId) => set({ highlightedClaimId: claimId }),
  reset: () => set(initialState),
}));
