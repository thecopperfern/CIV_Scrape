import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useCampaign, useCampaignTargets, useCampaignMutations } from "@/hooks/useCampaigns";
import { useTemplates } from "@/hooks/useTemplates";
import { useCallMutations } from "@/hooks/useCalls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-foreground",
  active: "bg-primary/15 text-primary",
  paused: "bg-yellow-100 text-yellow-900",
  done: "bg-secondary text-foreground",
  archived: "bg-muted text-muted-foreground",
  replied: "bg-primary/15 text-primary",
  bounced: "bg-destructive/15 text-destructive",
  unsubscribed: "bg-yellow-100 text-yellow-900",
  failed: "bg-destructive/15 text-destructive"
};

export default function CampaignDetailPage() {
  const [, params] = useRoute<{ id: string }>("/app/campaigns/:id");
  const id = params ? Number(params.id) : null;
  const detail = useCampaign(id, { pollInterval: 8_000 });
  const targets = useCampaignTargets(id, { limit: 50, pollInterval: 8_000 });
  const templates = useTemplates();
  const mutations = useCampaignMutations();
  const callMutations = useCallMutations();

  const [testTo, setTestTo] = useState("");
  const [testTemplateId, setTestTemplateId] = useState<number | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [callDraft, setCallDraft] = useState({ targetId: 0, outcome: "voicemail", notes: "" });

  if (!id) return <div>Invalid campaign</div>;
  if (detail.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  const c = detail.data?.campaign;
  const steps = detail.data?.steps || [];
  if (!c) return <div>Campaign not found</div>;

  async function run(fn: () => Promise<any>) {
    setActionErr(null);
    try {
      await fn();
    } catch (e: any) {
      setActionErr(e?.message || "action_failed");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/app/campaigns"><a className="text-xs text-muted-foreground underline">← All campaigns</a></Link>
          <h1 className="text-3xl font-heading mt-1">{c.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[c.status] || ""}`}>{c.status}</span>
            {c.startedAt && <span className="text-xs text-muted-foreground">Started {new Date(c.startedAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === "draft" && (
            <Button onClick={() => run(() => mutations.start.mutateAsync(c.id))}>Start</Button>
          )}
          {c.status === "active" && (
            <Button variant="outline" onClick={() => run(() => mutations.pause.mutateAsync(c.id))}>Pause</Button>
          )}
          {c.status === "paused" && (
            <Button onClick={() => run(() => mutations.resume.mutateAsync(c.id))}>Resume</Button>
          )}
        </div>
      </header>

      {actionErr && <div className="text-sm text-destructive">{actionErr}</div>}

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Targets" value={c.stats.targets} />
        <Stat label="Sent" value={c.stats.sent} />
        <Stat label="Delivered" value={c.stats.delivered} />
        <Stat label="Opened" value={c.stats.opened} />
        <Stat label="Replied" value={c.stats.replied} />
        <Stat label="Bounced" value={c.stats.bounced} />
      </div>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Sequence</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                <span>
                  <strong>#{s.stepOrder + 1}</strong> · {s.channel.toUpperCase()} · day {s.dayOffset}
                  {s.templateIds.length > 0 && (
                    <span className="text-muted-foreground"> · template {s.templateIds.join(", ")}</span>
                  )}
                </span>
              </li>
            ))}
            {steps.length === 0 && (
              <li className="text-sm text-muted-foreground">No steps configured.</li>
            )}
          </ol>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Send a test</CardTitle>
          <CardDescription>Sends one message to the address below using the chosen template. Counts as 1 against your quota.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="recipient@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <Select
            value={testTemplateId ? String(testTemplateId) : ""}
            onValueChange={(v) => setTestTemplateId(v ? Number(v) : null)}
          >
            <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
            <SelectContent>
              {(templates.data?.items || []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.channel})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() =>
              run(() => mutations.sendTest.mutateAsync({
                id: c.id,
                payload: { to: testTo, templateId: testTemplateId! }
              }))
            }
            disabled={!testTo || !testTemplateId || mutations.sendTest.isPending}
          >
            {mutations.sendTest.isPending ? "Sending…" : "Send test"}
          </Button>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Targets</CardTitle>
          <CardDescription>{(targets.data as any)?.total || 0} total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Phone</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Step</th>
                  <th className="py-2 text-left">Next send</th>
                  <th className="py-2 text-left">Log call</th>
                </tr>
              </thead>
              <tbody>
                {((targets.data as any)?.items || []).map((t: any) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2">{t.displayName || "—"}</td>
                    <td className="py-2">{t.email || "—"}</td>
                    <td className="py-2">{t.phone || "—"}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[t.status] || ""}`}>{t.status}</span>
                    </td>
                    <td className="py-2">{t.currentStep}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {t.nextSendAt ? new Date(t.nextSendAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCallDraft({ ...callDraft, targetId: t.id })}
                      >
                        Log
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {callDraft.targetId > 0 && (
        <Card className="panel">
          <CardHeader>
            <CardTitle>Log call for target #{callDraft.targetId}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Outcome</Label>
              <Select
                value={callDraft.outcome}
                onValueChange={(v) => setCallDraft({ ...callDraft, outcome: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="no_answer">No answer</SelectItem>
                  <SelectItem value="wrong_number">Wrong number</SelectItem>
                  <SelectItem value="bad_number">Bad number</SelectItem>
                  <SelectItem value="dnc">Do not call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={callDraft.notes}
                onChange={(e) => setCallDraft({ ...callDraft, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  run(async () => {
                    await callMutations.create.mutateAsync({
                      targetId: callDraft.targetId,
                      outcome: callDraft.outcome,
                      notes: callDraft.notes || undefined
                    });
                    setCallDraft({ targetId: 0, outcome: "voicemail", notes: "" });
                  })
                }
              >
                Save call
              </Button>
              <Button variant="ghost" onClick={() => setCallDraft({ targetId: 0, outcome: "voicemail", notes: "" })}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-heading">{value}</div>
    </div>
  );
}
