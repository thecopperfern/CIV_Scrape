import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFns from "@/lib/api";

export function useCampaigns(opts: { status?: apiFns.CampaignStatus; pollInterval?: number | false } = {}) {
  return useQuery({
    queryKey: ["campaigns", { status: opts.status }],
    queryFn: () => apiFns.listCampaigns(opts.status ? { status: opts.status } : undefined),
    refetchInterval: opts.pollInterval ?? false
  });
}

export function useCampaign(id: number | null, opts: { pollInterval?: number | false } = {}) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => apiFns.getCampaign(id!),
    enabled: id != null,
    refetchInterval: opts.pollInterval ?? false
  });
}

export function useCampaignTargets(
  id: number | null,
  opts: { status?: string; limit?: number; offset?: number; pollInterval?: number | false } = {}
) {
  return useQuery({
    queryKey: ["campaign-targets", id, opts],
    queryFn: () =>
      apiFns.listCampaignTargets(id!, {
        status: opts.status,
        limit: opts.limit,
        offset: opts.offset
      }),
    enabled: id != null,
    refetchInterval: opts.pollInterval ?? false
  });
}

export function useCampaignMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: apiFns.createCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] })
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => apiFns.updateCampaign(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign", vars.id] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    }
  });
  const setSteps = useMutation({
    mutationFn: ({ id, steps }: { id: number; steps: any[] }) => apiFns.setCampaignSteps(id, steps),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["campaign", vars.id] })
  });
  const importTargets = useMutation({
    mutationFn: ({ id, targets }: { id: number; targets: any[] }) =>
      apiFns.importCampaignTargets(id, targets),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign", vars.id] });
      qc.invalidateQueries({ queryKey: ["campaign-targets", vars.id] });
    }
  });
  const start = useMutation({
    mutationFn: apiFns.startCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] })
  });
  const pause = useMutation({
    mutationFn: apiFns.pauseCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] })
  });
  const resume = useMutation({
    mutationFn: apiFns.resumeCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] })
  });
  const sendTest = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiFns.sendTestEmail(id, payload)
  });
  return { create, update, setSteps, importTargets, start, pause, resume, sendTest };
}
