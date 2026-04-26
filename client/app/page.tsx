"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Brain, Database, Gauge, ListChecks, Radar, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function CountUp({ value }: { value: number }) {
  const raw = useMotionValue(0);
  const spring = useSpring(raw, { stiffness: 80, damping: 20 });
  const rounded = useTransform(spring, (latest) => Math.round(latest * 10) / 10);
  useEffect(() => raw.set(value), [raw, value]);
  return <motion.span>{rounded}</motion.span>;
}

const features = [
  [ListChecks, "Atomic Claim Extraction", "Breaks long-form text into traceable factual claims."],
  [Database, "Hybrid BM25 + Vector Retrieval", "Combines lexical and semantic evidence search."],
  [Radar, "Cross-Encoder Reranking", "Prioritizes evidence that actually addresses each claim."],
  [Brain, "Temporal Reasoning", "Checks whether facts were true for the right time window."],
  [ShieldAlert, "Manipulation Detection", "Flags loaded language, false dilemmas, and context gaps."],
  [Gauge, "Calibrated Credibility Scoring", "Turns verdicts and evidence quality into a readable score."],
] as const;

export default function LandingPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(3);

  useEffect(() => {
    setRemaining(3 - Number(sessionStorage.getItem("veridex-demo-count") || 0));
  }, []);

  function analyzeDemo() {
    const used = Number(sessionStorage.getItem("veridex-demo-count") || 0);
    if (used >= 3) {
      router.push("/register");
      return;
    }
    sessionStorage.setItem("veridex-demo-text", text);
    sessionStorage.setItem("veridex-demo-count", String(used + 1));
    router.push("/analyze");
  }

  return (
    <div className="bg-background">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl content-center gap-10 px-4 py-16 lg:grid-cols-[1fr_520px] lg:items-center">
        <div>
          <p className="mb-3 text-sm font-medium text-[#79c0ff]">Forensic intelligence dashboard</p>
          <h1 className="text-6xl font-semibold tracking-normal text-text-primary md:text-7xl">Is it true?</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-text-secondary">
            Veridex verifies every factual claim in any text. Powered by hybrid AI retrieval.
          </p>
          <div className="mt-7 flex flex-wrap gap-4 text-sm text-text-secondary">
            <span><CountUp value={2.3} />M claims analyzed</span>
            <span>89% accuracy</span>
            <span>47 sources</span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <Textarea
            className="min-h-48 resize-none bg-background"
            placeholder="Paste any article, speech, or post..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-text-secondary">{Math.max(remaining, 0)} free demo analyses left</span>
            <Button onClick={analyzeDemo} disabled={!text.trim()}>
              Analyze for free <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 md:grid-cols-3">
          {features.map(([Icon, title, description]) => (
            <Card key={title} className="rounded-lg border border-border bg-background">
              <CardContent>
                <Icon className="mb-4 size-5 text-[#79c0ff]" />
                <h2 className="font-semibold text-text-primary">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-3 md:grid-cols-5">
          {["Input Text", "Extract Claims", "Retrieve Evidence", "Judge Claims", "Credibility Score"].map((step, index) => (
            <div key={step} className="rounded-lg border border-border bg-surface p-4 text-sm text-text-primary">
              <span className="mb-2 block text-xs text-text-secondary">0{index + 1}</span>
              {step}
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-4">
          {[
            ["High", "#238636"],
            ["Moderate", "#D29922"],
            ["Low", "#DA3633"],
            ["Very Low", "#7f1d1d"],
          ].map(([label, color]) => (
            <div key={label} className="rounded-lg border border-border bg-surface p-4">
              <span className="block h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="mt-3 block text-sm text-text-primary">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Sign up for unlimited analyses</h2>
            <p className="mt-1 text-sm text-text-secondary">Save reports, track documents, and share completed credibility briefs.</p>
          </div>
          <Button render={<Link href="/register" />}>Create account</Button>
        </div>
      </section>
    </div>
  );
}
