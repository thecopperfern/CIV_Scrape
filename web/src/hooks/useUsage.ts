import { useQuery } from "@tanstack/react-query";
import { getUsage } from "@/lib/api";

export type UsageState = {
  plan: string;
  period: string;
  prospects: { used: number; limit: number };
  enrichments: { used: number; limit: number };
  credits: number;
  seats: number;
  api: boolean;
};

export function useUsage() {
  return useQuery<UsageState>({
    queryKey: ["usage"],
    queryFn: getUsage,
    staleTime: 15_000
  });
}
