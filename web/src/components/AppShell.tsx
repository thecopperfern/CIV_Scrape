import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, ListChecks, Database, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job History", icon: ListChecks },
  { href: "/data", label: "Data Explorer", icon: Database }
];

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen">
      <div className="flex">
        <aside className="hidden lg:flex w-64 min-h-screen flex-col gap-8 border-r border-border/60 bg-card/70 px-6 py-8">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CIV</div>
            <div className="text-2xl font-heading font-semibold">Scrape Console</div>
            <p className="text-sm text-muted-foreground">
              Customer prospecting, research, and sync control.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <a
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto">
            <Button variant="outline" className="w-full" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </aside>

        <main className="flex-1">
          <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CIV</div>
              <div className="text-lg font-heading font-semibold">Scrape Console</div>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </header>
          <nav className="lg:hidden flex items-center gap-2 overflow-x-auto border-b border-border/60 bg-card/60 px-4 py-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <a
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition",
                      isActive
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </nav>
          <div className="px-6 py-8 lg:px-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
