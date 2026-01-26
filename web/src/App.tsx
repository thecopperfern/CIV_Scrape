import { Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import DataPage from "@/pages/DataPage";

function AppContent() {
  const { authenticated, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading console...
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell onLogout={logout}>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/jobs" component={JobsPage} />
        <Route path="/data" component={DataPage} />
        <Route>
          <DashboardPage />
        </Route>
      </Switch>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
