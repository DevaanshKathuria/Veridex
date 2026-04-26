"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/authStore";

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [confirm, setConfirm] = useState("");

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <Card className="rounded-lg border border-border bg-surface">
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={user?.name ?? ""} readOnly />
            <Input value={user?.email ?? ""} readOnly />
            <Badge className="rounded-md">{user?.plan ?? "FREE"}</Badge>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-border bg-surface">
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" placeholder="Current password" />
            <Input type="password" placeholder="New password" />
            <Input type="password" placeholder="Confirm new password" />
            <Button variant="outline">Update password</Button>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-border bg-surface">
          <CardHeader><CardTitle>Account stats</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
            <span>Total analyses: {user?.analysesCount ?? 0}</span>
            <span>Daily analyses used: {user?.dailyAnalysesUsed ?? 0}</span>
          </CardContent>
        </Card>
        <Card className="rounded-lg border border-[#DA3633]/50 bg-[#DA3633]/10">
          <CardHeader><CardTitle>Danger zone</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-text-secondary">Type your email to enable account deletion.</p>
            <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={user?.email} />
            <Button variant="destructive" disabled={confirm !== user?.email}>Delete account</Button>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
