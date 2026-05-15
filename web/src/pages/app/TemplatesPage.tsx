import { useState } from "react";
import { useTemplates, useTemplate, useTemplateMutations } from "@/hooks/useTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { previewTemplate } from "@/lib/api";

export default function TemplatesPage() {
  const list = useTemplates();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useTemplate(selectedId);
  const mutations = useTemplateMutations();

  const [draft, setDraft] = useState({
    name: "",
    channel: "email" as "email" | "sms",
    subject: "",
    body: ""
  });
  const [preview, setPreview] = useState<{ subject?: string; html?: string; text?: string; body?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const items = list.data?.items || [];

  function startNew() {
    setSelectedId(null);
    setDraft({ name: "", channel: "email", subject: "", body: "" });
    setErr(null);
    setPreview(null);
  }

  function loadSelected() {
    const t = selected.data?.template;
    if (!t) return;
    setDraft({
      name: t.name,
      channel: t.channel,
      subject: t.subject || "",
      body: t.body
    });
    setErr(null);
    setPreview(null);
  }

  async function onSave() {
    setErr(null);
    try {
      const payload: any = { ...draft };
      if (payload.channel === "sms") payload.subject = undefined;
      if (selectedId) {
        await mutations.update.mutateAsync({ id: selectedId, payload });
      } else {
        const r = await mutations.create.mutateAsync(payload);
        setSelectedId(r.template.id);
      }
    } catch (e: any) {
      setErr(e?.message || "save_failed");
    }
  }

  async function onPreview() {
    if (!selectedId) return;
    try {
      const r = await previewTemplate(selectedId);
      setPreview(r.rendered);
    } catch (e: any) {
      setErr(e?.message || "preview_failed");
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    if (!confirm("Delete this template?")) return;
    await mutations.remove.mutateAsync(selectedId);
    startNew();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-heading">Templates</h1>
          <p className="text-muted-foreground">
            Reusable email + SMS templates. Use{" "}
            <code>{"{{first_name}}"}</code>, <code>{"{{company}}"}</code>,
            and any custom fields you import with prospects.
          </p>
        </div>
        <Button onClick={startNew}>+ New template</Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="panel">
          <CardHeader>
            <CardTitle>Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            )}
            {items.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedId(t.id);
                  setErr(null);
                  setPreview(null);
                }}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                  selectedId === t.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{t.name}</span>
                  <span className="text-xs opacity-70">{t.channel}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle>{selectedId ? "Edit template" : "New template"}</CardTitle>
            <CardDescription>
              {draft.channel === "email"
                ? "HTML allowed; we sanitize on send."
                : "Plain text only. Always include an opt-out (we auto-add nothing for SMS)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedId && (
              <Button variant="outline" size="sm" onClick={loadSelected}>
                Load selected
              </Button>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Channel</Label>
                <Select
                  value={draft.channel}
                  onValueChange={(v) => setDraft({ ...draft, channel: v as "email" | "sms" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {draft.channel === "email" && (
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Body</Label>
              <textarea
                className="w-full min-h-[260px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </div>
            {err && <div className="text-sm text-destructive">{err}</div>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={onSave}>{selectedId ? "Save changes" : "Create template"}</Button>
              {selectedId && (
                <>
                  <Button variant="outline" onClick={onPreview}>Preview</Button>
                  <Button variant="ghost" onClick={onDelete}>Delete</Button>
                </>
              )}
            </div>
            {preview && (
              <div className="panel p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview</div>
                {preview.subject && <div className="text-sm font-medium">{preview.subject}</div>}
                {preview.html && (
                  <div className="text-sm border rounded p-3" dangerouslySetInnerHTML={{ __html: preview.html }} />
                )}
                {preview.body && <div className="text-sm whitespace-pre-wrap">{preview.body}</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
