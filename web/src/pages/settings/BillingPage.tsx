import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBillingSummary,
  startSubscriptionCheckout,
  startCreditsCheckout,
  openBillingPortal,
  getCreditLedger
} from "@/lib/api";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ["billing-summary"], queryFn: getBillingSummary });
  const ledger = useQuery({ queryKey: ["credit-ledger"], queryFn: getCreditLedger });

  const currentPlan = (summary.data as any)?.plan || "free";
  const credits = (summary.data as any)?.credits || 0;
  const subscription = (summary.data as any)?.subscription;

  async function upgrade(plan: string) {
    try {
      const res = await startSubscriptionCheckout(plan);
      if ((res as any).url) window.location.href = (res as any).url;
    } catch (err: any) {
      alert(err?.message || "Could not start checkout. Stripe may not be configured yet.");
    }
  }

  async function buyCredits(pack: string) {
    try {
      const res = await startCreditsCheckout(pack);
      if ((res as any).url) window.location.href = (res as any).url;
    } catch (err: any) {
      alert(err?.message || "Could not start checkout.");
    }
  }

  async function portal() {
    try {
      const res = await openBillingPortal();
      if ((res as any).url) window.location.href = (res as any).url;
    } catch (err: any) {
      alert(err?.message || "Portal unavailable.");
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-heading">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and overage credits.
        </p>
      </header>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            You are on the <strong className="capitalize">{currentPlan}</strong> plan
            {subscription?.status ? ` (${subscription.status})` : ""}.
            {subscription?.cancelAtPeriodEnd ? " Cancels at period end." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {subscription ? (
            <Button variant="outline" onClick={portal}>
              Manage in Stripe
            </Button>
          ) : null}
          <div className="text-sm self-center">
            <span className="text-muted-foreground">Credit balance:</span>{" "}
            <span className="font-medium">{credits}</span>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-xl font-heading mb-3">Change plan</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`panel p-5 flex flex-col ${plan.id === currentPlan ? "ring-2 ring-primary" : ""}`}
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{plan.name}</div>
              <div className="mt-1 text-2xl font-heading">
                ${plan.priceMonthly}
                <span className="text-xs text-muted-foreground"> /mo</span>
              </div>
              <ul className="mt-3 text-xs text-muted-foreground space-y-1 flex-1">
                <li>{plan.prospects.toLocaleString()} prospects / mo</li>
                <li>{plan.enrichments.toLocaleString()} enrichments / mo</li>
                <li>{plan.seats === -1 ? "Unlimited" : plan.seats} seat{plan.seats === 1 ? "" : "s"}</li>
                <li>{plan.api ? "API access" : "No API"}</li>
              </ul>
              <div className="mt-4">
                {plan.id === currentPlan ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current
                  </Button>
                ) : plan.id === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Downgrade via Stripe portal
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => upgrade(plan.id)}>
                    {plan.priceMonthly > (PLANS.find((p) => p.id === currentPlan)?.priceMonthly || 0)
                      ? "Upgrade"
                      : "Switch"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-heading mb-3">Buy overage credits</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Each credit = one AI enrichment beyond your monthly plan quota. Credits never expire.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.id} className="panel p-5 flex items-end justify-between">
              <div>
                <div className="text-2xl font-heading">{pack.credits}</div>
                <div className="text-xs text-muted-foreground">credits — ${pack.price}</div>
              </div>
              <Button onClick={() => buyCredits(pack.id)}>Buy</Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-heading mb-3">Credit history</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-2 px-4 text-left font-medium">Date</th>
                <th className="py-2 px-4 text-left font-medium">Δ</th>
                <th className="py-2 px-4 text-left font-medium">Reason</th>
                <th className="py-2 px-4 text-left font-medium">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {(ledger.data as any)?.items?.map((row: any) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2 px-4">{new Date(row.created_at).toLocaleString()}</td>
                  <td className={`py-2 px-4 ${row.delta < 0 ? "text-destructive" : ""}`}>
                    {row.delta > 0 ? `+${row.delta}` : row.delta}
                  </td>
                  <td className="py-2 px-4 capitalize">{row.reason}</td>
                  <td className="py-2 px-4">{row.balance_after ?? "—"}</td>
                </tr>
              ))}
              {(!ledger.data || !(ledger.data as any).items?.length) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No credit activity yet.
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
