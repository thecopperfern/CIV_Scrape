import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ListChecks,
  Database,
  LogOut,
  CreditCard,
  Key,
  Plug,
  Activity,
  Users,
  Send,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const primaryNav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/campaigns", label: "Campaigns", icon: Send },
  { href: "/app/templates", label: "Templates", icon: FileText },
  { href: "/app/jobs", label: "Job History", icon: ListChecks },
  { href: "/app/data", label: "Data Explorer", icon: Database }
];

const settingsNav = [
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings/usage", label: "Usage", icon: Activity },
  { href: "/app/settings/api-keys", label: "API keys", icon: Key },
  { href: "/app/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/app/settings/team", label: "Team", icon: Users }
];

function isActive(location: string, href: string, exact?: boolean) {
  if (exact) return location === href;
  return location === href || location.startsWith(href + "/");
}

function NavLink({
  href,
  label,
  icon: Icon,
  active
}: {
  href: string;
  label: string;
  icon: any;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <a
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          active
            ? "bg-primary text-primary-foreground shadow"
            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </a>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { org, user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <div className="flex">
        <aside className="hidden lg:flex w-64 min-h-screen flex-col gap-8 border-r border-border/60 bg-card/70 px-6 py-8">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Prospect</div>
            <div className="text-2xl font-heading font-semibold">Forge</div>
            {org && (
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="truncate">{org.name}</div>
                <div className="capitalize text-foreground/70">{org.plan} plan</div>
              </div>
            )}
          </div>

          <nav className="space-y-1">
            {primaryNav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(location, item.href, item.exact)}
              />
            ))}
          </nav>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground px-3">Settings</div>
            {settingsNav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(location, item.href)}
              />
            ))}
          </div>

          <div className="mt-auto space-y-2">
            {user && (
              <div className="text-xs text-muted-foreground truncate px-1">{user.email}</div>
            )}
            <Button variant="outline" className="w-full" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </aside>

        <main className="flex-1">
          <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Prospect</div>
              <div className="text-lg font-heading font-semibold">Forge</div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </header>
          <nav className="lg:hidden flex items-center gap-2 overflow-x-auto border-b border-border/60 bg-card/60 px-4 py-2">
            {[...primaryNav, ...settingsNav].map((item) => (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition whitespace-nowrap",
                    isActive(location, item.href, (item as any).exact)
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </a>
              </Link>
            ))}
          </nav>
          <div className="px-6 py-8 lg:px-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
