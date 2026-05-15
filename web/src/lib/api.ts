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

// ---------- Resend / Twilio integrations ----------

export async function getResendStatus() {
  const { data } = await api.get("/integrations/resend");
  return data;
}
export async function updateResend(payload: { apiKey: string; fromEmail?: string; fromName?: string }) {
  const { data } = await api.put("/integrations/resend", payload);
  return data;
}
export async function deleteResend() {
  await api.delete("/integrations/resend");
}
export async function testResend() {
  const { data } = await api.post("/integrations/resend/test");
  return data;
}

export async function getTwilioStatus() {
  const { data } = await api.get("/integrations/twilio");
  return data;
}
export async function updateTwilio(payload: { accountSid: string; authToken: string; fromNumber: string }) {
  const { data } = await api.put("/integrations/twilio", payload);
  return data;
}
export async function deleteTwilio() {
  await api.delete("/integrations/twilio");
}
export async function testTwilio() {
  const { data } = await api.post("/integrations/twilio/test");
  return data;
}

// ---------- Templates ----------

export type Template = {
  id: number;
  name: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string;
  variantLabel: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listTemplates(opts: { channel?: "email" | "sms" } = {}) {
  const { data } = await api.get("/templates", { params: opts });
  return data as { items: Template[] };
}
export async function getTemplate(id: number) {
  const { data } = await api.get(`/templates/${id}`);
  return data as { template: Template };
}
export async function createTemplate(payload: Partial<Template>) {
  const { data } = await api.post("/templates", payload);
  return data as { template: Template };
}
export async function updateTemplate(id: number, payload: Partial<Template>) {
  const { data } = await api.put(`/templates/${id}`, payload);
  return data as { template: Template };
}
export async function deleteTemplate(id: number) {
  await api.delete(`/templates/${id}`);
}
export async function previewTemplate(id: number, target?: Record<string, any>) {
  const { data } = await api.post(`/templates/${id}/preview`, { target });
  return data as { rendered: { subject?: string; html?: string; text?: string; body?: string } };
}

// ---------- Campaigns ----------

export type CampaignStatus = "draft" | "active" | "paused" | "done" | "archived";

export type Campaign = {
  id: number;
  name: string;
  status: CampaignStatus;
  fromName: string | null;
  fromEmail: string | null;
  replyToEmail: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  stats: { targets: number; sent: number; delivered: number; opened: number; replied: number; bounced: number };
};

export type CampaignStep = {
  id: number;
  campaignId: number;
  stepOrder: number;
  channel: "email" | "sms" | "call";
  dayOffset: number;
  templateIds: number[];
  sendWindowStart: string | null;
  sendWindowEnd: string | null;
  sendWindowTz: string | null;
  sendOnWeekdaysOnly: boolean;
};

export async function listCampaigns(opts: { status?: CampaignStatus; limit?: number; offset?: number } = {}) {
  const { data } = await api.get("/campaigns", { params: opts });
  return data as { items: Campaign[]; total: number };
}
export async function getCampaign(id: number) {
  const { data } = await api.get(`/campaigns/${id}`);
  return data as { campaign: Campaign; steps: CampaignStep[] };
}
export async function createCampaign(payload: { name: string; fromName?: string; fromEmail?: string; replyToEmail?: string }) {
  const { data } = await api.post("/campaigns", payload);
  return data as { campaign: Campaign };
}
export async function updateCampaign(id: number, payload: Partial<Campaign>) {
  const { data } = await api.put(`/campaigns/${id}`, payload);
  return data as { campaign: Campaign };
}
export async function setCampaignSteps(id: number, steps: Array<Partial<CampaignStep>>) {
  const { data } = await api.post(`/campaigns/${id}/steps`, { steps });
  return data;
}
export async function listCampaignTargets(id: number, opts: { status?: string; limit?: number; offset?: number } = {}) {
  const { data } = await api.get(`/campaigns/${id}/targets`, { params: opts });
  return data;
}
export async function importCampaignTargets(id: number, targets: Array<Record<string, any>>) {
  const { data } = await api.post(`/campaigns/${id}/targets/import`, { targets });
  return data;
}
export async function startCampaign(id: number) {
  const { data } = await api.post(`/campaigns/${id}/start`);
  return data;
}
export async function pauseCampaign(id: number) {
  const { data } = await api.post(`/campaigns/${id}/pause`);
  return data;
}
export async function resumeCampaign(id: number) {
  const { data } = await api.post(`/campaigns/${id}/resume`);
  return data;
}
export async function sendTestEmail(campaignId: number, payload: { to: string; templateId: number; sample?: Record<string, any> }) {
  const { data } = await api.post(`/campaigns/${campaignId}/send-test`, payload);
  return data;
}
export async function listCampaignEvents(id: number, limit = 100) {
  const { data } = await api.get(`/campaigns/${id}/events`, { params: { limit } });
  return data;
}

// ---------- Call logs ----------

export type CallLog = {
  id: number;
  org_id: number;
  user_id: number | null;
  target_id: number | null;
  external_id: string | null;
  outcome: string;
  duration_seconds: number | null;
  notes: string | null;
  follow_up_at: string | null;
  created_at: string;
};

export async function listCalls(opts: { targetId?: number; outcome?: string; limit?: number; offset?: number } = {}) {
  const { data } = await api.get("/calls", { params: opts });
  return data as { items: CallLog[]; total: number };
}
export async function createCall(payload: {
  targetId?: number;
  externalId?: string;
  outcome: string;
  durationSeconds?: number;
  notes?: string;
  followUpAt?: string;
}) {
  const { data } = await api.post("/calls", payload);
  return data as { call: CallLog };
}

