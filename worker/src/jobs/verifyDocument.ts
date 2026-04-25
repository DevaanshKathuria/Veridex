import { Job } from "bullmq";

import axios from "axios";

import { emitToUser } from "../lib/socket";
import Analysis, { AnalysisStatus } from "../models/Analysis";
import Document from "../models/Document";
import PerformanceLog from "../models/PerformanceLog";
import RetrievalLog from "../models/RetrievalLog";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

async function updateAnalysisStatus(analysisId: string, userId: string, status: AnalysisStatus): Promise<void> {
  await Analysis.findByIdAndUpdate(analysisId, {
    status,
    errorMessage: null,
  });

  await emitToUser(userId, "analysis:status", {
    analysisId,
    status,
  });
}

function averageConfidence(verdicts: any[]): number | null {
  if (verdicts.length === 0) {
    return null;
  }
  return verdicts.reduce((sum, verdict) => sum + Number(verdict.confidence ?? 0), 0) / verdicts.length;
}

function averageEvidenceQuality(claims: any[]): number | null {
  const tiers = claims.flatMap((claim) =>
    [...(claim.supportingEvidence ?? []), ...(claim.contradictingEvidence ?? [])].map((evidence: any) =>
      Number(evidence.reliabilityTier ?? 4),
    ),
  );
  if (tiers.length === 0) {
    return null;
  }
  return tiers.reduce((sum, tier) => sum + tier, 0) / tiers.length;
}

