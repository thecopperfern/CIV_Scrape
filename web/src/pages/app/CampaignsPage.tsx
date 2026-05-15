import { Link } from "wouter";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-foreground",
  active: "bg-primary/15 text-primary",
  paused: "bg-yellow-100 text-yellow-900",
  done: "bg-secondary text-foreground",
  archived: "bg-muted text-muted-foreground"
};

export default function CampaignsPage() {
  const { data, isLoading } = useCampaigns({ pollInterval: 10_000 });
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-heading">Campaigns</h1>
          <p className="text-muted-foreground">
            Multi-touch outreach sequences across email, SMS, and calls.
          </p>
        </div>
        <Link href="/app/campaigns/new">
          <Button>+ New campaign</Button>
        </Link>
      </header>

      <Card className="panel">
        <CardHeader>
          <CardTitle>All campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 text-left font-medium">Name</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Targets</th>
                  <th className="py-2 text-left font-medium">Sent</th>
                  <th className="py-2 text-left font-medium">Replied</th>
                  <th className="py-2 text-left font-medium">Bounced</th>
                  <th className="py-2 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2">
                      <Link href={`/app/campaigns/${c.id}`}>
                        <a className="underline">{c.name}</a>
                      </Link>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[c.status] || ""}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2">{c.stats.targets}</td>
                    <td className="py-2">{c.stats.sent}</td>
                    <td className="py-2">{c.stats.replied}</td>
                    <td className="py-2">{c.stats.bounced}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No campaigns yet. Create one to start outreach.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
