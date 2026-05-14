import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntegrationsPage() {
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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your own SmartSuite workspace so prospect data lives in your CRM.
        </p>
      </header>

      <Card className="panel">
        <CardHeader>
          <CardTitle>SmartSuite</CardTitle>
          <CardDescription>
            {configured && !fallback
              ? "Connected to your workspace."
              : configured && fallback
              ? "Using the platform default (CIV admin only)."
              : "Not connected. Provide an API key + account to enable record sync."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ss-apikey">API key</Label>
              <Input
                id="ss-apikey"
                type="password"
                placeholder={configured ? "•••• (already set — type to replace)" : ""}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ss-account">Account ID</Label>
              <Input
                id="ss-account"
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ss-source">Source table ID</Label>
              <Input
                id="ss-source"
                value={form.sourceTableId}
                onChange={(e) => setForm({ ...form, sourceTableId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ss-dest">Hub table ID</Label>
              <Input
                id="ss-dest"
                value={form.destTableId}
                onChange={(e) => setForm({ ...form, destTableId: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={!configured}>
              {test.isPending ? "Testing…" : "Test connection"}
            </Button>
            {configured && !fallback && (
              <Button variant="ghost" onClick={() => remove.mutate()}>
                Disconnect
              </Button>
            )}
          </div>
          {testResult && (
            <div className={`text-sm ${testResult === "ok" ? "text-primary" : "text-destructive"}`}>
              {testResult === "ok" ? "Connection successful." : `Test failed: ${testResult}`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
