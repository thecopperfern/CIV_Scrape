import { Redirect, Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";

import LandingPage from "@/pages/marketing/LandingPage";
import PricingPage from "@/pages/marketing/PricingPage";

import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import DataPage from "@/pages/DataPage";
import CampaignsPage from "@/pages/app/CampaignsPage";
import CampaignDetailPage from "@/pages/app/CampaignDetailPage";
import NewCampaignPage from "@/pages/app/NewCampaignPage";
import TemplatesPage from "@/pages/app/TemplatesPage";

import BillingPage from "@/pages/settings/BillingPage";
import UsagePage from "@/pages/settings/UsagePage";
import ApiKeysPage from "@/pages/settings/ApiKeysPage";
import IntegrationsPage from "@/pages/settings/IntegrationsPage";
import TeamPage from "@/pages/settings/TeamPage";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!authenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (authenticated) return <Redirect to="/app" />;
  return <>{children}</>;
}

function AuthedRoutes() {
  return (
    <AppShell>
      <Switch>
        <Route path="/app" component={DashboardPage} />
        <Route path="/app/campaigns/new" component={NewCampaignPage} />
        <Route path="/app/campaigns/:id" component={CampaignDetailPage} />
        <Route path="/app/campaigns" component={CampaignsPage} />
        <Route path="/app/templates" component={TemplatesPage} />
        <Route path="/app/jobs" component={JobsPage} />
        <Route path="/app/data" component={DataPage} />
        <Route path="/app/settings/billing" component={BillingPage} />
        <Route path="/app/settings/usage" component={UsagePage} />
        <Route path="/app/settings/api-keys" component={ApiKeysPage} />
        <Route path="/app/settings/integrations" component={IntegrationsPage} />
        <Route path="/app/settings/team" component={TeamPage} />
        <Route><DashboardPage /></Route>
      </Switch>
    </AppShell>
  );
}

function Routes() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/login">
        <RedirectIfAuthed><LoginPage /></RedirectIfAuthed>
      </Route>
      <Route path="/signup">
        <RedirectIfAuthed><SignupPage /></RedirectIfAuthed>
      </Route>
      <Route path="/forgot" component={ForgotPasswordPage} />
      <Route path="/reset/:token" component={ResetPasswordPage} />
      <Route path="/app/:rest*">
        <RequireAuth><AuthedRoutes /></RequireAuth>
      </Route>
      <Route><LandingPage /></Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
