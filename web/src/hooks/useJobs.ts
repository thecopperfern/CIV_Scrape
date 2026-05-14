import { useQuery } from "@tanstack/react-query";
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
  prospectsFound?: number;
  enrichmentsDone?: number;
  creditsCharged?: number;
};

export function useJobs({
  status,
  limit = 20,
  pollInterval = 5000
}: { status?: string; limit?: number; pollInterval?: number | false } = {}) {
  const query = useQuery<{ items: Job[]; total: number }>({
    queryKey: ["jobs", { status, limit }],
    queryFn: () => listJobs({ status, limit }),
    refetchInterval: pollInterval || false
  });
  return {
    jobs: query.data?.items || [],
    total: query.data?.total || 0,
    loading: query.isLoading,
    error: query.error ? (query.error as any).message : null,
    refresh: () => query.refetch()
  };
}
