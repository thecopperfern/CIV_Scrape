import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function ApiKeysPage() {
  const { org } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const keys = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys });

  const createMut = useMutation({
    mutationFn: (n: string) => createApiKey(n),
    onSuccess: (data) => {
      setNewKey((data as any).full);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    }
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] })
  });

  const apiAllowed = (keys.data as any)?.features?.api;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading">API keys</h1>
        <p className="text-muted-foreground">Use Bearer tokens with the public API at /api/v1.</p>
      </header>

      {!apiAllowed && org && (
        <Card className="panel border-destructive/40">
          <CardHeader>
            <CardTitle>API not available on {org.plan}</CardTitle>
            <CardDescription>
              Upgrade to Pro or Agency to provision keys and call /api/v1 programmatically.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {newKey && (
        <Card className="panel border-primary/40">
          <CardHeader>
            <CardTitle>Save this key now</CardTitle>
            <CardDescription>This is the only time we&apos;ll show the full secret.</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all panel p-3 text-xs">{newKey}</code>
            <Button className="mt-3" variant="outline" onClick={() => {
              navigator.clipboard.writeText(newKey);
            }}>Copy</Button>
          </CardContent>
        </Card>
      )}

      <Card className="panel">
        <CardHeader>
          <CardTitle>Create a new key</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMut.mutate(name.trim());
            }}
            className="flex gap-3"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="keyname">Label</Label>
              <Input id="keyname" value={name} onChange={(e) => setName(e.target.value)} placeholder="My CRM" />
            </div>
            <div className="self-end">
              <Button type="submit" disabled={!apiAllowed || createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-xl font-heading mb-3">Active keys</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-2 px-4 text-left">Name</th>
                <th className="py-2 px-4 text-left">Prefix</th>
                <th className="py-2 px-4 text-left">Last used</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4" />
              </tr>
            </thead>
            <tbody>
              {(keys.data as any)?.items?.map((k: any) => (
                <tr key={k.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 px-4">{k.name}</td>
                  <td className="py-2 px-4 font-mono text-xs">{k.prefix}…</td>
                  <td className="py-2 px-4">{k.last_used_at || "—"}</td>
                  <td className="py-2 px-4">{k.revoked_at ? "Revoked" : "Active"}</td>
                  <td className="py-2 px-4 text-right">
                    {!k.revoked_at && (
                      <Button size="sm" variant="outline" onClick={() => revokeMut.mutate(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {(!keys.data || !(keys.data as any).items?.length) && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No keys yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
