import { ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/">
            <a className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-heading font-bold">
                PF
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Prospect</div>
                <div className="text-lg font-heading font-semibold leading-tight">Forge</div>
              </div>
            </a>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/pricing">
              <a className="px-3 py-2 text-muted-foreground hover:text-foreground">Pricing</a>
            </Link>
            <Link href="/login">
              <a className="px-3 py-2 text-muted-foreground hover:text-foreground">Log in</a>
            </Link>
            <Link href="/signup">
              <Button size="sm">Start free</Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} Prospect Forge</div>
          <div className="flex gap-4">
            <Link href="/pricing"><a>Pricing</a></Link>
            <Link href="/login"><a>Log in</a></Link>
            <Link href="/signup"><a>Sign up</a></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
