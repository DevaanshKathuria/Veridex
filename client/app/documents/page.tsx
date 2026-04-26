"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { analyzeAPI, documentAPI, ingestAPI } from "@/lib/api";
import type { DocumentDTO } from "@/lib/types";

export default function DocumentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputType, setInputType] = useState("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const query = useQuery<{ documents: DocumentDTO[] }>({
    queryKey: ["documents"],
    queryFn: async () => (await documentAPI.getAll()).data,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  async function upload(event: FormEvent) {
    event.preventDefault();
    const payload =
      file
        ? (() => {
            const form = new FormData();
            form.append("file", file);
            form.append("inputType", inputType);
            return form;
          })()
        : inputType === "url"
          ? { inputType, url }
          : { inputType, text };
    await ingestAPI.create(payload);
    setDialogOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
  }

  async function runAnalysis(documentId: string) {
    const { data } = await analyzeAPI.start(documentId);
    router.push(`/analyses/${data.analysisId || data.analysis?._id}`);
  }

  return (
    <AuthGuard>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Documents</h1>
            <p className="mt-1 text-sm text-text-secondary">Manage ingested source material.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}><Plus className="size-4" /> Upload new document</Button>
        </div>

        {dialogOpen ? (
          <Card className="mb-5 rounded-lg border border-border bg-surface">
            <CardHeader><CardTitle>New document</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={upload} className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {["text", "url", "pdf", "transcript", "tweet", "product"].map((type) => (
                    <button key={type} type="button" onClick={() => setInputType(type)} className={`rounded-md border px-3 py-1.5 text-sm capitalize ${inputType === type ? "border-[#1f6feb] text-[#79c0ff]" : "border-border text-text-secondary"}`}>
                      {type}
                    </button>
                  ))}
                </div>
                {inputType === "url" ? <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL" /> : ["pdf", "transcript"].includes(inputType) ? <Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /> : <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Document text" />}
                <div className="flex gap-2"><Button type="submit">Upload</Button><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button></div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-lg border border-border bg-surface">
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File name</TableHead>
                  <TableHead>Input type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chars</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(query.data?.documents ?? []).map((doc) => (
                  <TableRow key={doc._id}>
                    <TableCell>{doc.fileName || doc.title || "Untitled source"}</TableCell>
                    <TableCell>{doc.inputType || doc.sourceType || "text"}</TableCell>
                    <TableCell><Badge variant="outline">{doc.status}</Badge></TableCell>
                    <TableCell>{doc.charCount ?? "--"}</TableCell>
                    <TableCell>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "--"}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={doc.status !== "READY"} onClick={() => runAnalysis(doc._id)}>
                        {doc.status !== "READY" ? <Loader2 className="size-3 animate-spin" /> : null} Run Analysis
                      </Button>
                      <Button size="icon-sm" variant="destructive" onClick={() => deleteMutation.mutate(doc._id)}><Trash2 className="size-4" /></Button>
                    </TableCell>
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
