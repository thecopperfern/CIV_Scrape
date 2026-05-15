import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFns from "@/lib/api";

export function useCalls(opts: { targetId?: number; outcome?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ["calls", opts],
    queryFn: () => apiFns.listCalls(opts)
  });
}

export function useCallMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: apiFns.createCall,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calls"] })
  });
  return { create };
}
