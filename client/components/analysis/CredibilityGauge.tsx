"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { Bar, BarChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";

export function CredibilityGauge({
  score,
  band,
  label,
  scoreBreakdown,
}: {
  score: number;
  band: number;
  label: string;
  scoreBreakdown?: Record<string, number> | null;
}) {
  const motionScore = useMotionValue(0);
  const springScore = useSpring(motionScore, { stiffness: 80, damping: 18 });
  const display = useTransform(springScore, (latest) => Math.round(latest));
  const color = score >= 70 ? "#238636" : score >= 40 ? "#D29922" : "#DA3633";
  const bars = Object.entries(scoreBreakdown || {}).map(([name, value]) => ({
    name: name.replace(/([A-Z])/g, " $1").replace("Contribution", "").trim(),
    value: Number(value),
  }));

  useEffect(() => {
    motionScore.set(score);
  }, [motionScore, score]);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="relative mx-auto h-56 max-w-sm">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="55%" innerRadius="68%" outerRadius="88%" data={[{ value: score }]} startAngle={180} endAngle={-180}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill: "#30363D" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <motion.div className="text-6xl font-semibold tabular-nums text-text-primary">{display}</motion.div>
          <div className="text-sm text-text-secondary">+/-{band}</div>
          <Badge variant="outline" className="mt-2 rounded-md border-border bg-surface-2 text-text-primary">
            {label}
          </Badge>
        </div>
      </div>
      {bars.length ? (
        <div className="mt-4 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} layout="vertical" margin={{ left: 0, right: 12 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={120} tick={{ fill: "#8B949E", fontSize: 11 }} />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
