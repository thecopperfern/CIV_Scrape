import { useState } from "react";
import { createJob } from "@/lib/api";
import { useJobs } from "@/hooks/useJobs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { Activity, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
        setNotice(`${label} queued (Job ${response.job.id}).`);
      }
      refresh();
    } catch (err: any) {
      setNotice(err.message || "Failed to queue job.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="glass-chip">Hostinger Node App</span>
          <span className="glass-chip">Queue + History Enabled</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-heading">CIV Scrape Operations</h1>
        <p className="text-muted-foreground max-w-2xl">
          Run imports, syncs, prospect discovery, and AI research from a single console. Jobs queue automatically and
          outputs are available once each run completes.
        </p>
        {notice && (
          <div className="panel px-4 py-3 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {notice}
          </div>
        )}
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="panel">
          <CardHeader>
            <CardTitle>Import Customers</CardTitle>
            <CardDescription>Bring existing customers from the main CRM into the Intelligence Hub.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={importConfig.dryRun}
                onCheckedChange={(value) => setImportConfig((prev) => ({ ...prev, dryRun: Boolean(value) }))}
              />
              Dry run (preview only)
            </label>
            <div className="space-y-2">
              <Label htmlFor="import-limit">Limit records</Label>
              <Input
                id="import-limit"
                type="number"
                placeholder="Leave blank for all"
                value={importConfig.limit}
                onChange={(event) => setImportConfig((prev) => ({ ...prev, limit: event.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={loading !== null}
              onClick={() => runJob("import-customers", importConfig, "Import customers")}
            >
              {loading === "import-customers" ? "Queuing..." : "Run Import"}
            </Button>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>Sync Customers</CardTitle>
            <CardDescription>Merge-safe sync that preserves manual edits and updates priority tiers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={syncConfig.dryRun}
                onCheckedChange={(value) => setSyncConfig((prev) => ({ ...prev, dryRun: Boolean(value) }))}
              />
              Dry run (preview only)
            </label>
            <div className="space-y-2">
              <Label htmlFor="sync-limit">Limit records</Label>
              <Input
                id="sync-limit"
                type="number"
                placeholder="Leave blank for all"
                value={syncConfig.limit}
                onChange={(event) => setSyncConfig((prev) => ({ ...prev, limit: event.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={loading !== null}
              onClick={() => runJob("sync-customers", syncConfig, "Sync customers")}
            >
              {loading === "sync-customers" ? "Queuing..." : "Run Sync"}
            </Button>
          </CardContent>
        </Card>

        <Card className="panel lg:col-span-2">
          <CardHeader>
            <CardTitle>Find Geographic Prospects</CardTitle>
            <CardDescription>Search by ZIP radius and business categories to discover new prospects.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={prospectsConfig.dryRun}
                  onCheckedChange={(value) => setProspectsConfig((prev) => ({ ...prev, dryRun: Boolean(value) }))}
                />
                Dry run (preview only)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="prospects-zip">ZIP Code</Label>
                  <Input
                    id="prospects-zip"
                    value={prospectsConfig.zipcode}
                    onChange={(event) => setProspectsConfig((prev) => ({ ...prev, zipcode: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prospects-radius">Radius (miles)</Label>
                  <Input
                    id="prospects-radius"
                    type="number"
                    value={prospectsConfig.radius}
                    onChange={(event) => setProspectsConfig((prev) => ({ ...prev, radius: event.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="prospects-categories">Categories</Label>
                <Input
                  id="prospects-categories"
                  value={prospectsConfig.categories}
                  onChange={(event) => setProspectsConfig((prev) => ({ ...prev, categories: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospects-limit">Limit results</Label>
                <Input
                  id="prospects-limit"
                  type="number"
                  value={prospectsConfig.limit}
                  onChange={(event) => setProspectsConfig((prev) => ({ ...prev, limit: event.target.value }))}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <Button
                className="w-full"
                disabled={loading !== null}
                onClick={() => runJob("find-prospects", prospectsConfig, "Prospect search")}
              >
                {loading === "find-prospects" ? "Queuing..." : "Find Prospects"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>Research Prospects</CardTitle>
            <CardDescription>Enrich lead data with Perplexity AI research.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={researchConfig.dryRun}
                onCheckedChange={(value) => setResearchConfig((prev) => ({ ...prev, dryRun: Boolean(value) }))}
              />
              Dry run (no API cost)
            </label>
            <div className="space-y-2">
              <Label>Research status</Label>
              <Select
                value={researchConfig.status}
                onValueChange={(value) => setResearchConfig((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="research-limit">Limit records</Label>
              <Input
                id="research-limit"
                type="number"
                value={researchConfig.limit}
                onChange={(event) => setResearchConfig((prev) => ({ ...prev, limit: event.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={loading !== null}
              onClick={() => runJob("research-prospects", researchConfig, "Prospect research")}
            >
              {loading === "research-prospects" ? "Queuing..." : "Start Research"}
            </Button>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>System Check</CardTitle>
            <CardDescription>Validate API connectivity and configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Run this before large jobs to confirm SmartSuite credentials and environment setup.
            </p>
            <Button
              variant="secondary"
              className="w-full"
              disabled={loading !== null}
              onClick={() => runJob("test-integration", {}, "Integration test")}
            >
              {loading === "test-integration" ? "Queuing..." : "Run Integration Test"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-heading">Recent Jobs</h2>
            <p className="text-sm text-muted-foreground">Queue and completion status from the last few runs.</p>
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
                <th className="py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 font-mono text-xs">{job.id}</td>
                  <td className="py-2 capitalize">{job.action.replace(/-/g, " ")}</td>
                  <td className="py-2">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
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
