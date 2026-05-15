import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  getResendStatus,
  updateResend,
  deleteResend,
  testResend,
  getTwilioStatus,
  updateTwilio,
  deleteTwilio,
  testTwilio
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return null;
  const label = source === "platform" ? "Platform" : source === "byo" ? "Your account" : source;
  return <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-muted">{label}</span>;
}

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading">Integrations</h1>
        <p className="text-muted-foreground">
          Connect SmartSuite (data), Resend (email), and Twilio (SMS).
          Free plans must bring their own keys; paid plans can use the platform sender.
        </p>
      </header>

      <SmartSuiteCard />
      <ResendCard />
      <TwilioCard />
    </div>
  );
}

function SmartSuiteCard() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["integration", "smartsuite"], queryFn: getIntegration });
  const [form, setForm] = useState({ apiKey: "", accountId: "", sourceTableId: "", destTableId: "" });
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const hint = (status.data as any)?.hint;
    if (hint?.accountId && !form.accountId) {
      setForm((prev) => ({
        ...prev,
        accountId: hint.accountId,
        sourceTableId: hint.sourceTableId || "",
        destTableId: hint.destTableId || ""
      }));
    }
  }, [status.data]);

  const save = useMutation({
    mutationFn: () => updateIntegration(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration", "smartsuite"] });
      setForm({ ...form, apiKey: "" });
    }
  });
  const remove = useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "smartsuite"] })
  });
  const test = useMutation({
    mutationFn: testIntegration,
    onSuccess: () => setTestResult("ok"),
    onError: (err: any) => setTestResult(err?.message || "failed")
  });

  const configured = (status.data as any)?.configured;
  const fallback = (status.data as any)?.fallback;

  return (
    <Card className="panel">
      <CardHeader>
        <CardTitle>SmartSuite</CardTitle>
        <CardDescription>
          {configured && !fallback
            ? "Connected to your workspace."
            : configured && fallback
            ? "Using the platform default."
            : "Optional. Lets you import prospects directly from your SmartSuite CRM."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field
            label="API key"
            id="ss-apikey"
            type="password"
            placeholder={configured ? "•••• (already set — type to replace)" : ""}
            value={form.apiKey}
            onChange={(v) => setForm({ ...form, apiKey: v })}
          />
          <Field label="Account ID" id="ss-acc" value={form.accountId} onChange={(v) => setForm({ ...form, accountId: v })} />
          <Field label="Source table ID" id="ss-src" value={form.sourceTableId} onChange={(v) => setForm({ ...form, sourceTableId: v })} />
          <Field label="Hub table ID" id="ss-dst" value={form.destTableId} onChange={(v) => setForm({ ...form, destTableId: v })} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={!configured}>
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
          {configured && !fallback && (
            <Button variant="ghost" onClick={() => remove.mutate()}>Disconnect</Button>
          )}
        </div>
        {testResult && (
          <div className={`text-sm ${testResult === "ok" ? "text-primary" : "text-destructive"}`}>
            {testResult === "ok" ? "Connection successful." : `Test failed: ${testResult}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResendCard() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["integration", "resend"], queryFn: getResendStatus });
  const [form, setForm] = useState({ apiKey: "", fromEmail: "", fromName: "" });
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const hint = (status.data as any)?.hint;
    if (hint?.fromEmail && !form.fromEmail) {
      setForm((prev) => ({ ...prev, fromEmail: hint.fromEmail, fromName: hint.fromName || "" }));
    }
  }, [status.data]);

  const save = useMutation({
    mutationFn: () => updateResend(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration", "resend"] });
      setForm({ ...form, apiKey: "" });
    }
  });
  const remove = useMutation({
    mutationFn: deleteResend,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "resend"] })
  });
  const test = useMutation({
    mutationFn: testResend,
    onSuccess: () => setTestResult("ok"),
    onError: (err: any) => setTestResult(err?.message || "failed")
  });

  const configured = (status.data as any)?.configured;
  const source = (status.data as any)?.source;

  return (
    <Card className="panel">
      <CardHeader>
        <CardTitle>
          Resend (email) <SourceBadge source={source} />
        </CardTitle>
        <CardDescription>
          {configured && source === "byo"
            ? "Sending from your Resend account."
            : configured && source === "platform"
            ? "Using the platform sender. Add a key to use your own domain reputation."
            : "Required to send campaign emails. Get a free API key at resend.com."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field
            label="API key"
            id="re-apikey"
            type="password"
            placeholder={source === "byo" ? "•••• (already set — type to replace)" : ""}
            value={form.apiKey}
            onChange={(v) => setForm({ ...form, apiKey: v })}
          />
          <Field label="Default from email" id="re-from" value={form.fromEmail} onChange={(v) => setForm({ ...form, fromEmail: v })} placeholder="sales@yourdomain.com" />
          <Field label="Default from name" id="re-name" value={form.fromName} onChange={(v) => setForm({ ...form, fromName: v })} placeholder="Your Name" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={!configured}>
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
          {source === "byo" && <Button variant="ghost" onClick={() => remove.mutate()}>Disconnect</Button>}
        </div>
        {testResult && (
          <div className={`text-sm ${testResult === "ok" ? "text-primary" : "text-destructive"}`}>
            {testResult === "ok" ? "Connection successful." : `Test failed: ${testResult}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TwilioCard() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["integration", "twilio"], queryFn: getTwilioStatus });
  const [form, setForm] = useState({ accountSid: "", authToken: "", fromNumber: "" });
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const hint = (status.data as any)?.hint;
    if (hint?.fromNumber && !form.fromNumber) {
      setForm((prev) => ({ ...prev, fromNumber: hint.fromNumber }));
    }
  }, [status.data]);

  const save = useMutation({
    mutationFn: () => updateTwilio(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration", "twilio"] });
      setForm({ ...form, authToken: "" });
    }
  });
  const remove = useMutation({
    mutationFn: deleteTwilio,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "twilio"] })
  });
  const test = useMutation({
    mutationFn: testTwilio,
    onSuccess: () => setTestResult("ok"),
    onError: (err: any) => setTestResult(err?.message || "failed")
  });

  const configured = (status.data as any)?.configured;
  const source = (status.data as any)?.source;

  return (
    <Card className="panel">
      <CardHeader>
        <CardTitle>
          Twilio (SMS) <SourceBadge source={source} />
        </CardTitle>
        <CardDescription>
          {configured && source === "byo"
            ? "Sending from your Twilio number."
            : configured && source === "platform"
            ? "Using the platform Twilio number."
            : "Required to send SMS. SMS sends always debit credits (5 credits per message)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Account SID" id="tw-sid" value={form.accountSid} onChange={(v) => setForm({ ...form, accountSid: v })} />
          <Field
            label="Auth token"
            id="tw-tok"
            type="password"
            placeholder={source === "byo" ? "•••• (already set — type to replace)" : ""}
            value={form.authToken}
            onChange={(v) => setForm({ ...form, authToken: v })}
          />
          <Field label="From number" id="tw-from" value={form.fromNumber} onChange={(v) => setForm({ ...form, fromNumber: v })} placeholder="+15551234567" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={!configured}>
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
          {source === "byo" && <Button variant="ghost" onClick={() => remove.mutate()}>Disconnect</Button>}
        </div>
        {testResult && (
          <div className={`text-sm ${testResult === "ok" ? "text-primary" : "text-destructive"}`}>
            {testResult === "ok" ? "Connection successful." : `Test failed: ${testResult}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
