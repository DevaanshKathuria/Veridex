import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";
import { useAnalysisStore } from "@/stores/analysisStore";

export function useAnalysisSocket() {
  const socketRef = useRef<Socket | null>(null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const addClaim = useAnalysisStore((state) => state.addClaim);
  const updateClaimVerdict = useAnalysisStore((state) => state.updateClaimVerdict);
  const setManipulation = useAnalysisStore((state) => state.setManipulation);
  const setComplete = useAnalysisStore((state) => state.setComplete);
  const setError = useAnalysisStore((state) => state.setError);
  const setStatus = useAnalysisStore((state) => state.setStatus);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", {
      auth: { token: accessToken },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("analysis:started", () => setStatus("RETRIEVING", "Retrieving candidate evidence..."));
    socket.on("analysis:status", ({ status, subtext }) => setStatus(status, subtext));
    socket.on("extraction:complete", ({ claims }) => {
      claims?.forEach((claim: any) => addClaim(claim));
      setStatus("RETRIEVING", "Retrieving candidate evidence...");
    });
    socket.on("verdict:ready", ({ claimId, verdict, confidence, reasoning, temporalVerdict }) => {
      updateClaimVerdict(claimId, { verdict, confidence, reasoning, temporalVerdict });
    });
    socket.on("manipulation:detected", ({ manipulationTactics, overallManipulationScore, manipulationLabel }) => {
      setManipulation(manipulationTactics ?? [], overallManipulationScore ?? 0, manipulationLabel ?? "None");
    });
    socket.on("analysis:complete", ({ credibilityScore, credibilityLabel, summary, scoreBreakdown, confidenceBand }) => {
      setComplete(credibilityScore, confidenceBand, credibilityLabel, summary, scoreBreakdown);
    });
    socket.on("analysis:error", ({ message }) => setError(message || "Analysis failed"));
    socket.on("analysis:failed", ({ message }) => setError(message || "Analysis failed"));
    socket.on("ingestion:complete", () => setStatus("EXTRACTING", "Document is ready. Preparing analysis..."));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, addClaim, setComplete, setError, setManipulation, setStatus, updateClaimVerdict]);

  return socketRef.current;
}
