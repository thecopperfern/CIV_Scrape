import { useEffect, useState } from "react";
import { useJobs } from "@/hooks/useJobs";
import { getJobOutput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { jobs, loading, error, refresh } = useJobs({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
    pollInterval: 8000
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [output, setOutput] = useState<string>("");
  const [outputLoading, setOutputLoading] = useState(false);

  useEffect(() => {
    setOutput("");
  }, [selectedJobId]);

  const handleViewOutput = async (jobId: string) => {
    setSelectedJobId(jobId);
    setOutputLoading(true);
    try {
      const text = await getJobOutput(jobId);
      setOutput(typeof text === "string" ? text : JSON.stringify(text, null, 2));
    } catch (err: any) {
      setOutput(err.message || "Failed to load output.");
    } finally {
      setOutputLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-heading">Job History</h1>
          <p className="text-muted-foreground">Review queued and completed runs, then inspect output.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </header>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading jobs...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 text-left font-medium">ID</th>
                  <th className="py-2 text-left font-medium">Action</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Created</th>
                  <th className="py-2 text-left font-medium">Output</th>
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
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={job.status === "queued" || job.status === "running"}
                        onClick={() => handleViewOutput(job.id)}
                      >
                        View output
                      </Button>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No jobs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Job Output</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedJobId ? (
            <ScrollArea className="h-[360px] rounded-lg border border-border/60 bg-background/70 p-4 text-xs font-mono">
              {outputLoading ? "Loading output..." : output || "No output available."}
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">Select a completed job to view its output.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
