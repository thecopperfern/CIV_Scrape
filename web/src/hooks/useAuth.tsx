import { createContext, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFns from "@/lib/api";

export type Features = {
  plan: string;
  prospects: number;
  enrichments: number;
  seats: number;
  api: boolean;
  rateLimit: number;
};

export type OrgInfo = {
  id: number;
  name: string;
  slug: string;
  plan: string;
  credits: number;
  role: "owner" | "admin" | "member" | null;
  features: Features;
};

export type UserInfo = {
  id: number;
  email: string;
  name: string | null;
};

type AuthState = {
  authenticated: boolean;
  loading: boolean;
  user: UserInfo | null;
  org: OrgInfo | null;
  orgs: OrgInfo[];
  refresh: () => Promise<unknown>;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: {
    email: string;
    password: string;
    name?: string;
    orgName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: number) => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: apiFns.getMe,
    staleTime: 60_000
  });

  const data = meQuery.data as any;

  const value = useMemo<AuthState>(
    () => ({
      authenticated: Boolean(data?.authenticated),
      loading: meQuery.isLoading,
      user: data?.user || null,
      org: data?.org || null,
      orgs: data?.orgs || [],
      refresh: () => qc.invalidateQueries({ queryKey: ["me"] }),
      login: async (email, password) => {
        await apiFns.login(email, password);
        await qc.invalidateQueries({ queryKey: ["me"] });
      },
      signup: async (payload) => {
        await apiFns.signup(payload);
        await qc.invalidateQueries({ queryKey: ["me"] });
      },
      logout: async () => {
        await apiFns.logout();
        await qc.invalidateQueries({ queryKey: ["me"] });
        qc.removeQueries();
      },
      switchOrg: async (orgId) => {
        await apiFns.switchOrg(orgId);
        await qc.invalidateQueries({ queryKey: ["me"] });
      }
    }),
    [data, meQuery.isLoading, qc]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
