import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFns from "@/lib/api";

export function useTemplates(channel?: "email" | "sms") {
  return useQuery({
    queryKey: ["templates", { channel }],
    queryFn: () => apiFns.listTemplates(channel ? { channel } : undefined)
  });
}

export function useTemplate(id: number | null) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: () => apiFns.getTemplate(id!),
    enabled: id != null
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: apiFns.createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] })
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<apiFns.Template> }) =>
      apiFns.updateTemplate(id, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["template", vars.id] });
    }
  });
  const remove = useMutation({
    mutationFn: apiFns.deleteTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] })
  });
  return { create, update, remove };
}
