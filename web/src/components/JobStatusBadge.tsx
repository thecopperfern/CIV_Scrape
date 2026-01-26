import { Badge } from "@/components/ui/badge";

export function JobStatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  if (status === "failed") return <Badge variant="danger">Failed</Badge>;
  if (status === "running") return <Badge variant="warning">Running</Badge>;
  if (status === "queued") return <Badge>Queued</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
