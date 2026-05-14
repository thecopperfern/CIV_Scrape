import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { startSubscriptionCheckout } from "@/lib/api";

export default function PricingPage() {
  const { authenticated } = useAuth();

  async function onUpgrade(plan: string) {
    if (!authenticated) {
      window.location.href = `/signup?plan=${plan}`;
      return;
    }
    try {
      const res = await startSubscriptionCheckout(plan);
      if ((res as any).url) window.location.href = (res as any).url;
    } catch {
      window.location.href = "/app/settings/billing";
    }
  }

  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-heading text-center">Simple pricing.</h1>
        <p className="text-center text-muted-foreground mt-3 max-w-2xl mx-auto">
          Start free. Upgrade when you need more reach. Buy credits when you hit a wall mid-month.
        </p>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`panel p-6 flex flex-col ${plan.id === "pro" ? "ring-2 ring-primary" : ""}`}
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{plan.name}</div>
              <div className="mt-2 text-3xl font-heading">
                ${plan.priceMonthly}
                <span className="text-sm text-muted-foreground"> /mo</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-4 space-y-2 text-sm flex-1">
                <Item ok>{plan.prospects.toLocaleString()} prospects / mo</Item>
                <Item ok>{plan.enrichments.toLocaleString()} AI enrichments / mo</Item>
                <Item ok>{plan.seats === -1 ? "Unlimited" : plan.seats} seat{plan.seats === 1 ? "" : "s"}</Item>
                <Item ok={plan.api}>API access</Item>
                <Item ok>Background job runner</Item>
              </ul>
              <div className="mt-6">
                {plan.id === "free" ? (
                  <Link href="/signup">
                    <Button variant="outline" className="w-full">Start free</Button>
                  </Link>
                ) : (
                  <Button className="w-full" onClick={() => onUpgrade(plan.id)}>
                    {authenticated ? "Upgrade" : "Choose plan"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-heading text-center">Need more this month?</h2>
          <p className="text-center text-muted-foreground mt-2">
            Top up with overage credits. 1 credit = 1 enrichment beyond your monthly quota.
          </p>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <div key={pack.id} className="panel p-5 text-center">
                <div className="text-3xl font-heading">{pack.credits}</div>
                <div className="text-xs text-muted-foreground">credits</div>
                <div className="mt-3 text-lg">${pack.price}</div>
                <div className="text-xs text-muted-foreground">${(pack.price / pack.credits).toFixed(2)} / credit</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function Item({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? "" : "text-muted-foreground line-through"}`}>
      <Check className={`h-4 w-4 mt-0.5 ${ok ? "text-primary" : "text-muted-foreground"}`} />
      <span>{children}</span>
    </li>
  );
}