export async function processVerificationJob(job: Job): Promise<void> {
  const { analysisId, documentId, userId } = job.data as {
    analysisId: string;
    documentId: string;
    userId: string;
  };
  const startTime = Date.now();

  try {
    const [analysis, doc] = await Promise.all([Analysis.findById(analysisId), Document.findById(documentId)]);

    if (!analysis || !doc) {
      throw new Error("Analysis or document not found");
    }

    await updateAnalysisStatus(analysisId, userId, "RETRIEVING");
    await emitToUser(userId, "analysis:started", {
      analysisId,
      totalClaims: analysis.claims.length,
    });

    const retrievalStart = Date.now();
    const retrievalResult = await axios.post(
      `${ML_SERVICE_URL}/process/retrieve`,
      {
        claims: analysis.claims,
        strategy: "hybrid_reranked",
      },
      { timeout: 60_000 },
    );
    const retrievalLatency = Date.now() - retrievalStart;

    for (const claimId of Object.keys(retrievalResult.data.evidenceMap ?? {})) {
      await RetrievalLog.create({
        analysisId,
        claimId,
        strategy: "hybrid_reranked",
        denseResults: 15,
        bm25Results: 15,
        fusedResults: 20,
        rerankedResults: 6,
        latencyMs: analysis.claims.length > 0 ? retrievalLatency / analysis.claims.length : retrievalLatency,
      });
    }

    await updateAnalysisStatus(analysisId, userId, "RERANKING");
    await updateAnalysisStatus(analysisId, userId, "JUDGING");

    const verifyStart = Date.now();
    const verifyResult = await axios.post(
      `${ML_SERVICE_URL}/process/verify`,
      {
        claims: analysis.claims,
        evidenceMap: retrievalResult.data.evidenceMap,
      },
      { timeout: 120_000 },
    );
    const judgeLatency = Date.now() - verifyStart;

    const updatedClaims = analysis.claims.map((claim: any) => {
      const verdict = verifyResult.data.verdicts.find((item: any) => item.claimId === claim.claimId);
      const evidence = retrievalResult.data.evidenceMap?.[claim.claimId] ?? [];
      if (!verdict) {
        return { ...claim.toObject(), processingStatus: "failed" };
      }

      const supporting = evidence.filter((item: any) =>
        verdict.supportingChunkIds.some((chunkId: string) => item.chunkId === chunkId || chunkId.includes(item.chunkId)),
      );
      const contradicting = evidence.filter((item: any) =>
        verdict.contradictingChunkIds.some((chunkId: string) => item.chunkId === chunkId || chunkId.includes(item.chunkId)),
      );

      void emitToUser(userId, "verdict:ready", {
        analysisId,
        claimId: claim.claimId,
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
      });

      return {
        ...claim.toObject(),
        verdict: verdict.verdict,
        temporalVerdict: verdict.temporalVerdict ?? claim.temporalVerdict ?? null,
        confidence: verdict.confidence,
        reasoning: verdict.reasoning,
        evidenceSufficiency: verdict.evidenceSufficiency,
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        stanceBreakdown: verdict.stanceBreakdown,
        numericalConsistencyScore: verdict.numericalConsistencyScore ?? claim.numericalConsistencyScore ?? null,
        calibrationOverrideApplied: verdict.calibrationOverrideApplied,
        processingStatus: "complete",
      };
    });

    const counts = {
      verifiedCount: updatedClaims.filter((claim: any) => claim.verdict === "VERIFIED").length,
      disputedCount: updatedClaims.filter((claim: any) => claim.verdict === "DISPUTED").length,
      falseCount: updatedClaims.filter((claim: any) => claim.verdict === "FALSE").length,
      unsupportedCount: updatedClaims.filter((claim: any) => claim.verdict === "UNSUPPORTED").length,
      insufficientCount: updatedClaims.filter((claim: any) => claim.verdict === "INSUFFICIENT_EVIDENCE").length,
    };

    await Analysis.findByIdAndUpdate(analysisId, {
      claims: updatedClaims,
      ...counts,
      processingTimeMs: Date.now() - startTime,
      avgConfidence: averageConfidence(verifyResult.data.verdicts ?? []),
      avgEvidenceQuality: averageEvidenceQuality(updatedClaims),
    });

    await updateAnalysisStatus(analysisId, userId, "MANIPULATION");

    const manipResult = await axios.post(
      `${ML_SERVICE_URL}/process/manipulate`,
      {
        originalText: doc.cleanedText,
        claims: updatedClaims,
        verdicts: verifyResult.data.verdicts,
      },
      { timeout: 60_000 },
    );

    await emitToUser(userId, "manipulation:detected", {
      analysisId,
      manipulationTactics: manipResult.data.tacticsDetected,
      overallManipulationScore: manipResult.data.overallManipulationScore,
      manipulationLabel: manipResult.data.manipulationLabel,
    });

    await updateAnalysisStatus(analysisId, userId, "SCORING");

    const scoreStart = Date.now();
    const scoreResult = await axios.post(
      `${ML_SERVICE_URL}/process/score`,
      {
        claims: updatedClaims,
        verdicts: verifyResult.data.verdicts,
        manipulationResult: manipResult.data,
      },
      { timeout: 30_000 },
    );
    const scoringLatency = Date.now() - scoreStart;

    await Analysis.findByIdAndUpdate(analysisId, {
      status: "COMPLETE",
      manipulationTactics: manipResult.data.tacticsDetected,
      credibilityScore: scoreResult.data.credibilityScore,
      confidenceBand: scoreResult.data.confidenceBand,
      credibilityLabel: scoreResult.data.credibilityLabel,
      scoreBreakdown: scoreResult.data.scoreBreakdown,
      summary: scoreResult.data.summary,
      completedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
      errorMessage: null,
    });

    await emitToUser(userId, "analysis:complete", {
      analysisId,
      credibilityScore: scoreResult.data.credibilityScore,
      credibilityLabel: scoreResult.data.credibilityLabel,
      summary: scoreResult.data.summary,
    });

    await PerformanceLog.create({
      analysisId,
      totalLatencyMs: Date.now() - startTime,
      extractionLatencyMs: 0,
      retrievalLatencyMs: retrievalLatency,
      rerankerLatencyMs: 0,
      judgmentLatencyMs: judgeLatency,
      scoringLatencyMs: scoringLatency,
      cacheHitRate: 0,
      claimsCount: analysis.claims.length,
      chunksRetrieved: analysis.claims.length * 6,
      openaiTokensUsed: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    await Analysis.findByIdAndUpdate(analysisId, {
      status: "FAILED",
      errorMessage: message,
    });
    await emitToUser(userId, "analysis:failed", {
      analysisId,
      error: message,
    });
    throw error;
  }
}
