"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Brain, Database, Gauge, ListChecks, Radar, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { TiltCard } from "@/components/motion/TiltCard";
import { fadeUp, staggerContainer } from "@/lib/animations";

function CountUp({ value }: { value: number }) {
  const raw = useMotionValue(0);
  const spring = useSpring(raw, { stiffness: 70, damping: 18 });
  const display = useTransform(spring, (latest) => Math.round(latest * 10) / 10);
  useEffect(() => raw.set(value), [raw, value]);
  return <motion.span>{display}</motion.span>;
}

function LogoReveal() {
  return (
    <div className="flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-[0.18em] text-text-primary">
      {"VERIDEX".split("").map((letter, index) => (
        <motion.span key={`${letter}-${index}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
          {letter}
        </motion.span>
      ))}
      <span className="size-1.5 rounded-full bg-glow-emerald animate-pulse-glow" />
    </div>
  );
}

const features = [
  [ListChecks, "Atomic Claim Extraction", "Every factual unit is separated, normalized, and traced.", "#4D9FFF"],
  [Database, "Hybrid BM25 + Vector Retrieval", "Exact entities meet semantic recall across the evidence graph.", "#00C2FF"],
  [Radar, "Cross-Encoder Reranking", "Claim-evidence pairs are scored jointly for surgical relevance.", "#7C3AED"],
  [Brain, "Temporal Reasoning", "Verdicts understand when a claim was supposed to be true.", "#00C896"],
  [ShieldAlert, "Manipulation Detection", "Loaded framing, missing context, and fear appeals are surfaced.", "#FF6B35"],
  [Gauge, "Calibrated Credibility Score", "A compact signal blends verdicts, evidence quality, and risk.", "#F5A623"],
] as const;

export default function LandingPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, -70]);
  const fieldY = useTransform(scrollY, [0, 700], [0, -210]);

  function analyzeDemo() {
    sessionStorage.setItem("veridex-demo-text", text);
    router.push("/analyze");
  }

  return (
    <div className="bg-void">
      <section className="mesh-bg grid-pattern relative flex min-h-[calc(100vh-52px)] items-center justify-center overflow-hidden px-4 py-20">
        <motion.div className="ambient-field absolute inset-0" style={{ y: fieldY }} />
        <motion.div className="relative z-10 mx-auto max-w-5xl text-center" style={{ y: heroY }}>
          <LogoReveal />
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="mt-8">
            <motion.div variants={fadeUp} className="conic-pill mx-auto inline-flex rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary">
              Real-time AI fact verification
            </motion.div>
            <motion.h1 variants={fadeUp} className="mx-auto mt-7 max-w-4xl text-6xl font-medium leading-[0.96] text-text-primary md:text-7xl">
              Every claim.
              <br />
              <span className="gradient-text">Verified.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-xl text-lg leading-8 text-text-secondary">
              Veridex extracts every factual claim, retrieves evidence from 500+ sources, and delivers calibrated verdicts in real time.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap justify-center gap-3">
              <MagneticButton onClick={() => router.push("/analyze")}>
                Start analyzing <Sparkles className="size-4" />
              </MagneticButton>
              <Link href="#capabilities" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-default px-4 text-sm text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary">
                View architecture <ArrowRight className="ml-2 size-4" />
              </Link>
            </motion.div>
          </motion.div>

          <div className="mx-auto mt-11 grid max-w-2xl grid-cols-3 divide-x divide-border-dim border-y border-border-dim py-5">
            {[
              ["2.3", "M", "Claims analyzed"],
              ["500", "+", "Evidence sources"],
              ["89", "%", "Accuracy vs human fact-checkers"],
            ].map(([number, suffix, label]) => (
              <div key={label} className="px-4">
                <div className="font-mono text-2xl text-text-primary"><CountUp value={Number(number)} />{suffix}</div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{label}</div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-[700px] overflow-hidden rounded-[10px] border border-border-dim bg-surface text-left focus-within:border-glow-blue/40 focus-within:shadow-[0_0_0_3px_rgba(0,102,255,0.08)]">
            <textarea
              className="min-h-36 w-full resize-none bg-transparent p-4 font-mono text-sm leading-7 text-text-primary outline-none placeholder:text-text-tertiary"
              placeholder="Paste any article, speech, tweet, or report to verify..."
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex items-center justify-between border-t border-border-dim px-4 py-3">
              <span className="font-mono text-[11px] text-text-tertiary">{text.length.toLocaleString()} chars</span>
              <button className="text-sm text-text-accent transition-colors hover:text-glow-cyan disabled:text-text-tertiary" disabled={!text.trim()} onClick={analyzeDemo}>
                Analyze &rarr;
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      <section id="capabilities" className="bg-void py-28">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Capabilities</p>
          <h2 className="mt-3 text-5xl text-text-primary">Built for real intelligence</h2>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer} className="animated-grid grid-pattern mt-10 grid gap-4 md:grid-cols-3">
            {features.map(([Icon, title, description, accent], index) => (
              <motion.div key={title} variants={fadeUp}>
                <TiltCard className="group rounded-xl border border-border-dim bg-surface p-7 hover:bg-surface-2" style={{ borderTopColor: accent }}>
                  <div className="relative z-10">
                    <div className="mb-6 flex items-center justify-between">
                      <Icon className="size-[18px]" style={{ color: accent }} />
                      <span className="font-mono text-[11px] text-text-tertiary">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="text-[15px] text-text-primary">{title}</h3>
                    <p className="mt-3 text-[13px] leading-6 text-text-secondary">{description}</p>
                    <span className="mt-6 inline-block text-sm" style={{ color: accent }}>&rarr;</span>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="bg-surface py-28">
        <div className="mx-auto max-w-7xl px-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Protocol</p>
          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {["Input text", "Extract claims", "Retrieve evidence", "Judge claims", "Score credibility"].map((step, index) => (
              <div key={step} className="group relative border-t border-dashed border-border-dim pt-8">
                <div className="font-mono text-5xl text-text-tertiary/30 transition-opacity group-hover:text-text-tertiary/60">{String(index + 1).padStart(2, "0")}</div>
                <div className="mt-4 flex size-10 items-center justify-center rounded-full border border-border-default bg-surface-2 transition-colors group-hover:border-glow-blue">
                  <Sparkles className="size-4 text-text-accent" />
                </div>
                <h3 className="mt-4 text-sm text-text-primary">{step}</h3>
                <p className="mt-2 text-xs leading-5 text-text-secondary">A deterministic stage in the evidence verification chain.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
