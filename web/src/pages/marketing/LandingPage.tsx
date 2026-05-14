import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/MarketingShell";
import { Sparkles, Target, Zap, Shield, MapPin, Brain } from "lucide-react";

export default function LandingPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 glass-chip">
          <Sparkles className="h-3 w-3" /> Built for B2B sales teams
        </div>
        <h1 className="mt-6 text-4xl md:text-6xl font-heading leading-tight">
          Find and enrich your next 1,000 prospects.
          <br />
          <span className="text-primary">Without spreadsheets.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Prospect Forge finds local B2B prospects by ZIP radius, enriches each with AI research,
          and queues outreach — so your team starts the week with a list, not a search.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup">
            <Button size="lg">Start free</Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline">See pricing</Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">25 prospects + 10 enrichments free, no card required.</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 grid md:grid-cols-3 gap-6">
        <Feature
          icon={MapPin}
          title="Geographic discovery"
          body="ZIP code + radius search across 15+ business categories. Dedupe against your existing customers automatically."
        />
        <Feature
          icon={Brain}
          title="AI enrichment"
          body="Each prospect comes back with industry, contact info, business signals, and a confidence score. Web-scrape fallback when AI isn't available."
        />
        <Feature
          icon={Zap}
          title="Background jobs"
          body="Long-running enrichments run in the background. Come back to a finished list, complete with logs."
        />
        <Feature
          icon={Target}
          title="Tier-aware quotas"
          body="See what's used and what's left at a glance. Buy overage credits when your team has a big month."
        />
        <Feature
          icon={Shield}
          title="Bring your own SmartSuite"
          body="Plug in your existing SmartSuite workspace for storage, or use Prospect Forge as your standalone tool."
        />
        <Feature
          icon={Sparkles}
          title="API access"
          body="Trigger jobs and pull results programmatically on Pro and Agency plans."
        />
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-heading">Stop paying SDRs to Google addresses.</h2>
        <p className="mt-4 text-muted-foreground">
          Prospect Forge does the discovery and enrichment automatically so your team spends time talking to prospects, not researching them.
        </p>
        <div className="mt-6">
          <Link href="/signup">
            <Button size="lg">Get started free</Button>
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}

function Feature({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="panel p-6 space-y-2">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="font-heading text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
