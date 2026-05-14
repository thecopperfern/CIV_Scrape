import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamPage() {
  const { user, org } = useAuth();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading">Team</h1>
        <p className="text-muted-foreground">Manage who has access to {org?.name}.</p>
      </header>

      <Card className="panel">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Seat limit on your plan: {org?.features.seats === -1 ? "unlimited" : org?.features.seats}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Role</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40 last:border-0">
                <td className="py-2">{user?.email}</td>
                <td className="py-2 capitalize">{org?.role}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-4">
            Email invitations are coming soon. For now, contact support to add teammates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
