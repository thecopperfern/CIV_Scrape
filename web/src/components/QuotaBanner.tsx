import { Link } from "wouter";
import { useUsage } from "@/hooks/useUsage";

function pct(used: number, limit: number) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function QuotaBanner() {
  const { data } = useUsage();
  if (!data) return null;

  const pProspects = pct(data.prospects.used, data.prospects.limit);
  const pEnrich = pct(data.enrichments.used, data.enrichments.limit);
  const showUpgrade = data.plan === "free" || pProspects >= 80 || pEnrich >= 80;

  return (
    <div className="panel px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
      <div className="flex-1 grid sm:grid-cols-3 gap-3">
        <Bar label="Prospects" used={data.prospects.used} limit={data.prospects.limit} />
        <Bar label="Enrichments" used={data.enrichments.used} limit={data.enrichments.limit} />
        <div>
          <div className="text-xs text-muted-foreground">Credits</div>
          <div className="font-heading text-lg">{data.credits}</div>
        </div>
      </div>
      {showUpgrade && (
        <Link href="/app/settings/billing">
          <a className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium whitespace-nowrap">
            Upgrade plan
          </a>
        </Link>
      )}
    </div>
  );
}

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const p = pct(used, limit);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 mt-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
