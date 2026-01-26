import { useCallback, useEffect, useState } from "react";
import { listJobs } from "@/lib/api";

export type Job = {
  id: string;
  action: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  exitCode?: number | null;
  error?: string | null;
  params?: Record<string, any>;
};

export function useJobs({ status, limit = 20, pollInterval = 5000 } = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listJobs({ status, limit });
      setJobs(data.items || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, pollInterval);
    return () => clearInterval(timer);
  }, [refresh, pollInterval]);

  return { jobs, loading, error, refresh };
}
