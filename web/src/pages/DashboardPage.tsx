import { useState } from "react";
import { Link } from "wouter";
import { createJob } from "@/lib/api";
import { useJobs } from "@/hooks/useJobs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { QuotaBanner } from "@/components/QuotaBanner";
import { Activity, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Notice = { kind: "info" | "error" | "quota"; message: string } | null;

export default function DashboardPage() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const { jobs, refresh } = useJobs({ limit: 6, pollInterval: 6000 });

  const [importConfig, setImportConfig] = useState({ dryRun: true, limit: "" });
  const [syncConfig, setSyncConfig] = useState({ dryRun: true, limit: "" });
  const [prospectsConfig, setProspectsConfig] = useState({
    dryRun: true,
    zipcode: "19505",
    radius: "20",
    categories: "Dentist Office,Medical/Healthcare Office",
    limit: "50"
  });
  const [researchConfig, setResearchConfig] = useState({
    dryRun: true,
    status: "Not Started",
    limit: "20"
  });

  const runJob = async (action: string, params: Record<string, any>, label: string) => {
    setLoading(action);
    setNotice(null);
    try {
      const response = await createJob(action, params);
      if (response?.job?.id) {
        setNotice({ kind: "info", message: `${label} queued (Job ${response.job.id}).` });
      }
      refresh();
      qc.invalidateQueries({ queryKey: ["usage"] });
    } catch (err: any) {
      if (err?.status === 402 && err?.data?.error === "quota_exceeded") {
        const kind = err.data.kind === "enrichments" ? "enrichments" : "prospects";
        setNotice({
          kind: "quota",
          message: `${label} exceeds your ${kind} quota for the period. Upgrade plan or buy credits.`
        });
      } else if (err?.status === 412) {
        setNotice({
          kind: "error",
          message: "SmartSuite isn't connected for this workspace. Add credentials in Integrations."
        });
      } else {
        setNotice({ kind: "error", message: err.message || "Failed to queue job." });
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="glass-chip">Workspace dashboard</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-heading">Prospect Operations</h1>
        <p className="text-muted-foreground max-w-2xl">
          Run prospect discovery, AI enrichment, and CRM sync from one console. Jobs queue
          automatically and stream their output to your job history.
        </p>
      </header>

      <QuotaBanner />

      {notice && (
        <div
          className={`panel px-4 py-3 text-sm flex items-center gap-2 ${
            notice.kind === "error"
              ? "border-destructive/40 text-destructive"
              : notice.kind === "quota"
              ? "border-primary/40"
              : ""
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span className="flex-1">{notice.message}</span>
          {notice.kind === "quota" && (
            <Link href="/app/settings/billing">
              <Button size="sm">Upgrade</Button>
            </Link>
          )}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="panel">
          <CardHeader>
            <CardTitle>Find Geographic Prospects</CardTitle>
            <CardDescription>Search by ZIP radius + categories. Counts against your monthly prospect quota.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prospects-zip">ZIP Code</Label>
              <Input
                id="prospects-zip"
                value={prospectsConfig.zipcode}
                onChange={(e) => setProspectsConfig({ ...prospectsConfig, zipcode: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospects-radius">Radius (mi)</Label>
              <Input
                id="prospects-radius"
                type="number"
                value={prospectsConfig.radius}
                onChange={(e) => setProspectsConfig({ ...prospectsConfig, radius: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="prospects-categories">Categories</Label>
              <Input
                id="prospects-categories"
                value={prospectsConfig.categories}
                onChange={(e) => setProspectsConfig({ ...prospectsConfig, categories: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospects-limit">Limit</Label>
              <Input
                id="prospects-limit"
                type="number"
                value={prospectsConfig.limit}
                onChange={(e) => setProspectsConfig({ ...prospectsConfig, limit: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm self-end">
              <Checkbox
                checked={prospectsConfig.dryRun}
                onCheckedChange={(v) => setProspectsConfig({ ...prospectsConfig, dryRun: Boolean(v) })}
              />
              Dry run (no writes, no quota)
            </label>
            <div className="md:col-span-2">
              <Button
                className="w-full"
                disabled={loading !== null}
                onClick={() => runJob("find-prospects", prospectsConfig, "Prospect search")}
              >
                {loading === "find-prospects" ? "Queuing…" : "Find prospects"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>AI Enrichment</CardTitle>
            <CardDescription>Enrich prospects with AI research. Counts against your enrichment quota; overage uses credits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Research status filter</Label>
              <Select
                value={researchConfig.status}
                onValueChange={(v) => setResearchConfig({ ...researchConfig, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="research-limit">Limit</Label>
              <Input
                id="research-limit"
                type="number"
                value={researchConfig.limit}
                onChange={(e) => setResearchConfig({ ...researchConfig, limit: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={researchConfig.dryRun}
                onCheckedChange={(v) => setResearchConfig({ ...researchConfig, dryRun: Boolean(v) })}
              />
              Dry run (no API cost)
            </label>
            <Button
              className="w-full"
              disabled={loading !== null}
              onClick={() => runJob("research-prospects", researchConfig, "Prospect research")}
            >
              {loading === "research-prospects" ? "Queuing…" : "Start research"}
            </Button>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>Import / Sync from SmartSuite</CardTitle>
            <CardDescription>Pulls existing customers from your CRM. Requires SmartSuite to be connected.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="import-limit">Import limit</Label>
              <Input
                id="import-limit"
                type="number"
                placeholder="all"
                value={importConfig.limit}
                onChange={(e) => setImportConfig({ ...importConfig, limit: e.target.value })}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={importConfig.dryRun}
                  onCheckedChange={(v) => setImportConfig({ ...importConfig, dryRun: Boolean(v) })}
                />
                Dry run
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-limit">Sync limit</Label>
              <Input
                id="sync-limit"
                type="number"
                placeholder="all"
                value={syncConfig.limit}
                onChange={(e) => setSyncConfig({ ...syncConfig, limit: e.target.value })}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={syncConfig.dryRun}
                  onCheckedChange={(v) => setSyncConfig({ ...syncConfig, dryRun: Boolean(v) })}
                />
                Dry run
              </label>
            </div>
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => runJob("import-customers", importConfig, "Import")}
            >
              {loading === "import-customers" ? "Queuing…" : "Run import"}
            </Button>
            <Button
              variant="outline"
              disabled={loading !== null}
              onClick={() => runJob("sync-customers", syncConfig, "Sync")}
            >
              {loading === "sync-customers" ? "Queuing…" : "Run sync"}
            </Button>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>System Check</CardTitle>
            <CardDescription>Validate SmartSuite connectivity for this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              className="w-full"
              disabled={loading !== null}
              onClick={() => runJob("test-integration", {}, "Integration test")}
            >
              {loading === "test-integration" ? "Queuing…" : "Run integration test"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-heading">Recent jobs</h2>
            <p className="text-sm text-muted-foreground">Latest queued and completed runs.</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <Activity className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-2 text-left font-medium">Job</th>
                <th className="py-2 text-left font-medium">Action</th>
                <th className="py-2 text-left font-medium">Status</th>
                <th className="py-2 text-left font-medium">Result</th>
                <th className="py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 font-mono text-xs">{job.id}</td>
                  <td className="py-2 capitalize">{job.action.replace(/-/g, " ")}</td>
                  <td className="py-2"><JobStatusBadge status={job.status} /></td>
                  <td className="py-2 text-muted-foreground text-xs">
                    {job.prospectsFound ? `${job.prospectsFound} prospects` : null}
                    {job.enrichmentsDone ? ` · ${job.enrichmentsDone} enrich` : null}
                    {job.creditsCharged ? ` · ${job.creditsCharged} credits` : null}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No jobs yet. Queue a run to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
