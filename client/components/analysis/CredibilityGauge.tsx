"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const toPoint = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const s = toPoint(start);
  const e = toPoint(end);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

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
  const raw = useMotionValue(0);
  const spring = useSpring(raw, { stiffness: 70, damping: 18 });
  const display = useTransform(spring, (value) => Math.round(value));
  const color = score >= 70 ? "#00C896" : score >= 40 ? "#F5A623" : "#FF3B5C";
  const numberColor = useTransform(spring, [0, score || 1], ["#E8EFF8", color]);
  const circumference = 270;
  const dash = useTransform(spring, (value) => `${(Math.max(0, Math.min(value, 100)) / 100) * circumference} ${circumference}`);
  const bars = Object.entries(scoreBreakdown || {}).slice(0, 4);

  useEffect(() => {
    raw.set(score);
  }, [raw, score]);

  return (
    <div className="glass-card rounded-[10px] p-5">
      <div className="relative mx-auto h-72 max-w-sm">
        <svg viewBox="0 0 220 220" className="h-full w-full">
          <path d={arcPath(110, 112, 88, -135, 135)} fill="none" stroke="#1A2535" strokeWidth="1" strokeLinecap="round" />
          <path d={arcPath(110, 112, 96, -135, 135)} fill="none" stroke={color} strokeWidth="1" opacity="0.22" strokeLinecap="round" />
          <motion.path
            d={arcPath(110, 112, 82, -135, 135)}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={270}
            style={{ strokeDasharray: dash, filter: `drop-shadow(0 0 14px ${color}66)` }}
          />
          <path d={arcPath(110, 112, 66, -135, -25)} fill="none" stroke="#00C896" strokeWidth="3" opacity="0.8" />
          <path d={arcPath(110, 112, 66, -20, 45)} fill="none" stroke="#F5A623" strokeWidth="3" opacity="0.75" />
          <path d={arcPath(110, 112, 66, 52, 135)} fill="none" stroke="#FF3B5C" strokeWidth="3" opacity="0.65" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <div className="flex items-end gap-1 font-mono">
            <motion.span className="text-6xl font-medium leading-none" style={{ color: numberColor }}>{display}</motion.span>
            <span className="pb-2 text-xl text-text-tertiary">/100</span>
          </div>
          <span className="mt-3 rounded-md border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color, borderColor: `${color}55`, background: `${color}12` }}>
            {label}
          </span>
          <span className="mt-2 font-mono text-xs text-text-tertiary">+/-{band}</span>
        </div>
      </div>
      <div className="space-y-3">
        {bars.map(([name, value], index) => {
          const barColor = ["#00C896", "#4D9FFF", "#FF6B35", "#F5A623"][index % 4];
          return (
            <div key={name}>
              <div className="mb-1 flex justify-between gap-3 font-mono text-[11px] text-text-tertiary">
                <span>{name.replace(/([A-Z])/g, " $1").replace("Contribution", "").trim()}</span>
                <span>{Number(value).toFixed(1)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-void">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Math.abs(Number(value)), 100)}%` }}
                  transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${barColor}, ${barColor}aa)` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
