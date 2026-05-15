import { useState } from "react";
import { useLocation } from "wouter";
import { useTemplates } from "@/hooks/useTemplates";
import { useCampaignMutations } from "@/hooks/useCampaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Step = { channel: "email" | "sms" | "call"; dayOffset: number; templateIds: number[] };

export default function NewCampaignPage() {
  const [, setLocation] = useLocation();
  const templates = useTemplates();
  const mutations = useCampaignMutations();

  const [name, setName] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ channel: "email", dayOffset: 0, templateIds: [] }]);
  const [targetsText, setTargetsText] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tItems = templates.data?.items || [];

  function addStep() {
    setSteps([...steps, { channel: "email", dayOffset: 3, templateIds: [] }]);
  }
  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i));
  }
  function updateStep(i: number, patch: Partial<Step>) {
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function parseTargets(): Array<Record<string, any>> {
    const lines = targetsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const [email, displayName, company, phone] = parts;
      return { email, displayName: displayName || undefined, company: company || undefined, phone: phone || undefined };
    });
  }

  async function onSubmit() {
    setErr(null);
    if (!name.trim()) {
      setErr("Name required.");
      return;
    }
    if (steps.length === 0) {
      setErr("Add at least one step.");
      return;
    }
    for (const [i, s] of steps.entries()) {
      if (s.channel !== "call" && s.templateIds.length === 0) {
        setErr(`Step ${i + 1}: pick a template.`);
        return;
      }
    }
    const targets = parseTargets();
    if (targets.length === 0) {
      setErr("Add at least one target.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await mutations.create.mutateAsync({
        name: name.trim(),
        fromName: fromName.trim() || undefined,
        fromEmail: fromEmail.trim() || undefined,
        replyToEmail: replyToEmail.trim() || undefined
      });
      const id = created.campaign.id;
      await mutations.setSteps.mutateAsync({ id, steps });
      await mutations.importTargets.mutateAsync({ id, targets });
      if (autoStart) {
        try {
          await mutations.start.mutateAsync(id);
        } catch (e: any) {
          setErr(`Created, but couldn't start: ${e?.message}`);
        }
      }
      setLocation(`/app/campaigns/${id}`);
    } catch (e: any) {
      setErr(e?.message || "save_failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading">New campaign</h1>
        <p className="text-muted-foreground">Configure recipients, steps, and timing in one place.</p>
      </header>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q2 promo outreach" />
          </div>
          <div className="space-y-1">
            <Label>From name</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Sam from Acme" />
          </div>
          <div className="space-y-1">
            <Label>From email</Label>
            <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="sam@acme.com" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Reply-to (optional)</Label>
            <Input value={replyToEmail} onChange={(e) => setReplyToEmail(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Sequence steps</CardTitle>
          <CardDescription>Order matters. Day offset = days after the prior step.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[100px_140px_1fr_auto] items-end border-b pb-3 last:border-0">
              <div className="space-y-1">
                <Label className="text-xs">Channel</Label>
                <Select value={s.channel} onValueChange={(v) => updateStep(i, { channel: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Day offset</Label>
                <Input
                  type="number"
                  min={0}
                  value={s.dayOffset}
                  onChange={(e) => updateStep(i, { dayOffset: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {s.channel === "call" ? "Template (n/a for calls)" : "Template"}
                </Label>
                <Select
                  value={s.templateIds[0] ? String(s.templateIds[0]) : ""}
                  onValueChange={(v) => updateStep(i, { templateIds: v ? [Number(v)] : [] })}
                  disabled={s.channel === "call"}
                >
                  <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                  <SelectContent>
                    {tItems
                      .filter((t) => s.channel === "call" || t.channel === s.channel)
                      .map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.channel})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" onClick={() => removeStep(i)} disabled={steps.length <= 1}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addStep}>+ Add step</Button>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Targets</CardTitle>
          <CardDescription>
            One per line, comma-separated: <code>email, name, company, phone</code> (name/company/phone optional).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full min-h-[160px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            value={targetsText}
            onChange={(e) => setTargetsText(e.target.value)}
            placeholder={"alex@acme.com, Alex Smith, Acme Inc, +15551234567\nbo@beta.io, Bo Jordan, Beta IO"}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
            Start campaign immediately after creation
          </label>
        </CardContent>
      </Card>

      {err && <div className="text-sm text-destructive">{err}</div>}
      <Button onClick={onSubmit} disabled={submitting} className="w-full md:w-auto">
        {submitting ? "Creating…" : autoStart ? "Create and start" : "Create draft"}
      </Button>
    </div>
  );
}
