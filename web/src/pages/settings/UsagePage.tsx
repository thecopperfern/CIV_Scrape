import { useUsage } from "@/hooks/useUsage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UsagePage() {
  const { data } = useUsage();
  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading">Usage</h1>
        <p className="text-muted-foreground">Period: {data.period}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <UsageCard
          title="Prospects discovered"
          used={data.prospects.used}
          limit={data.prospects.limit}
        />
        <UsageCard
          title="AI enrichments"
          used={data.enrichments.used}
          limit={data.enrichments.limit}
        />
        <Card className="panel">
          <CardHeader>
            <CardTitle>Overage credits</CardTitle>
            <CardDescription>Spent on enrichments beyond your plan quota.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-heading">{data.credits}</div>
            <div className="text-xs text-muted-foreground">Available balance</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsageCard({ title, used, limit }: { title: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <Card className="panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {used.toLocaleString()} of {limit.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{pct}% used</div>
      </CardContent>
    </Card>
  );
}
