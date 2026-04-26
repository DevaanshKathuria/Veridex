"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyzeAPI, statsAPI } from "@/lib/api";
import type { AnalysisDTO, StatsDTO } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";

const pieColors = ["#6E7681", "#238636", "#D29922", "#E85D04", "#DA3633"];

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const statsQuery = useQuery<StatsDTO>({
    queryKey: ["stats"],
    queryFn: async () => (await statsAPI.get()).data,
  });
  const analysesQuery = useQuery<{ analyses: AnalysisDTO[] }>({
    queryKey: ["analyses", "recent"],
    queryFn: async () => (await analyzeAPI.getAll({ page: 1, limit: 8 })).data,
  });
  const stats = statsQuery.data;
  const analyses = analysesQuery.data?.analyses ?? [];
  const pieData = Object.entries(stats?.manipulationBreakdown ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <AuthGuard>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Welcome back, {user?.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">Your credibility operations dashboard.</p>
          </div>
          <Button render={<Link href="/analyze" />}>New analysis</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Total Analyses", stats?.totalAnalyses ?? 0],
            ["Avg Credibility Score", Math.round(stats?.avgCredibilityScore ?? 0)],
            ["Claims Verified", stats?.verifiedTotal ?? 0],
            ["False Claims Caught", stats?.falseTotal ?? 0],
          ].map(([label, value]) => (
            <Card key={label} className="rounded-lg border border-border bg-surface">
              <CardContent>
                <p className="text-sm text-text-secondary">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-text-primary">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="rounded-lg border border-border bg-surface">
            <CardHeader><CardTitle>Credibility trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.credibilityTrend ?? []}>
                  <XAxis dataKey="date" tick={{ fill: "#8B949E", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#8B949E", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#161B22", border: "1px solid #30363D" }} />
                  <Line type="monotone" dataKey="score" stroke="#238636" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="rounded-lg border border-border bg-surface">
            <CardHeader><CardTitle>Manipulation breakdown</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                    {pieData.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#161B22", border: "1px solid #30363D" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 rounded-lg border border-border bg-surface">
          <CardHeader><CardTitle>Recent analyses</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credibility</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.map((analysis) => (
                  <TableRow key={analysis._id}>
                    <TableCell className="max-w-64 truncate">{analysis.inputSnippet || "Analysis report"}</TableCell>
                    <TableCell><Badge variant="outline">{analysis.status}</Badge></TableCell>
                    <TableCell>{analysis.credibilityScore ?? "--"} {analysis.credibilityLabel ? `(${analysis.credibilityLabel})` : ""}</TableCell>
                    <TableCell>{analysis.verifiedCount ?? 0}/{analysis.disputedCount ?? 0}/{analysis.falseCount ?? 0}</TableCell>
                    <TableCell>{analysis.createdAt ? new Date(analysis.createdAt).toLocaleDateString() : "--"}</TableCell>
                    <TableCell><Button size="sm" variant="outline" render={<Link href={`/analyses/${analysis._id}`} />}>View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
