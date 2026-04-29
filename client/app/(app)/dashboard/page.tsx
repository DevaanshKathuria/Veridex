"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, Trash2 } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { analyzeAPI, statsAPI } from "@/lib/api";
import type { AnalysisDTO, StatsDTO } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";

const pieColors = ["#4D6680", "#00C896", "#F5A623", "#FF6B35", "#FF3B5C"];

function DistributionBar({ analysis }: { analysis: AnalysisDTO }) {
  const total = Math.max((analysis.verifiedCount ?? 0) + (analysis.disputedCount ?? 0) + (analysis.falseCount ?? 0), 1);
  const parts = [
    ["#00C896", analysis.verifiedCount ?? 0],
    ["#F5A623", analysis.disputedCount ?? 0],
    ["#FF3B5C", analysis.falseCount ?? 0],
  ] as const;
  return (
    <div className="flex h-1 w-20 overflow-hidden rounded-full bg-verdict-unsupported-dim">
      {parts.map(([color, value]) => <span key={color} style={{ background: color, width: `${(value / total) * 100}%` }} />)}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const statsQuery = useQuery<StatsDTO>({ queryKey: ["stats"], queryFn: async () => (await statsAPI.get()).data });
  const analysesQuery = useQuery<{ analyses: AnalysisDTO[] }>({ queryKey: ["analyses", "recent"], queryFn: async () => (await analyzeAPI.getAll({ page: 1, limit: 8 })).data });
  const stats = statsQuery.data;
  const analyses = analysesQuery.data?.analyses ?? [];
  const pieData = Object.entries(stats?.manipulationBreakdown ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <AuthGuard>
      <div className="mesh-bg min-h-[calc(100vh-52px)] px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">Command center</p>
              <h1 className="mt-2 text-3xl text-text-primary">Welcome back, {user?.name}</h1>
            </div>
            <MagneticButton onClick={() => location.assign("/analyze")}>New analysis</MagneticButton>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {([
              ["Total analyses", stats?.totalAnalyses ?? 0, "#4D9FFF", "+12% this week"],
              ["Avg score", Math.round(stats?.avgCredibilityScore ?? 0), "#00C896", "+4 pts trend"],
              ["Claims verified", stats?.verifiedTotal ?? 0, "#00C2FF", "+218 claims"],
              ["False caught", stats?.falseTotal ?? 0, "#FF3B5C", "+9 this week"],
            ] as Array<[string, number, string, string]>).map(([label, value, accent, trend]) => (
              <div key={label} className="rounded-[10px] border border-border-dim bg-surface p-6" style={{ borderLeft: `2px solid ${accent}` }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
                <p className="mt-3 font-mono text-4xl text-text-primary">{value}</p>
                <p className="mt-3 text-xs" style={{ color: accent }}>{trend}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-[10px] border border-border-dim bg-surface p-5">
              <h2 className="mb-4 text-lg text-text-primary">Credibility trend</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.credibilityTrend ?? []}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#0066FF" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#0066FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#3D5270", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#3D5270", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#111820", border: "1px solid #2A3F5C", color: "#E8EFF8", backdropFilter: "blur(20px)" }} />
                    <Area type="monotone" dataKey="score" stroke="#4D9FFF" strokeWidth={2} fill="url(#scoreFill)" dot={{ r: 3, fill: "#4D9FFF", stroke: "#E8EFF8", strokeWidth: 1 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-[10px] border border-border-dim bg-surface p-5">
              <h2 className="mb-4 text-lg text-text-primary">Manipulation breakdown</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88}>
                      {pieData.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#111820", border: "1px solid #2A3F5C", color: "#E8EFF8" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[10px] border border-border-dim bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg text-text-primary">Recent analyses</h2>
              <span className="font-mono text-[11px] text-text-tertiary">{analyses.length} records</span>
            </div>
            <div>
              {analyses.map((analysis) => (
                <div key={analysis._id} className="group grid gap-3 border-b border-border-dim py-4 transition-colors duration-100 hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_100px_120px_100px_100px_80px] md:items-center">
                  <p className="truncate text-sm text-text-primary">{analysis.inputSnippet || "Analysis report"}</p>
                  <DistributionBar analysis={analysis} />
                  <p className="font-mono text-sm text-text-primary">{analysis.credibilityScore ?? "--"}/100</p>
                  <span className="w-fit rounded border border-glow-emerald/25 bg-glow-emerald/10 px-2 py-1 font-mono text-[10px] uppercase text-glow-emerald">{analysis.status}</span>
                  <span className="text-xs text-text-tertiary">{analysis.createdAt ? new Date(analysis.createdAt).toLocaleDateString() : "--"}</span>
                  <span className="flex gap-2 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                    <Link href={`/analyses/${analysis._id}`} className="text-text-secondary hover:text-text-primary"><Eye className="size-4" /></Link>
                    <button className="text-text-secondary hover:text-verdict-false"><Trash2 className="size-4" /></button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
