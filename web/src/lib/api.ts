import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const data = err.response?.data;
    const message =
      (data && (data.error || data.message)) || err.message || "Request failed";
    return Promise.reject({
      message,
      status: err.response?.status,
      data,
      original: err
    });
  }
);

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function signup(payload: {
  email: string;
  password: string;
  name?: string;
  orgName?: string;
}) {
  const { data } = await api.post("/auth/signup", payload);
  return data;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function switchOrg(orgId: number) {
  const { data } = await api.post("/auth/switch-org", { orgId });
  return data;
}

export async function requestPasswordReset(email: string) {
  const { data } = await api.post("/auth/password-reset/request", { email });
  return data;
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  const { data } = await api.post("/auth/password-reset/confirm", {
    token,
    newPassword
  });
  return data;
}

export async function createJob(action: string, params: Record<string, any>) {
  const { data } = await api.post("/jobs", { action, params });
  return data;
}

export async function listJobs(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { data } = await api.get("/jobs", { params: opts });
  return data;
}

export async function getJob(id: string) {
  const { data } = await api.get(`/jobs/${id}`);
  return data;
}

export async function getJobOutput(id: string) {
  const { data } = await api.get(`/jobs/${id}/output`, {
    responseType: "text",
    transformResponse: (r) => r
  });
  return data as string;
}

export async function listRecords(opts: {
  table: string;
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get("/records", { params: opts });
  return data;
}

export async function getUsage() {
  const { data } = await api.get("/usage");
  return data;
}

export async function getBillingSummary() {
  const { data } = await api.get("/billing/subscription");
  return data;
}

export async function startSubscriptionCheckout(plan: string) {
  const { data } = await api.post("/billing/checkout/subscription", { plan });
  return data;
}

export async function startCreditsCheckout(pack: string) {
  const { data } = await api.post("/billing/checkout/credits", { pack });
  return data;
}

export async function openBillingPortal() {
  const { data } = await api.post("/billing/portal");
  return data;
}

export async function getCreditLedger() {
  const { data } = await api.get("/billing/ledger");
  return data;
}

export async function listApiKeys() {
  const { data } = await api.get("/api-keys");
  return data;
}

export async function createApiKey(name: string) {
  const { data } = await api.post("/api-keys", { name });
  return data;
}

export async function revokeApiKey(id: number) {
  await api.delete(`/api-keys/${id}`);
}

export async function getIntegration() {
  const { data } = await api.get("/integrations/smartsuite");
  return data;
}

export async function updateIntegration(payload: {
  apiKey: string;
  accountId: string;
  sourceTableId?: string;
  destTableId?: string;
}) {
  const { data } = await api.put("/integrations/smartsuite", payload);
  return data;
}

export async function deleteIntegration() {
  await api.delete("/integrations/smartsuite");
}

export async function testIntegration() {
  const { data } = await api.post("/integrations/smartsuite/test");
  return data;
}
